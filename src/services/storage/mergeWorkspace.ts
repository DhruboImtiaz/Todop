import type { AppDataSchema, DeletedLog, Log } from '../../types';
import { createBackup, validateBackup } from '../../utils/backup';

export class WorkspaceConflict extends Error {}

// PostgreSQL JSONB can return object keys in a different order. Undefined fields
// also disappear across the wire, so compare the JSON values we actually save.
export function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  const orderedJson = (value: unknown) => JSON.stringify(value, (_, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
  return orderedJson(left) === orderedJson(right);
}

function mergeValue<T>(base: T, local: T, remote: T, conflict: () => string): T {
  if (sameValue(local, base) || sameValue(local, remote)) return remote;
  if (sameValue(remote, base)) return local;
  throw new WorkspaceConflict(conflict());
}

function mergeRecords<T>(
  base: T[], local: T[], remote: T[], key: (record: T) => string, label: (record: T) => string,
): T[] {
  const [before, device, cloud] = [base, local, remote].map(records =>
    new Map(records.map(record => [key(record), record])),
  );
  const merged: T[] = [];
  for (const id of new Set([...cloud.keys(), ...device.keys(), ...before.keys()])) {
    const original = before.get(id);
    const localRecord = device.get(id);
    const remoteRecord = cloud.get(id);
    const record = mergeValue(original, localRecord, remoteRecord, () =>
      `“${label((localRecord ?? remoteRecord ?? original)!)}” changed on both devices.`,
    );
    if (record !== undefined) merged.push(record);
  }
  return merged;
}

type TaskRecord = { log: Log; deletedAt?: string };
const taskRecords = (data: AppDataSchema): TaskRecord[] => [
  ...data.logs.map(log => ({ log })),
  ...(data.trash ?? []),
];

export function mergeWorkspace(base: AppDataSchema, local: AppDataSchema, remote: AppDataSchema): AppDataSchema {
  if (sameValue(base, remote)) return local;
  if (sameValue(base, local) || sameValue(local, remote)) return remote;
  const records = mergeRecords(taskRecords(base), taskRecords(local), taskRecords(remote),
    item => item.log.id, item => item.log.title);
  const logs: Log[] = [];
  const trash: DeletedLog[] = [];
  const focusCounts = new Map<string, number>();
  for (const { log, deletedAt } of records) {
    if (deletedAt !== undefined) {
      trash.push({ log, deletedAt });
      continue;
    }
    logs.push(log);
    if (!log.completed && log.myDay) {
      const count = (focusCounts.get(log.myDay) ?? 0) + 1;
      if (count > 3) throw new WorkspaceConflict('The combined changes would put more than three tasks in My Day.');
      focusCounts.set(log.myDay, count);
    }
  }
  const projects = mergeRecords(base.projects, local.projects, remote.projects, project => project.id, project => project.name)
    .sort((a, b) => a.order - b.order)
    .map((project, order) => ({ ...project, order }));
  const settings = {
    theme: mergeValue(base.settings.theme, local.settings.theme, remote.settings.theme, () => 'The theme changed on both devices.'),
    fontSize: mergeValue(base.settings.fontSize, local.settings.fontSize, remote.settings.fontSize, () => 'The text size changed on both devices.'),
  };
  const version = Math.max(local.version, remote.version);
  const result = validateBackup(createBackup({ version, logs, trash, projects, settings }));
  if (!result.valid) throw new WorkspaceConflict(result.error.replace(/^INVALID BACKUP: /, ''));
  return result.data;
}

// An ambiguous write may have committed before another device made a separate
// edit. Compare the changed records rather than requiring a byte-for-byte echo.
export function includesWorkspaceChanges(base: AppDataSchema, sent: AppDataSchema, remote: AppDataSchema): boolean {
  try {
    return sameValue(mergeWorkspace(base, sent, remote), remote);
  } catch (error) {
    if (error instanceof WorkspaceConflict) return false;
    throw error;
  }
}
