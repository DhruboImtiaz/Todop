import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppDataSchema } from '../../types';
import type { StorageListener } from './storageRepository';
import { DEFAULT_SETTINGS } from '../../utils/settings';
import { validateBackup } from '../../utils/backup';
import { PlannerRepository } from './plannerRepository';

export const emptyWorkspace = (): AppDataSchema => ({ version: 2, logs: [], trash: [], projects: [], settings: { ...DEFAULT_SETTINGS } });

/** One atomic, versioned workspace per user. Cloud data never enters guest storage. */
export class SupabaseRepository extends PlannerRepository {
  private snapshot = emptyWorkspace();
  private listeners = new Set<StorageListener>();
  private revisions = new WeakMap<AppDataSchema, number>();
  private lastRevision = -1;

  private client: SupabaseClient;
  private userId: string;
  constructor(client: SupabaseClient, userId: string) { super(); this.client = client; this.userId = userId; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: StorageListener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(data: AppDataSchema, revision: number) {
    // Ignore responses that arrived after a newer write or read.
    if (revision <= this.lastRevision) return;
    this.lastRevision = revision;
    this.snapshot = data;
    this.listeners.forEach(listener => listener());
  }

  async refresh(): Promise<void> { await this.readData(); }

  protected async readData(): Promise<AppDataSchema> {
    const result = await this.client.from('planner_workspaces').select('data,revision').eq('user_id', this.userId).maybeSingle();
    if (result.error) throw new Error(`Could not load your workspace: ${result.error.message}`);
    let row = result.data;
    if (!row) {
      const created = await this.client.from('planner_workspaces')
        .insert({ user_id: this.userId, data: emptyWorkspace() }).select('data,revision').single();
      if (created.error?.code === '23505') return this.readData(); // Another tab initialized it first.
      if (created.error) throw new Error(`Could not create your workspace: ${created.error.message}`);
      row = created.data;
    }
    const validation = validateBackup({ app: 'todop', backupVersion: 1, exportedAt: new Date().toISOString(),
      data: { ...row.data, schemaVersion: row.data.version } });
    if (!validation.valid) throw new Error('Your cloud workspace has invalid data. Please contact support before making changes.');
    this.publish(validation.data, row.revision);
    const data = structuredClone(validation.data);
    this.revisions.set(data, row.revision);
    return data;
  }

  protected async writeData(data: AppDataSchema): Promise<void> {
    const revision = this.revisions.get(data);
    if (revision === undefined) throw new Error('Workspace must be loaded before saving');
    const result = await this.client.from('planner_workspaces')
      .update({ data, revision: revision + 1, updated_at: new Date().toISOString() })
      .eq('user_id', this.userId).eq('revision', revision).select('revision').maybeSingle();
    if (result.error) throw new Error(`Could not save. Your changes were not saved: ${result.error.message}`);
    if (!result.data) {
      await this.refresh();
      throw new Error('Your planner changed in another tab or device. The latest version is loaded. Please try your change again.');
    }
    this.publish(data, result.data.revision);
  }

}
