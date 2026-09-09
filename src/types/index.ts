export interface Log {
  id: string;
  title: string;
  description?: string;
  deadline: string; // ISO 8601 string, machine-readable
  projectId: string | null;
  completed: boolean;
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

export type AppTheme = 'dark' | 'light';
export type AppFontSize = 'small' | 'medium' | 'large';

export interface Settings {
  theme: AppTheme;
  fontSize: AppFontSize;
}

export interface AppDataSchema {
  version: number;
  logs: Log[];
  projects: Project[];
  settings: Settings;
}

export type NavigationTab = 'upcoming' | 'projects' | 'search' | 'settings';

export interface AppRoute {
  tab: NavigationTab;
  projectId?: string | null;
}

export type LogSectionType = 'overdue' | 'today' | 'upcoming';
