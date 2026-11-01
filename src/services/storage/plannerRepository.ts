import {
  isDateKey,
  validRecurrence,
  nextRecurringDeadline,
  TRASH_RETENTION_MS,
} from "../../utils/planning";
import type {
  AppDataSchema,
  Log,
  Project,
  Settings,
  Subtask,
} from "../../types";
import type {
  NewLogInput,
  StorageListener,
  StorageRepository,
  UpdateLogInput,
} from "./storageRepository";
import { createBackup, validateBackup } from "../../utils/backup";
import { isFontSize } from "../../utils/settings";

function stamp(previous?: string): string {
  return new Date(
    Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0),
  ).toISOString();
}
function title(value: string): string {
  if (!value.trim()) throw new Error("Title cannot be empty");
  return value.trim();
}
function createSubtask(value: string, now: string): Subtask {
  return {
    id: crypto.randomUUID(),
    title: title(value),
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}
function validateAssignment(
  data: AppDataSchema,
  input: NewLogInput | UpdateLogInput,
) {
  if (
    input.priority !== undefined &&
    !["normal", "high", "low"].includes(input.priority)
  )
    throw new Error("Invalid priority");
  if (input.recurrence !== undefined && !validRecurrence(input.recurrence))
    throw new Error("Invalid repeat schedule");
  if (
    input.deadline !== undefined &&
    !Number.isFinite(Date.parse(input.deadline))
  )
    throw new Error("Invalid deadline");
  if (input.projectId && !data.projects.some((p) => p.id === input.projectId))
    throw new Error("Project not found");
}
function findLog(data: AppDataSchema, id: string): Log {
  const log = data.logs.find((log) => log.id === id);
  if (!log) throw new Error("Log not found");
  return log;
}
function requireFocusSpace(data: AppDataSchema, id: string, date?: string) {
  if (
    date &&
    data.logs.filter(
      (log) => !log.completed && log.myDay === date && log.id !== id,
    ).length >= 3
  ) {
    throw new Error(
      "Your focus has three tasks. Remove or finish one to make room.",
    );
  }
}
function applyLogUpdate(data: AppDataSchema, input: UpdateLogInput): Log {
  validateAssignment(data, input);
  const current = findLog(data, input.id);
  if (
    input.expectedFields &&
    (
      Object.keys(input.expectedFields) as (keyof typeof input.expectedFields)[]
    ).some(
      (key) =>
        JSON.stringify(input.expectedFields![key]) !==
        JSON.stringify(current[key]),
    )
  ) {
    throw new Error(
      "This task changed since you opened it. Close and reopen it to edit the latest version.",
    );
  }
  const now = stamp(current.updatedAt);
  const completed = input.completed ?? current.completed;
  const subtasks = input.subtasks ?? current.subtasks;
  const updated: Log = {
    ...current,
    priority: input.priority ?? current.priority,
    recurrence: "recurrence" in input ? input.recurrence : current.recurrence,
    title: input.title !== undefined ? title(input.title) : current.title,
    description:
      input.description !== undefined
        ? input.description.trim() || undefined
        : current.description,
    deadline: "deadline" in input ? input.deadline : current.deadline,
    projectId:
      input.projectId !== undefined ? input.projectId : current.projectId,
    completed,
    // Completing a parent completes every subtask; reopening preserves their progress.
    subtasks:
      !current.completed && completed
        ? subtasks.map((s) =>
            s.completed ? s : { ...s, completed: true, updatedAt: now },
          )
        : [...subtasks],
    updatedAt: now,
  };
  if (current.completed && !completed)
    requireFocusSpace(data, current.id, updated.myDay);
  if (updated.recurrence && !updated.deadline)
    throw new Error("Recurring tasks need a deadline.");
  if (
    updated.recurrence &&
    (!current.recurrence || current.deadline !== updated.deadline)
  ) {
    updated.recurrence = {
      ...updated.recurrence,
      anchorDay: new Date(updated.deadline!).getDate(),
    };
  }
  if (
    !current.completed &&
    completed &&
    updated.recurrence &&
    !current.nextOccurrenceId
  ) {
    const nextId = crypto.randomUUID();
    const next: Log = {
      ...updated,
      id: nextId,
      seriesId: current.seriesId ?? current.id,
      nextOccurrenceId: undefined,
      deadline: nextRecurringDeadline(updated.deadline!, updated.recurrence),
      myDay: undefined,
      completed: false,
      subtasks: updated.subtasks.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        completed: false,
        createdAt: now,
        updatedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };
    updated.nextOccurrenceId = nextId;
    data.logs.push(next);
  }
  data.logs[data.logs.indexOf(current)] = updated;
  return updated;
}

/** Shared domain rules. Each mutation reads, changes and saves one isolated snapshot. */
export abstract class PlannerRepository implements StorageRepository {
  abstract getSnapshot(): AppDataSchema;
  abstract subscribe(listener: StorageListener): () => void;
  protected abstract readData(): Promise<AppDataSchema>;
  protected abstract writeData(data: AppDataSchema): Promise<void>;
  private pending: Promise<unknown> = Promise.resolve();

  protected mutate<T>(change: (data: AppDataSchema) => T): Promise<T> {
    // Serialize same-device writes; the cloud adapter also guards against other devices.
    const next = this.pending.then(async () => {
      const data = await this.readData();
      data.version = 2;
      if (data.trash)
        data.trash = data.trash.filter(
          (item) =>
            Date.now() - Date.parse(item.deletedAt) < TRASH_RETENTION_MS,
        );
      const result = change(data);
      await this.writeData(data);
      return structuredClone(result);
    });
    this.pending = next.catch(() => {});
    return next;
  }
  async getLogs(): Promise<Log[]> {
    return structuredClone((await this.readData()).logs);
  }
  async getActiveLogs(): Promise<Log[]> {
    return (await this.getLogs()).filter((log) => !log.completed);
  }
  async getCompletedLogs(): Promise<Log[]> {
    return (await this.getLogs()).filter((log) => log.completed);
  }
  async getLogById(id: string): Promise<Log | null> {
    return (await this.getLogs()).find((log) => log.id === id) ?? null;
  }
  createLog(input: NewLogInput): Promise<Log> {
    return this.mutate((data) => {
      validateAssignment(data, input);
      const now = new Date().toISOString();
      const log: Log = {
        id: crypto.randomUUID(),
        title: title(input.title),
        description: input.description?.trim() || undefined,
        priority: input.priority,
        recurrence: input.recurrence
          ? {
              ...input.recurrence,
              anchorDay: input.deadline
                ? new Date(input.deadline).getDate()
                : undefined,
            }
          : undefined,
        deadline: input.deadline,
        projectId: input.projectId ?? null,
        completed: false,
        subtasks: [
          ...structuredClone(input.subtasks ?? []),
          ...(input.draftSubtasks ?? []).map((value) =>
            createSubtask(value, now),
          ),
        ],
        createdAt: now,
        updatedAt: now,
      };
      if (log.recurrence && !log.deadline)
        throw new Error("Recurring tasks need a deadline.");
      data.logs.push(log);
      return log;
    });
  }
  updateLog(input: UpdateLogInput): Promise<Log> {
    return this.mutate((data) => applyLogUpdate(data, input));
  }
  changeLogCompletion(
    id: string,
  ): Promise<{ previous: Log; updated: Log } | null> {
    return this.mutate((data) => {
      const current = data.logs.find((log) => log.id === id);
      if (!current) return null;
      const previous = structuredClone(current);
      return {
        previous,
        updated: applyLogUpdate(data, { id, completed: !current.completed }),
      };
    });
  }
  async toggleLogCompletion(id: string): Promise<Log | null> {
    return (await this.changeLogCompletion(id))?.updated ?? null;
  }
  deleteLog(id: string): Promise<boolean> {
    return this.mutate((data) => {
      const count = data.logs.length;
      const log = data.logs.find((log) => log.id === id);
      if (log)
        (data.trash ??= []).push({
          log: structuredClone(log),
          deletedAt: new Date().toISOString(),
        });
      data.logs = data.logs.filter((log) => log.id !== id);
      return count !== data.logs.length;
    });
  }
  restoreLog(id: string): Promise<boolean> {
    return this.mutate((data) => {
      const entry = data.trash?.find((item) => item.log.id === id);
      if (!entry)
        throw new Error("This task is no longer available to restore.");
      if (data.logs.some((log) => log.id === id))
        throw new Error("This task already exists.");
      const log = { ...entry.log, updatedAt: stamp(entry.log.updatedAt) };
      if (log.projectId && !data.projects.some((p) => p.id === log.projectId))
        log.projectId = null;
      // Restoring a task does not silently displace today's chosen focus.
      if (
        !log.completed &&
        log.myDay &&
        data.logs.filter((l) => !l.completed && l.myDay === log.myDay).length >=
          3
      )
        log.myDay = undefined;
      data.logs.push(log);
      data.trash = data.trash!.filter((item) => item.log.id !== id);
      return true;
    });
  }
  planMyDay(id: string, date: string | null): Promise<Log> {
    return this.mutate((data) => {
      if (date !== null && !isDateKey(date))
        throw new Error("Invalid planning date");
      const log = findLog(data, id);
      if (date && log.completed)
        throw new Error("Choose an active task for My Day.");
      if (date) requireFocusSpace(data, id, date);
      log.myDay = date ?? undefined;
      log.updatedAt = stamp(log.updatedAt);
      return log;
    });
  }
  undoCompletion(previous: Log, expectedUpdatedAt: string): Promise<boolean> {
    return this.mutate((data) => {
      const current = findLog(data, previous.id);
      if (current.updatedAt !== expectedUpdatedAt)
        throw new Error(
          "This task has changed. Reopen it to update its completion.",
        );
      if (!previous.completed)
        requireFocusSpace(data, previous.id, previous.myDay);
      if (
        current.nextOccurrenceId &&
        current.nextOccurrenceId !== previous.nextOccurrenceId
      ) {
        const next = data.logs.find((l) => l.id === current.nextOccurrenceId);
        if (!next || next.completed || next.updatedAt !== next.createdAt)
          throw new Error(
            "The next occurrence has changed, so this completion cannot be undone.",
          );
        data.logs = data.logs.filter((l) => l.id !== next.id);
      }
      data.logs[data.logs.findIndex((l) => l.id === previous.id)] = {
        ...structuredClone(previous),
        updatedAt: stamp(current.updatedAt),
      };
      return true;
    });
  }
  addSubtask(logId: string, value: string): Promise<Subtask> {
    return this.mutate((data) => {
      const log = findLog(data, logId);
      const now = stamp(log.updatedAt);
      const subtask = createSubtask(value, now);
      log.subtasks.push(subtask);
      log.updatedAt = now;
      return subtask;
    });
  }
  updateSubtaskTitle(
    logId: string,
    subtaskId: string,
    value: string,
  ): Promise<Subtask> {
    return this.mutate((data) => {
      const log = findLog(data, logId);
      const subtask = log.subtasks.find((s) => s.id === subtaskId);
      if (!subtask) throw new Error("Subtask not found");
      subtask.title = title(value);
      subtask.updatedAt = log.updatedAt = stamp(log.updatedAt);
      return subtask;
    });
  }
  toggleSubtaskCompletion(
    logId: string,
    subtaskId: string,
  ): Promise<Subtask | null> {
    return this.mutate((data) => {
      const log = data.logs.find((log) => log.id === logId);
      const subtask = log?.subtasks.find((s) => s.id === subtaskId);
      if (!log || !subtask) return null;
      subtask.completed = !subtask.completed;
      subtask.updatedAt = log.updatedAt = stamp(log.updatedAt);
      return subtask;
    });
  }
  deleteSubtask(logId: string, subtaskId: string): Promise<boolean> {
    return this.mutate((data) => {
      const log = data.logs.find((log) => log.id === logId);
      if (!log) return false;
      const count = log.subtasks.length;
      log.subtasks = log.subtasks.filter((s) => s.id !== subtaskId);
      if (count === log.subtasks.length) return false;
      log.updatedAt = stamp(log.updatedAt);
      return true;
    });
  }
  async getProjects(): Promise<Project[]> {
    return structuredClone((await this.readData()).projects).sort(
      (a, b) => a.order - b.order,
    );
  }
  async getProjectById(id: string): Promise<Project | null> {
    return (await this.getProjects()).find((p) => p.id === id) ?? null;
  }
  createProject(name: string): Promise<Project> {
    return this.mutate((data) => {
      const now = new Date().toISOString();
      const project: Project = {
        id: crypto.randomUUID(),
        name: title(name),
        order: data.projects.length,
        createdAt: now,
        updatedAt: now,
      };
      data.projects.push(project);
      return project;
    });
  }
  updateProject(id: string, name: string): Promise<Project> {
    return this.mutate((data) => {
      const project = data.projects.find((p) => p.id === id);
      if (!project) throw new Error("Project not found");
      project.name = title(name);
      project.updatedAt = new Date().toISOString();
      return project;
    });
  }
  deleteProject(id: string): Promise<boolean> {
    return this.mutate((data) => {
      if (!data.projects.some((p) => p.id === id)) return false;
      data.projects = data.projects.filter((p) => p.id !== id);
      data.projects.forEach((p, i) => {
        p.order = i;
      });
      data.logs.forEach((log) => {
        if (log.projectId === id) {
          log.projectId = null;
          log.updatedAt = stamp(log.updatedAt);
        }
      });
      return true;
    });
  }
  reorderProjects(ids: string[]): Promise<Project[]> {
    return this.mutate((data) => {
      if (
        ids.length !== data.projects.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !data.projects.some((p) => p.id === id))
      ) {
        throw new Error(
          "Project order must contain every project exactly once",
        );
      }
      const order = new Map(ids.map((id, i) => [id, i]));
      const now = new Date().toISOString();
      data.projects.forEach((p) => {
        p.order = order.get(p.id)!;
        p.updatedAt = now;
      });
      data.projects.sort((a, b) => a.order - b.order);
      return data.projects;
    });
  }
  moveProject(id: string, direction: "up" | "down"): Promise<Project[]> {
    return this.mutate((data) => {
      data.projects.sort((a, b) => a.order - b.order);
      const i = data.projects.findIndex((p) => p.id === id);
      const j = direction === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= data.projects.length) return data.projects;
      [data.projects[i], data.projects[j]] = [
        data.projects[j],
        data.projects[i],
      ];
      const now = new Date().toISOString();
      data.projects.forEach((p, index) => {
        p.order = index;
        p.updatedAt = now;
      });
      return data.projects;
    });
  }
  async getSettings(): Promise<Settings> {
    return { ...(await this.readData()).settings };
  }
  updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.mutate((data) => {
      const settings = { ...data.settings, ...patch };
      if (
        !["light", "dark"].includes(settings.theme) ||
        !isFontSize(settings.fontSize)
      )
        throw new Error("Invalid appearance settings");
      data.settings = settings;
      return settings;
    });
  }
  async exportData(): Promise<AppDataSchema> {
    return structuredClone(await this.readData());
  }
  importData(input: AppDataSchema): Promise<boolean> {
    const validation = validateBackup(createBackup(input));
    if (!validation.valid) return Promise.reject(new Error(validation.error));
    return this.mutate((data) => {
      const next = structuredClone(validation.data);
      next.projects.forEach((project, index) => {
        project.order = index;
      });
      Object.assign(data, next, { version: 2, trash: next.trash ?? [] });
      return true;
    });
  }
}
