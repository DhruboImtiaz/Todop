import { applyAppearance } from "../utils/settings";
import React, {
  useSyncExternalStore,
  useCallback,
  useMemo,
  useState,
} from "react";
import type { AppDataSchema, Settings, Log } from "../types";
import type {
  NewLogInput,
  StorageRepository,
  UpdateLogInput,
} from "../services/storage/storageRepository";
import { defaultStorageRepository } from "../services/storage/localStorageRepository";
import { StorageContext } from "./StorageContextCore";
import type { StorageContextValue } from "./StorageContextCore";

export const StorageProvider: React.FC<{
  repository?: StorageRepository;
  children: React.ReactNode;
}> = ({ repository = defaultStorageRepository, children }) => {
  const store = repository;
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<StorageContextValue["undo"]>(null);
  const attempt = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      try {
        const result = await operation();
        setError("");
        return result;
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Your change could not be saved. Please try again.",
        );
        throw failure;
      }
    },
    [],
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return store.subscribe(onStoreChange);
    },
    [store],
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
    [repository, attempt],
  );

  const updateLog = useCallback(
    async (input: UpdateLogInput) => {
      return attempt(() => repository.updateLog(input));
    },
    [repository, attempt],
  );

  const toggleLogCompletion = useCallback(
    async (id: string) => {
      return attempt(async () => {
        const change = await repository.changeLogCompletion(id);
        const previous = change?.previous;
        const updated = change?.updated;
        if (previous && updated)
          setUndo({
            message: updated.completed ? "Task completed" : "Task reopened",
            expiresAt: Date.now() + 12000,
            action: async () => {
              await attempt(() =>
                repository.undoCompletion(previous, updated.updatedAt),
              );
              setUndo(null);
            },
          });
        return updated ?? null;
      });
    },
    [repository, attempt],
  );

  const deleteLog = useCallback(
    async (id: string) => {
      return attempt(async () => {
        const deleted = await repository.deleteLog(id);
        if (deleted)
          setUndo({
            message: "Task moved to recently deleted",
            expiresAt: Date.now() + 12000,
            action: async () => {
              await attempt(() => repository.restoreLog(id));
              setUndo(null);
            },
          });
        return deleted;
      });
    },
    [repository, attempt],
  );

  const addSubtask = useCallback(
    async (logId: string, title: string) => {
      return attempt(() => repository.addSubtask(logId, title));
    },
    [repository, attempt],
  );

  const updateSubtaskTitle = useCallback(
    async (logId: string, subtaskId: string, title: string) => {
      return attempt(() =>
        repository.updateSubtaskTitle(logId, subtaskId, title),
      );
    },
    [repository, attempt],
  );

  const toggleSubtaskCompletion = useCallback(
    async (logId: string, subtaskId: string) => {
      return attempt(() =>
        repository.toggleSubtaskCompletion(logId, subtaskId),
      );
    },
    [repository, attempt],
  );

  const deleteSubtask = useCallback(
    async (logId: string, subtaskId: string) => {
      return attempt(() => repository.deleteSubtask(logId, subtaskId));
    },
    [repository, attempt],
  );

  const createProject = useCallback(
    async (name: string) => {
      return attempt(() => repository.createProject(name));
    },
    [repository, attempt],
  );

  const updateProject = useCallback(
    async (id: string, name: string) => {
      return attempt(() => repository.updateProject(id, name));
    },
    [repository, attempt],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      return attempt(() => repository.deleteProject(id));
    },
    [repository, attempt],
  );

  const reorderProjects = useCallback(
    async (projectIds: string[]) => {
      return attempt(() => repository.reorderProjects(projectIds));
    },
    [repository, attempt],
  );

  const moveProject = useCallback(
    async (id: string, direction: "up" | "down") => {
      return attempt(() => repository.moveProject(id, direction));
    },
    [repository, attempt],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      return attempt(() => repository.updateSettings(patch));
    },
    [repository, attempt],
  );

  const exportData = useCallback(async () => {
    return repository.exportData();
  }, [repository]);

  const importData = useCallback(
    async (data: AppDataSchema) => {
      const imported = await repository.importData(data);
      setUndo(null);
      return imported;
    },
    [repository],
  );

  const restoreLog = useCallback(
    (id: string) => attempt(() => repository.restoreLog(id)),
    [repository, attempt],
  );
  const planMyDay = useCallback(
    (id: string, date: string | null): Promise<Log> =>
      attempt(() => repository.planMyDay(id, date)),
    [repository, attempt],
  );
  const deletedLogs = useMemo(() => rawData.trash ?? [], [rawData.trash]);

  // Synchronize data-theme, data-font-size, and meta theme-color immediately when settings change
  React.useEffect(() => {
    applyAppearance(settings);
  }, [settings]);

  const value = useMemo<StorageContextValue>(
    () => ({
      repository,
      undo,
      deletedLogs,
      restoreLog,
      planMyDay,
      error,
      activeLogs,
      completedLogs,
      projects,
      settings,
      loading: false,
      dismissUndo: () => setUndo(null),
      dismissError: () => setError(""),
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
      undo,
      deletedLogs,
      restoreLog,
      planMyDay,
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
    ],
  );

  return (
    <StorageContext.Provider value={value}>{children}</StorageContext.Provider>
  );
};
