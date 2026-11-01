import type { AppDataSchema, Log, Project, Settings, Subtask, TaskPriority, RecurrenceRule } from '../../types';

export interface NewLogInput {
  priority?: TaskPriority;
  recurrence?: RecurrenceRule;
  title: string;
  description?: string;
  deadline?: string; // ISO 8601 string, optional for project logs
  projectId?: string | null;
  subtasks?: Subtask[];
  draftSubtasks?: string[];
}

export interface UpdateLogInput {
  expectedFields?: Pick<Log, 'title' | 'description' | 'deadline' | 'projectId' | 'priority' | 'recurrence'>;
  id: string;
  priority?: TaskPriority;
  recurrence?: RecurrenceRule;
  title?: string;
  description?: string;
  deadline?: string;
  projectId?: string | null;
  completed?: boolean;
  subtasks?: Subtask[];
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
  changeLogCompletion(id: string): Promise<{ previous: Log; updated: Log } | null>;
  toggleLogCompletion(id: string): Promise<Log | null>;
  deleteLog(id: string): Promise<boolean>;
  restoreLog(id: string): Promise<boolean>;
  planMyDay(id: string, date: string | null): Promise<Log>;
  undoCompletion(previous: Log, expectedUpdatedAt: string): Promise<boolean>;

  // Subtasks
  addSubtask(logId: string, title: string): Promise<Subtask>;
  updateSubtaskTitle(logId: string, subtaskId: string, title: string): Promise<Subtask>;
  toggleSubtaskCompletion(logId: string, subtaskId: string): Promise<Subtask | null>;
  deleteSubtask(logId: string, subtaskId: string): Promise<boolean>;

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

  // Backup & Restore
  exportData(): Promise<AppDataSchema>;
  importData(data: AppDataSchema): Promise<boolean>;

  getSnapshot(): AppDataSchema;

  // Event Subscription
  subscribe(listener: StorageListener): () => void;
}

