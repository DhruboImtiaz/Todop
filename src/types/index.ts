export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

export type TaskPriority = 'normal' | 'high' | 'low';
export interface RecurrenceRule { frequency: 'daily' | 'weekly' | 'monthly'; interval: number; anchorDay?: number }
export interface DeletedLog { log: Log; deletedAt: string }

export interface Log {
  id: string;
  title: string;
  description?: string;
  deadline?: string; // ISO 8601 string, machine-readable, optional for project logs
  priority?: TaskPriority;
  myDay?: string;
  recurrence?: RecurrenceRule;
  seriesId?: string;
  nextOccurrenceId?: string;
  projectId: string | null;
  completed: boolean;
  subtasks: Subtask[];
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}

export interface Project {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface LogFormValues {
  priority?: TaskPriority;
  recurrence?: RecurrenceRule;
  title: string;
  description?: string;
  deadline?: string;
  projectId?: string;
  draftSubtasks?: string[];
}

export type AppTheme = 'dark' | 'light';
export type AppFontSize = 'xs' | 'small' | 'medium' | 'large';


export interface Settings {
  theme: AppTheme;
  fontSize: AppFontSize;
}

export interface AppDataSchema {
  version: number;
  logs: Log[];
  trash?: DeletedLog[];
  projects: Project[];
  settings: Settings;
}

export type NavigationTab = 'today' | 'trash' | 'upcoming' | 'projects' | 'calendar' | 'search' | 'settings';

export interface AppRoute {
  tab: NavigationTab;
  projectId?: string | null;
}

export type LogSectionType = 'overdue' | 'today' | 'upcoming';
