import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppDataSchema } from '../../types';
import type { StorageListener } from './storageRepository';
import { emptyWorkspace, parseData, parseRevision, type Revision } from './workspaceSnapshot';
import { PlannerRepository } from './plannerRepository';
import { includesWorkspaceChanges, mergeWorkspace, sameValue, WorkspaceConflict } from './mergeWorkspace';

export { emptyWorkspace } from './workspaceSnapshot';

export function accountWorkspaceCacheKey(namespace: string, userId: string) {
  return `todop_account_v1:${namespace}:${userId}`;
}

type Upload = Revision & { replacement?: string };
type DeviceWorkspace = {
  base: Revision;
  draft?: AppDataSchema;
  upload?: Upload;
  replacement?: string;
};
type SyncPhase = 'idle' | 'offline' | 'syncing' | 'conflict' | 'error';
type SyncStatus = { ready: boolean; pending: boolean; phase: SyncPhase; message: string };

/** Saves each edit locally before syncing the account's revision. */
export class SupabaseRepository extends PlannerRepository {
  readonly cacheKey: string;
  private readonly client: SupabaseClient;
  private readonly userId: string;
  private readonly empty = emptyWorkspace();
  private listeners = new Set<StorageListener>();
  private device: DeviceWorkspace | null = null;
  private cachedJson: string | null = null;
  private status: SyncStatus = { ready: false, pending: false, phase: 'idle', message: '' };
  private syncing: Promise<void> | null = null;
  private syncRequested = false;

  constructor(client: SupabaseClient, userId: string, namespace: string) {
    super();
    this.client = client;
    this.userId = userId;
    this.cacheKey = accountWorkspaceCacheKey(namespace, userId);
  }

  getSnapshot = () => this.device?.draft ?? this.device?.base.data ?? this.empty;
  getSyncStatus = () => this.status;
  subscribe = (listener: StorageListener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(phase = this.status.phase, message = this.status.message) {
    const ready = this.device !== null;
    const pending = this.device?.draft !== undefined;
    if (ready !== this.status.ready || pending !== this.status.pending ||
        phase !== this.status.phase || message !== this.status.message) {
      this.status = { ready, pending, phase, message };
    }
    for (const listener of this.listeners) listener();
  }

  private readDevice() {
    const raw = localStorage.getItem(this.cacheKey);
    if (raw === this.cachedJson) return;
    try {
      if (!raw) this.device = null;
      else {
        const saved = JSON.parse(raw) as DeviceWorkspace;
        this.device = {
          base: parseRevision(saved.base),
          draft: saved.draft && parseData(saved.draft),
          upload: saved.upload && { ...parseRevision(saved.upload), replacement: saved.upload.replacement },
          replacement: saved.replacement,
        };
      }
      this.cachedJson = raw;
      if (this.status.phase === 'conflict' && !this.device?.draft) this.publish('idle', '');
      else this.publish();
    } catch {
      throw new Error('Todop could not read the saved copy of your account planner.');
    }
  }

  reloadDevice() {
    try {
      this.readDevice();
    } catch (error) {
      this.publish('error', error instanceof Error ? error.message : 'Could not load your device planner.');
    }
  }

  private saveDevice(device: DeviceWorkspace) {
    const json = JSON.stringify(device);
    if (json === this.cachedJson) return;
    try {
      localStorage.setItem(this.cacheKey, json);
    } catch {
      throw new Error('Todop could not save on this device. Check your browser storage and try again.');
    }
    this.cachedJson = json;
    this.device = device;
    this.publish();
  }

  private withDevice<T>(action: () => T | Promise<T>): Promise<T> {
    if (!navigator.locks) return Promise.reject(new Error('Open Todop in a browser that supports account sync.'));
    return navigator.locks.request(this.cacheKey, () => {
      this.readDevice();
      return action();
    });
  }

  protected async readData(): Promise<AppDataSchema> {
    this.readDevice();
    if (!this.device) throw new Error('Open your account planner online once to make it available offline.');
    return structuredClone(this.getSnapshot());
  }

  protected async writeData(data: AppDataSchema, replace: boolean): Promise<void> {
    const device = this.device!;
    // Use the same normalized shape locally and in the cloud. In particular,
    // deleted tasks lose references to projects that were later removed.
    const draft = parseData(data);
    if (!device.upload && sameValue(draft, device.base.data)) {
      this.saveDevice({ base: device.base });
      return;
    }
    this.saveDevice({
      ...device,
      draft,
      replacement: replace ? crypto.randomUUID() : device.replacement,
    });
  }

  protected override async mutate<T>(change: (data: AppDataSchema) => T, replace = false): Promise<T> {
    const result = await this.withDevice(() => super.mutate(change, replace));
    if (this.status.phase !== 'conflict') void this.refresh();
    return result;
  }

  private async readCloud(): Promise<Revision> {
    const result = await this.client.from('planner_workspaces').select('data,revision')
      .eq('user_id', this.userId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
    if (result.error) throw new Error('Could not connect to your account planner.');
    if (result.data) return parseRevision(result.data as Revision);
    const created = await this.client.from('planner_workspaces')
      .insert({ user_id: this.userId, data: emptyWorkspace() }).select('data,revision')
      .abortSignal(AbortSignal.timeout(10_000)).single();
    if (created.error?.code === '23505') {
      // Another tab or device opened the account workspace at the same time.
      const retry = await this.client.from('planner_workspaces').select('data,revision')
        .eq('user_id', this.userId).abortSignal(AbortSignal.timeout(10_000)).single();
      if (!retry.error) return parseRevision(retry.data as Revision);
    }
    if (created.error) throw new Error('Could not open your account planner.');
    return parseRevision(created.data as Revision);
  }

  private prepareUpload(remote: Revision): Upload | undefined {
    const device = this.device;
    if (device && remote.revision < device.base.revision)
      throw new Error('Could not read the latest version of your account planner.');
    if (!device?.draft) {
      this.saveDevice({ base: remote });
      return;
    }

    const { upload, draft } = device;
    let { base, replacement } = device;
    if (upload && remote.revision >= upload.revision) {
      const accepted = sameValue(upload.data, remote.data) ||
        (!upload.replacement && includesWorkspaceChanges(base.data, upload.data, remote.data));
      if (accepted) {
        base = upload;
        if (replacement === upload.replacement) replacement = undefined;
      }
    } else if (upload && remote.revision === base.revision) {
      // Retry the exact snapshot. The previous request may still commit after
      // this read, and later edits must stay based on the snapshot that wins.
      return upload;
    }

    if (replacement && !sameValue(base.data, remote.data))
      throw new WorkspaceConflict('Your cloud planner changed after you replaced the planner on this device.');

    const data = replacement ? draft : mergeWorkspace(base.data, draft, remote.data);
    if (sameValue(data, remote.data)) {
      this.saveDevice({ base: remote });
      return;
    }
    const next = { revision: remote.revision + 1, data, replacement };
    this.saveDevice({ base: remote, draft: data, upload: next, replacement });
    return next;
  }

  private async sync() {
    for (let attempt = 0; attempt < 4 && navigator.onLine; attempt++) {
      const remote = await this.readCloud();
      const upload = await this.withDevice(() => this.prepareUpload(remote));
      if (!upload) return;
      const result = await this.client.from('planner_workspaces')
        .update({ data: upload.data, revision: upload.revision, updated_at: new Date().toISOString() })
        .eq('user_id', this.userId).eq('revision', upload.revision - 1).select('revision')
        .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
      if (result.error) {
        // A definitive client error did not write anything. Only ambiguous
        // failures need to keep the exact upload for the next retry.
        if (result.status >= 400 && result.status < 500 && ![408, 429].includes(result.status)) {
          await this.withDevice(() => {
            if (this.device) this.saveDevice({ ...this.device, upload: undefined });
          });
        }
        throw new Error('Could not sync with your account planner.');
      }
      if (!result.data) continue; // Another device wrote first. Read and merge again.
      const pending = await this.withDevice(() => {
        const device = this.device!;
        const base = { revision: upload.revision, data: upload.data };
        const draft = sameValue(device.draft, upload.data) ? undefined : device.draft;
        this.saveDevice({
          base, draft,
          replacement: draft && device.replacement !== upload.replacement ? device.replacement : undefined,
        });
        return draft !== undefined;
      });
      if (!pending) return;
    }
    if (navigator.onLine) throw new Error('Your planner is receiving other changes. Try syncing again in a moment.');
  }

  refresh = (): Promise<void> => {
    this.reloadDevice();
    if (!navigator.onLine) {
      this.publish('offline', '');
      return Promise.resolve();
    }
    if (this.syncing) {
      this.syncRequested = true;
      return this.syncing;
    }
    if (!navigator.locks) {
      this.publish('error', 'Open Todop in a browser that supports account sync.');
      return Promise.resolve();
    }
    this.syncing = navigator.locks.request(`${this.cacheKey}:sync`, async () => {
      if (this.status.phase !== 'conflict') this.publish('syncing', '');
      await this.sync();
      this.publish(navigator.onLine ? 'idle' : 'offline', '');
    }).catch((error: unknown) => {
      if (error instanceof WorkspaceConflict) this.publish('conflict', error.message);
      else if (!navigator.onLine) this.publish('offline', '');
      else this.publish('error', error instanceof Error ? error.message : 'Could not sync your account planner.');
    }).finally(() => {
      this.syncing = null;
      if (this.syncRequested) {
        this.syncRequested = false;
        void this.refresh();
      }
    });
    return this.syncing;
  };

  useCloudVersion = async () => {
    const expectedDraft = this.device?.draft;
    try {
      await navigator.locks.request(`${this.cacheKey}:sync`, async () => {
        const remote = await this.readCloud();
        await this.withDevice(() => {
          if (!sameValue(expectedDraft, this.device?.draft))
            throw new WorkspaceConflict('This device has newer edits. Review them before choosing the cloud version.');
          this.saveDevice({ base: remote });
          this.publish('idle', '');
        });
      });
    } catch (error) {
      this.publish('conflict', error instanceof Error ? error.message : 'Could not load the cloud version.');
    }
  };
}
