import { createContext } from 'react';
import type { Log, Project, Settings } from '../types';
import type { NewLogInput, StorageRepository, UpdateLogInput } from '../services/storage/storageRepository';

export interface StorageContextValue {
  repository: StorageRepository;
  activeLogs: Log[];
  completedLogs: Log[];
  projects: Project[];
  settings: Settings | null;
  loading: boolean;
  createLog: (input: NewLogInput) => Promise<Log>;
  updateLog: (input: UpdateLogInput) => Promise<Log>;
  toggleLogCompletion: (id: string) => Promise<Log | null>;
  deleteLog: (id: string) => Promise<boolean>;
  createProject: (name: string) => Promise<Project>;
  updateProject: (id: string, name: string) => Promise<Project>;
  deleteProject: (id: string) => Promise<boolean>;
  reorderProjects: (projectIds: string[]) => Promise<Project[]>;
  moveProject: (id: string, direction: 'up' | 'down') => Promise<Project[]>;
}

export const StorageContext = createContext<StorageContextValue | null>(null);
