import type { AppDataSchema, Log, Project, Settings } from '../../types';
import type { NewLogInput, StorageListener, StorageRepository, UpdateLogInput } from './storageRepository';

const STORAGE_KEY = 'todop_app_data_v1';
const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  fontSize: 'medium',
};

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `todop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class LocalStorageRepository implements StorageRepository {
  private listeners: Set<StorageListener> = new Set();
  private cachedData: AppDataSchema | null = null;

  public getSnapshot(): AppDataSchema {
    if (!this.cachedData) {
      this.cachedData = this.loadRawData();
    }
    return this.cachedData;
  }

  private loadRawData(): AppDataSchema {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return this.initializeStorage();
      }
      const parsed = JSON.parse(raw) as AppDataSchema;
      if (!parsed || typeof parsed.version !== 'number') {
        return this.initializeStorage();
      }

      // Ensure backward-compatibility: normalize undefined projectId to null
      let modified = false;
      if (Array.isArray(parsed.logs)) {
        for (const log of parsed.logs) {
          if (log.projectId === undefined) {
            log.projectId = null;
            modified = true;
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

      // Keep projects sorted by order
      parsed.projects.sort((a, b) => a.order - b.order);

      // Normalize settings
      if (!parsed.settings || typeof parsed.settings !== 'object') {
        parsed.settings = { ...DEFAULT_SETTINGS };
        modified = true;
      } else {
        if (parsed.settings.theme !== 'dark' && parsed.settings.theme !== 'light') {
          parsed.settings.theme = 'light';
          modified = true;
        }
        if (
          parsed.settings.fontSize !== 'small' &&
          parsed.settings.fontSize !== 'medium' &&
          parsed.settings.fontSize !== 'large'
        ) {
          parsed.settings.fontSize = 'medium';
          modified = true;
        }
      }

      if (modified) {
        this.persistRawData(parsed);
      }

      return parsed;
    } catch (e) {
      console.error('Failed to parse TODOP storage data, initializing fresh schema', e);
      return this.initializeStorage();
    }
  }

  private initializeStorage(): AppDataSchema {
    const initial: AppDataSchema = {
      version: CURRENT_SCHEMA_VERSION,
      logs: [],
      projects: [],
      settings: DEFAULT_SETTINGS,
    };
    this.persistRawData(initial);
    return initial;
  }

  private persistRawData(data: AppDataSchema): void {
    const previousCached = this.cachedData;
    try {
      // Sort projects by order
      data.projects.sort((a, b) => a.order - b.order);
      const json = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, json);
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

  public async getLogs(): Promise<Log[]> {
    const data = this.loadRawData();
    return [...data.logs];
  }

  public async getActiveLogs(): Promise<Log[]> {
    const data = this.loadRawData();
    return data.logs.filter((log) => !log.completed);
  }

  public async getCompletedLogs(): Promise<Log[]> {
    const data = this.loadRawData();
    return data.logs.filter((log) => log.completed);
  }

  public async getLogById(id: string): Promise<Log | null> {
    const data = this.loadRawData();
    const found = data.logs.find((log) => log.id === id);
    return found ? { ...found } : null;
  }

  public async createLog(input: NewLogInput): Promise<Log> {
    const data = this.loadRawData();
    const now = new Date().toISOString();

    const newLog: Log = {
      id: generateId(),
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      deadline: input.deadline,
      projectId: input.projectId !== undefined ? input.projectId : null,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    data.logs.push(newLog);
    this.persistRawData(data);
    return newLog;
  }

  public async updateLog(input: UpdateLogInput): Promise<Log> {
    const data = this.loadRawData();
    const index = data.logs.findIndex((log) => log.id === input.id);
    if (index === -1) {
      throw new Error(`Log with id "${input.id}" not found`);
    }

    const current = data.logs[index];
    const updated: Log = {
      ...current,
      title: input.title !== undefined ? input.title.trim() : current.title,
      description: input.description !== undefined ? input.description.trim() || undefined : current.description,
      deadline: input.deadline !== undefined ? input.deadline : current.deadline,
      projectId: input.projectId !== undefined ? input.projectId : current.projectId ?? null,
      completed: input.completed !== undefined ? input.completed : current.completed,
      updatedAt: new Date().toISOString(),
    };

    data.logs[index] = updated;
    this.persistRawData(data);
    return updated;
  }

  public async toggleLogCompletion(id: string): Promise<Log | null> {
    const data = this.loadRawData();
    const index = data.logs.findIndex((log) => log.id === id);
    if (index === -1) return null;

    const current = data.logs[index];
    const updated: Log = {
      ...current,
      completed: !current.completed,
      updatedAt: new Date().toISOString(),
    };

    data.logs[index] = updated;
    this.persistRawData(data);
    return updated;
  }

  public async deleteLog(id: string): Promise<boolean> {
    const data = this.loadRawData();
    const initialLen = data.logs.length;
    data.logs = data.logs.filter((log) => log.id !== id);
    if (data.logs.length !== initialLen) {
      this.persistRawData(data);
      return true;
    }
    return false;
  }

  // --- Projects API ---

  public async getProjects(): Promise<Project[]> {
    const data = this.loadRawData();
    return [...data.projects].sort((a, b) => a.order - b.order);
  }

  public async getProjectById(id: string): Promise<Project | null> {
    const data = this.loadRawData();
    const found = data.projects.find((p) => p.id === id);
    return found ? { ...found } : null;
  }

  public async createProject(name: string): Promise<Project> {
    const data = this.loadRawData();
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Project name cannot be empty');
    }

    const now = new Date().toISOString();
    const nextOrder = data.projects.length > 0
      ? Math.max(...data.projects.map((p) => p.order)) + 1
      : 0;

    const newProject: Project = {
      id: generateId(),
      name: cleanName,
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
    };

    data.projects.push(newProject);
    this.persistRawData(data);
    return newProject;
  }

  public async updateProject(id: string, name: string): Promise<Project> {
    const data = this.loadRawData();
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Project name cannot be empty');
    }

    const index = data.projects.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Project with id "${id}" not found`);
    }

    const current = data.projects[index];
    const updated: Project = {
      ...current,
      name: cleanName,
      updatedAt: new Date().toISOString(),
    };

    data.projects[index] = updated;
    this.persistRawData(data);
    return updated;
  }

  public async deleteProject(id: string): Promise<boolean> {
    const data = this.loadRawData();
    const initialLen = data.projects.length;
    data.projects = data.projects.filter((p) => p.id !== id);

    if (data.projects.length === initialLen) {
      return false;
    }

    // Set projectId to null for all associated logs, updating their updatedAt, preserving all logs!
    const now = new Date().toISOString();
    for (const log of data.logs) {
      if (log.projectId === id) {
        log.projectId = null;
        log.updatedAt = now;
      }
    }

    // Normalize remaining projects order
    data.projects.sort((a, b) => a.order - b.order);
    data.projects.forEach((p, index) => {
      p.order = index;
    });

    this.persistRawData(data);
    return true;
  }

  public async reorderProjects(projectIds: string[]): Promise<Project[]> {
    const data = this.loadRawData();
    const idMap = new Map(projectIds.map((id, index) => [id, index]));
    const now = new Date().toISOString();

    for (const project of data.projects) {
      const newOrder = idMap.get(project.id);
      if (newOrder !== undefined) {
        project.order = newOrder;
        project.updatedAt = now;
      }
    }

    data.projects.sort((a, b) => a.order - b.order);
    this.persistRawData(data);
    return [...data.projects];
  }

  public async moveProject(id: string, direction: 'up' | 'down'): Promise<Project[]> {
    const data = this.loadRawData();
    const sorted = [...data.projects].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((p) => p.id === id);

    if (index === -1) {
      return sorted;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) {
      return sorted;
    }

    // Swap positions
    const temp = sorted[index];
    sorted[index] = sorted[targetIndex];
    sorted[targetIndex] = temp;

    // Normalize order index
    const now = new Date().toISOString();
    sorted.forEach((p, i) => {
      p.order = i;
      p.updatedAt = now;
    });

    data.projects = sorted;
    this.persistRawData(data);
    return [...data.projects];
  }

  // --- Settings API ---

  public async getSettings(): Promise<Settings> {
    const data = this.loadRawData();
    return { ...data.settings };
  }

  public async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const data = this.loadRawData();
    data.settings = { ...data.settings, ...patch };
    this.persistRawData(data);
    return { ...data.settings };
  }

  // --- Backup & Restore API ---


  public async exportData(): Promise<AppDataSchema> {
    const data = this.loadRawData();
    return JSON.parse(JSON.stringify(data));
  }

  public async importData(data: AppDataSchema): Promise<boolean> {
    const clone: AppDataSchema = JSON.parse(JSON.stringify(data));
    if (!clone.version) {
      clone.version = CURRENT_SCHEMA_VERSION;
    }
    // Normalize projects order
    if (Array.isArray(clone.projects)) {
      clone.projects.sort((a, b) => a.order - b.order);
      clone.projects.forEach((p, index) => {
        p.order = index;
      });
    }
    this.persistRawData(clone);
    return true;
  }
}

// Singleton instance for repository
export const defaultStorageRepository = new LocalStorageRepository();

