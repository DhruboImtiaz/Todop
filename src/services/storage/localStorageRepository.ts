import { DEFAULT_SETTINGS, STORAGE_KEY, LEGACY_STORAGE_KEY, isFontSize } from '../../utils/settings';
import type { AppDataSchema, Subtask } from '../../types';
import type { StorageListener } from './storageRepository';
import { createBackup, validateBackup } from '../../utils/backup';
import { PlannerRepository } from './plannerRepository';

const CURRENT_SCHEMA_VERSION = 2;

export class LocalStorageRepository extends PlannerRepository {
  private key: string;
  private seed?: AppDataSchema;
  private listeners: Set<StorageListener> = new Set();
  private cachedData: AppDataSchema | null = null;

  constructor(privateKey = STORAGE_KEY, seed?: AppDataSchema) {
    super();
    this.key = privateKey;
    this.seed = seed;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', (event) => {
        if (event.key === this.key || event.key === null) {
          this.cachedData = this.loadRawData();
          this.notifyListeners();
        }
      });
    }
  }

  public getSnapshot(): AppDataSchema {
    if (!this.cachedData) {
      this.cachedData = this.loadRawData();
    }
    return this.cachedData;
  }

  private loadRawData(): AppDataSchema {
    try {
      const raw = localStorage.getItem(this.key) ?? (this.key === STORAGE_KEY ? localStorage.getItem(LEGACY_STORAGE_KEY) : null);
      if (!raw) {
        return this.initializeStorage();
      }
      const parsed = JSON.parse(raw) as AppDataSchema;
      if (!parsed || typeof parsed.version !== 'number') {
        return this.initializeStorage();
      }

      // Ensure backward-compatibility: normalize undefined projectId to null, and missing subtasks to []
      let modified = parsed.version === 1 || parsed.trash === undefined;
      if (parsed.trash === undefined) parsed.trash = [];
      if (parsed.version === 1) parsed.version = 2;
      if (Array.isArray(parsed.logs)) {
        for (const log of parsed.logs) {
          if (log.projectId === undefined) {
            log.projectId = null;
            modified = true;
          }
          if (!Array.isArray(log.subtasks)) {
            log.subtasks = [];
            modified = true;
          } else {
            // Defensively normalize subtasks: eliminate malformed entries and trim strings
            const validSubtasks: Subtask[] = [];
            let subtasksModified = false;
            for (const st of log.subtasks) {
              if (
                st &&
                typeof st === 'object' &&
                typeof st.id === 'string' &&
                st.id.trim() &&
                typeof st.title === 'string' &&
                st.title.trim() &&
                typeof st.completed === 'boolean' &&
                typeof st.createdAt === 'string' &&
                typeof st.updatedAt === 'string'
              ) {
                validSubtasks.push({
                  id: st.id,
                  title: st.title.trim(),
                  completed: st.completed,
                  createdAt: st.createdAt,
                  updatedAt: st.updatedAt,
                });
              } else {
                subtasksModified = true;
              }
            }
            if (subtasksModified || validSubtasks.length !== log.subtasks.length) {
              log.subtasks = validSubtasks;
              modified = true;
            }
          }
        }
      } else {
        parsed.logs = [];
        modified = true;
      }

      if (!Array.isArray(parsed.projects)) {
        parsed.projects = [];
        modified = true;
      }

      // Keep projects sorted by order, and normalize order indices deterministically
      parsed.projects.sort((a, b) => a.order - b.order);
      for (let i = 0; i < parsed.projects.length; i++) {
        if (parsed.projects[i].order !== i) {
          parsed.projects[i].order = i;
          modified = true;
        }
      }

      // Defensive normalization: only set a log's projectId to null when that referenced project genuinely does not exist.
      // Valid project relationships are strictly preserved.
      const validProjectIds = new Set(parsed.projects.map((p) => p.id));
      for (const log of parsed.logs) {
        if (log.projectId !== null && !validProjectIds.has(log.projectId)) {
          log.projectId = null;
          modified = true;
        }
      }

      // Normalize settings
      if (!parsed.settings || typeof parsed.settings !== 'object') {
        parsed.settings = { ...DEFAULT_SETTINGS };
        modified = true;
      } else {
        if (parsed.settings.theme !== 'dark' && parsed.settings.theme !== 'light') {
          parsed.settings.theme = 'light';
          modified = true;
        }
        if (!isFontSize(parsed.settings.fontSize)) {
          parsed.settings.fontSize = 'medium';
          modified = true;
        }
      }

      const validation = validateBackup(createBackup(parsed));
      if (!validation.valid) throw new Error(validation.error);

      if (modified) {
        this.persistRawData(parsed);
      }

      return parsed;
    } catch (e) {
      console.error('Failed to parse TODOP storage data; retaining a recovery copy', e);
      const original = localStorage.getItem(this.key);
      if (original) localStorage.setItem(`${this.key}_recovery`, original);
      return this.initializeStorage();
    }
  }

  private initializeStorage(): AppDataSchema {
    const initial: AppDataSchema = {
      version: CURRENT_SCHEMA_VERSION,
      logs: [],
      trash: [],
      projects: [],
      settings: DEFAULT_SETTINGS,
    };
    const data = this.seed ? structuredClone(this.seed) : initial;
    this.persistRawData(data);
    return data;
  }

  private persistRawData(data: AppDataSchema): void {
    const previousCached = this.cachedData;
    try {
      // Sort projects by order
      data.projects.sort((a, b) => a.order - b.order);
      const json = JSON.stringify(data);
      localStorage.setItem(this.key, json);
      this.cachedData = data;
      this.notifyListeners();
    } catch (e) {
      this.cachedData = previousCached;
      console.error('Failed to write TODOP storage data to localStorage', e);
      throw e;
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Error in storage listener', e);
      }
    }
  }

  public subscribe(listener: StorageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  protected async readData(): Promise<AppDataSchema> {
    return this.loadRawData();
  }

  protected async writeData(data: AppDataSchema): Promise<void> {
    this.persistRawData(data);
  }
}

export const defaultStorageRepository = new LocalStorageRepository();
