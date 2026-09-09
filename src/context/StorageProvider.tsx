import React, { useSyncExternalStore, useCallback, useMemo } from 'react';
import type { AppDataSchema } from '../types';
import type { NewLogInput, StorageRepository, UpdateLogInput } from '../services/storage/storageRepository';
import { defaultStorageRepository, LocalStorageRepository } from '../services/storage/localStorageRepository';
import { StorageContext } from './StorageContextCore';
import type { StorageContextValue } from './StorageContextCore';

export const StorageProvider: React.FC<{
  repository?: StorageRepository;
  children: React.ReactNode;
}> = ({ repository = defaultStorageRepository, children }) => {
  const store = repository as LocalStorageRepository;

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
      return repository.createLog(input);
    },
    [repository]
  );

  const updateLog = useCallback(
    async (input: UpdateLogInput) => {
      return repository.updateLog(input);
    },
    [repository]
  );

  const toggleLogCompletion = useCallback(
    async (id: string) => {
      return repository.toggleLogCompletion(id);
    },
    [repository]
  );

  const deleteLog = useCallback(
    async (id: string) => {
      return repository.deleteLog(id);
    },
    [repository]
  );

  const createProject = useCallback(
    async (name: string) => {
      return repository.createProject(name);
    },
    [repository]
  );

  const updateProject = useCallback(
    async (id: string, name: string) => {
      return repository.updateProject(id, name);
    },
    [repository]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      return repository.deleteProject(id);
    },
    [repository]
  );

  const reorderProjects = useCallback(
    async (projectIds: string[]) => {
      return repository.reorderProjects(projectIds);
    },
    [repository]
  );

  const moveProject = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      return repository.moveProject(id, direction);
    },
    [repository]
  );

  const value = useMemo<StorageContextValue>(
    () => ({
      repository,
      activeLogs,
      completedLogs,
      projects,
      settings,
      loading: false,
      createLog,
      updateLog,
      toggleLogCompletion,
      deleteLog,
      createProject,
      updateProject,
      deleteProject,
      reorderProjects,
      moveProject,
    }),
    [
      repository,
      activeLogs,
      completedLogs,
      projects,
      settings,
      createLog,
      updateLog,
      toggleLogCompletion,
      deleteLog,
      createProject,
      updateProject,
      deleteProject,
      reorderProjects,
      moveProject,
    ]
  );

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
};
