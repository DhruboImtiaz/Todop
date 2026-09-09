import type { Log, Project, Settings } from '../../types';

export interface NewLogInput {
  title: string;
  description?: string;
  deadline: string; // ISO 8601 string
  projectId?: string | null;
}

export interface UpdateLogInput {
  id: string;
  title?: string;
  description?: string;
  deadline?: string;
  projectId?: string | null;
  completed?: boolean;
}

export type StorageListener = () => void;

export interface StorageRepository {
  // Logs
  getLogs(): Promise<Log[]>;
  getActiveLogs(): Promise<Log[]>;
  getCompletedLogs(): Promise<Log[]>;
  getLogById(id: string): Promise<Log | null>;
  createLog(input: NewLogInput): Promise<Log>;
  updateLog(input: UpdateLogInput): Promise<Log>;
  toggleLogCompletion(id: string): Promise<Log | null>;
  deleteLog(id: string): Promise<boolean>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProjectById(id: string): Promise<Project | null>;
  createProject(name: string): Promise<Project>;
  updateProject(id: string, name: string): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;
  reorderProjects(projectIds: string[]): Promise<Project[]>;
  moveProject(id: string, direction: 'up' | 'down'): Promise<Project[]>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  // Event Subscription
  subscribe(listener: StorageListener): () => void;
}
