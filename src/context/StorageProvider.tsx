import { applyAppearance } from '../utils/settings';
import React, { useSyncExternalStore, useCallback, useMemo, useState } from 'react';
import type { AppDataSchema, Settings } from '../types';
import type { NewLogInput, StorageRepository, UpdateLogInput } from '../services/storage/storageRepository';
import { defaultStorageRepository } from '../services/storage/localStorageRepository';
import { StorageContext } from './StorageContextCore';
import type { StorageContextValue } from './StorageContextCore';

export const StorageProvider: React.FC<{
  repository?: StorageRepository;
  children: React.ReactNode;
}> = ({ repository = defaultStorageRepository, children }) => {
  const store = repository;
  const [error, setError] = useState('');
  const attempt = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    try { const result = await operation(); setError(''); return result; }
    catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your change could not be saved. Please try again.');
      throw failure;
    }
  }, []);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return store.subscribe(onStoreChange);
    },
    [store]
  );

  const getSnapshot = useCallback((): AppDataSchema => {
    return store.getSnapshot();
  }, [store]);

  const rawData = useSyncExternalStore(subscribe, getSnapshot);

  const activeLogs = useMemo(() => {
    return rawData.logs.filter((log) => !log.completed);
  }, [rawData.logs]);

  const completedLogs = useMemo(() => {
    return rawData.logs.filter((log) => log.completed);
  }, [rawData.logs]);

  const projects = rawData.projects;
  const settings = rawData.settings;

  const createLog = useCallback(
    async (input: NewLogInput) => {
      return attempt(() => repository.createLog(input));
    },
    [repository, attempt]
  );

  const updateLog = useCallback(
    async (input: UpdateLogInput) => {
      return attempt(() => repository.updateLog(input));
    },
    [repository, attempt]
  );

  const toggleLogCompletion = useCallback(
    async (id: string) => {
      return attempt(() => repository.toggleLogCompletion(id));
    },
    [repository, attempt]
  );

  const deleteLog = useCallback(
    async (id: string) => {
      return attempt(() => repository.deleteLog(id));
    },
    [repository, attempt]
  );

  const addSubtask = useCallback(
    async (logId: string, title: string) => {
      return attempt(() => repository.addSubtask(logId, title));
    },
    [repository, attempt]
  );

  const updateSubtaskTitle = useCallback(
    async (logId: string, subtaskId: string, title: string) => {
      return attempt(() => repository.updateSubtaskTitle(logId, subtaskId, title));
    },
    [repository, attempt]
  );

  const toggleSubtaskCompletion = useCallback(
    async (logId: string, subtaskId: string) => {
      return attempt(() => repository.toggleSubtaskCompletion(logId, subtaskId));
    },
    [repository, attempt]
  );

  const deleteSubtask = useCallback(
    async (logId: string, subtaskId: string) => {
      return attempt(() => repository.deleteSubtask(logId, subtaskId));
    },
    [repository, attempt]
  );

  const createProject = useCallback(
    async (name: string) => {
      return attempt(() => repository.createProject(name));
    },
    [repository, attempt]
  );

  const updateProject = useCallback(
    async (id: string, name: string) => {
      return attempt(() => repository.updateProject(id, name));
    },
    [repository, attempt]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      return attempt(() => repository.deleteProject(id));
    },
    [repository, attempt]
  );

  const reorderProjects = useCallback(
    async (projectIds: string[]) => {
      return attempt(() => repository.reorderProjects(projectIds));
    },
    [repository, attempt]
  );

  const moveProject = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      return attempt(() => repository.moveProject(id, direction));
    },
    [repository, attempt]
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      return attempt(() => repository.updateSettings(patch));
    },
    [repository, attempt]
  );

  const exportData = useCallback(async () => {
    return repository.exportData();
  }, [repository]);

  const importData = useCallback(
    async (data: AppDataSchema) => {
      return repository.importData(data);
    },
    [repository]
  );

  // Synchronize data-theme, data-font-size, and meta theme-color immediately when settings change
  React.useEffect(() => {
    applyAppearance(settings);
  }, [settings]);

  const value = useMemo<StorageContextValue>(
    () => ({
      repository,
      error,
      activeLogs,
      completedLogs,
      projects,
      settings,
      loading: false,
      dismissError: () => setError(''),
      createLog,
      updateLog,
      toggleLogCompletion,
      deleteLog,
      addSubtask,
      updateSubtaskTitle,
      toggleSubtaskCompletion,
      deleteSubtask,
      createProject,
      updateProject,
      deleteProject,
      reorderProjects,
      moveProject,
      updateSettings,
      exportData,
      importData,
    }),
    [
      repository,
      error,
      activeLogs,
      completedLogs,
      projects,
      settings,
      createLog,
      updateLog,
      toggleLogCompletion,
      deleteLog,
      addSubtask,
      updateSubtaskTitle,
      toggleSubtaskCompletion,
      deleteSubtask,
      createProject,
      updateProject,
      deleteProject,
      reorderProjects,
      moveProject,
      updateSettings,
      exportData,
      importData,
    ]
  );

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
};

