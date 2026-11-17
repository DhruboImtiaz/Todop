import type { AppDataSchema } from '../../types';
import { DEFAULT_SETTINGS } from '../../utils/settings';
import { BACKUP_APP_IDENTIFIER, CURRENT_BACKUP_VERSION, validateBackup } from '../../utils/backup';

export const emptyWorkspace = (): AppDataSchema => ({
  version: 2, logs: [], trash: [], projects: [], settings: { ...DEFAULT_SETTINGS },
});

export type Revision = { revision: number; data: AppDataSchema };
export function parseData(data: AppDataSchema): AppDataSchema {
  const validation = validateBackup({
    app: BACKUP_APP_IDENTIFIER,
    backupVersion: CURRENT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { ...data, schemaVersion: data?.version },
  });
  if (!validation.valid) throw new Error('Your planner has invalid data.');
  return { ...validation.data, trash: validation.data.trash ?? [] };
}

export function parseRevision(value: Revision): Revision {
  if (!Number.isSafeInteger(value?.revision) || value.revision < 0)
    throw new Error('Your planner has an invalid revision.');
  return { revision: value.revision, data: parseData(value.data) };
}
