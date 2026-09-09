import type { AppDataSchema, Log, Project, Settings, Subtask } from '../types';

export const CURRENT_BACKUP_VERSION = 1;
export const BACKUP_APP_IDENTIFIER = 'todop';

export interface BackupDataPayload {
  schemaVersion: number;
  logs: Log[];
  projects: Project[];
  settings: Settings;
}

export interface TodopBackupFile {
  backupVersion: number;
  app: string;
  exportedAt: string;
  data: BackupDataPayload;
}

export type BackupValidationResult =
  | { valid: true; backup: TodopBackupFile; data: AppDataSchema }
  | { valid: false; error: string };

/**
 * Creates a deterministic, non-mutating backup payload from current application data.
 */
export function createBackup(data: AppDataSchema, exportedAt?: string): TodopBackupFile {
  return {
    backupVersion: CURRENT_BACKUP_VERSION,
    app: BACKUP_APP_IDENTIFIER,
    exportedAt: exportedAt || new Date().toISOString(),
    data: {
      schemaVersion: data.version ?? 1,
      logs: (data.logs || []).map((l) => ({
        ...l,
        subtasks: (l.subtasks || []).map((s) => ({ ...s })),
      })),
      projects: JSON.parse(JSON.stringify(data.projects || [])),
      settings: JSON.parse(JSON.stringify(data.settings || { theme: 'light', fontSize: 'medium' })),
    },
  };
}

/**
 * Generates local-date formatted filename: todop-backup-YYYY-MM-DD.json
 */
export function getBackupFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `todop-backup-${year}-${month}-${day}.json`;
}

/**
 * Triggers a browser download of the backup file without any server/network dependency.
 */
export function downloadBackupFile(backup: TodopBackupFile): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getBackupFilename(new Date(backup.exportedAt || Date.now()));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Strictly validates a raw backup string or parsed object before any restore attempt.
 * Guarantees zero data mutation if validation fails.
 */
export function validateBackup(rawInput: unknown): BackupValidationResult {
  let obj: unknown;

  if (typeof rawInput === 'string') {
    try {
      obj = JSON.parse(rawInput);
    } catch {
      return {
        valid: false,
        error: 'INVALID JSON: The selected file could not be parsed as valid JSON.',
      };
    }
  } else {
    obj = rawInput;
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return {
      valid: false,
      error: 'INVALID BACKUP: The file does not contain a valid JSON object.',
    };
  }

  const record = obj as Record<string, unknown>;

  // Validate app identifier
  if (record.app !== BACKUP_APP_IDENTIFIER) {
    return {
      valid: false,
      error: 'INVALID BACKUP: The selected file is not a valid TODOP backup.',
    };
  }

  // Validate backupVersion
  if (record.backupVersion !== CURRENT_BACKUP_VERSION) {
    return {
      valid: false,
      error: `UNSUPPORTED VERSION: Backup version ${String(record.backupVersion)} is not supported (expected ${CURRENT_BACKUP_VERSION}).`,
    };
  }

  // Validate exportedAt
  if (typeof record.exportedAt !== 'string' || isNaN(Date.parse(record.exportedAt))) {
    return {
      valid: false,
      error: 'INVALID BACKUP: Missing or invalid export timestamp.',
    };
  }

  // Validate data payload
  if (!record.data || typeof record.data !== 'object' || Array.isArray(record.data)) {
    return {
      valid: false,
      error: 'INVALID BACKUP: Missing or invalid data payload.',
    };
  }

  const dataPayload = record.data as Record<string, unknown>;

  // Validate schema version
  const schemaVer = dataPayload.schemaVersion ?? dataPayload.version;
  if (typeof schemaVer !== 'number' || schemaVer < 1) {
    return {
      valid: false,
      error: 'INVALID BACKUP: Missing or invalid schemaVersion.',
    };
  }

  // Validate logs array
  if (!Array.isArray(dataPayload.logs)) {
    return {
      valid: false,
      error: 'INVALID BACKUP: Logs collection is missing or malformed.',
    };
  }

  const validatedLogs: Log[] = [];
  for (let i = 0; i < dataPayload.logs.length; i++) {
    const log = dataPayload.logs[i];
    if (!log || typeof log !== 'object' || Array.isArray(log)) {
      return {
        valid: false,
        error: `MALFORMED LOG RECORD: Log at index ${i} is not a valid object.`,
      };
    }
    const l = log as Record<string, unknown>;
    if (typeof l.id !== 'string' || !l.id.trim()) {
      return {
        valid: false,
        error: `MALFORMED LOG RECORD: Log at index ${i} is missing a valid ID.`,
      };
    }
    if (typeof l.title !== 'string' || !l.title.trim()) {
      return {
        valid: false,
        error: `MALFORMED LOG RECORD: Log "${String(l.id)}" is missing a valid title.`,
      };
    }
    if (typeof l.deadline !== 'string' || isNaN(Date.parse(l.deadline))) {
      return {
        valid: false,
        error: `MALFORMED LOG RECORD: Log "${String(l.title)}" has an invalid deadline.`,
      };
    }
    if (typeof l.completed !== 'boolean') {
      return {
        valid: false,
        error: `MALFORMED LOG RECORD: Log "${String(l.title)}" has an invalid completion state.`,
      };
    }
    if (l.projectId !== null && typeof l.projectId !== 'string') {
      return {
        valid: false,
        error: `MALFORMED LOG RECORD: Log "${String(l.title)}" has an invalid projectId.`,
      };
    }
    if (typeof l.createdAt !== 'string' || typeof l.updatedAt !== 'string') {
      return {
        valid: false,
        error: `MALFORMED LOG RECORD: Log "${String(l.title)}" has invalid timestamps.`,
      };
    }

    // Validate subtasks (backward-compatible: older backups without subtasks are valid and normalize to [])
    const validatedSubtasks: Subtask[] = [];
    if ('subtasks' in l && l.subtasks !== undefined) {
      if (!Array.isArray(l.subtasks)) {
        return {
          valid: false,
          error: `MALFORMED LOG RECORD: Log "${String(l.title)}" subtasks must be an array.`,
        };
      }
      for (let j = 0; j < l.subtasks.length; j++) {
        const subtask = l.subtasks[j];
        if (!subtask || typeof subtask !== 'object' || Array.isArray(subtask)) {
          return {
            valid: false,
            error: `MALFORMED SUBTASK RECORD: Subtask at index ${j} of Log "${String(l.title)}" is not a valid object.`,
          };
        }
        const st = subtask as Record<string, unknown>;
        if (typeof st.id !== 'string' || !st.id.trim()) {
          return {
            valid: false,
            error: `MALFORMED SUBTASK RECORD: Subtask at index ${j} of Log "${String(l.title)}" is missing a valid ID.`,
          };
        }
        if (typeof st.title !== 'string' || !st.title.trim()) {
          return {
            valid: false,
            error: `MALFORMED SUBTASK RECORD: Subtask "${String(st.id)}" in Log "${String(l.title)}" is missing a valid title.`,
          };
        }
        if (typeof st.completed !== 'boolean') {
          return {
            valid: false,
            error: `MALFORMED SUBTASK RECORD: Subtask "${String(st.title)}" in Log "${String(l.title)}" has an invalid completion state.`,
          };
        }
        if (typeof st.createdAt !== 'string' || isNaN(Date.parse(st.createdAt))) {
          return {
            valid: false,
            error: `MALFORMED SUBTASK RECORD: Subtask "${String(st.title)}" in Log "${String(l.title)}" has an invalid createdAt timestamp.`,
          };
        }
        if (typeof st.updatedAt !== 'string' || isNaN(Date.parse(st.updatedAt))) {
          return {
            valid: false,
            error: `MALFORMED SUBTASK RECORD: Subtask "${String(st.title)}" in Log "${String(l.title)}" has an invalid updatedAt timestamp.`,
          };
        }
        validatedSubtasks.push({
          id: st.id,
          title: st.title.trim(),
          completed: st.completed,
          createdAt: st.createdAt,
          updatedAt: st.updatedAt,
        });
      }
    }

    validatedLogs.push({
      id: l.id as string,
      title: (l.title as string).trim(),
      description: typeof l.description === 'string' ? l.description.trim() || undefined : undefined,
      deadline: l.deadline as string,
      projectId: (l.projectId as string | null) ?? null,
      completed: l.completed as boolean,
      subtasks: validatedSubtasks,
      createdAt: l.createdAt as string,
      updatedAt: l.updatedAt as string,
    });
  }

  // Validate projects array
  if (!Array.isArray(dataPayload.projects)) {
    return {
      valid: false,
      error: 'INVALID BACKUP: Projects collection is missing or malformed.',
    };
  }

  for (let i = 0; i < dataPayload.projects.length; i++) {
    const proj = dataPayload.projects[i];
    if (!proj || typeof proj !== 'object' || Array.isArray(proj)) {
      return {
        valid: false,
        error: `MALFORMED PROJECT RECORD: Project at index ${i} is not a valid object.`,
      };
    }
    const p = proj as Record<string, unknown>;
    if (typeof p.id !== 'string' || !p.id.trim()) {
      return {
        valid: false,
        error: `MALFORMED PROJECT RECORD: Project at index ${i} is missing a valid ID.`,
      };
    }
    if (typeof p.name !== 'string' || !p.name.trim()) {
      return {
        valid: false,
        error: `MALFORMED PROJECT RECORD: Project "${String(p.id)}" is missing a valid name.`,
      };
    }
    if (typeof p.order !== 'number' || isNaN(p.order)) {
      return {
        valid: false,
        error: `MALFORMED PROJECT RECORD: Project "${String(p.name)}" has an invalid order index.`,
      };
    }
    if (typeof p.createdAt !== 'string' || typeof p.updatedAt !== 'string') {
      return {
        valid: false,
        error: `MALFORMED PROJECT RECORD: Project "${String(p.name)}" has invalid timestamps.`,
      };
    }
  }

  // Validate settings object
  if (!dataPayload.settings || typeof dataPayload.settings !== 'object' || Array.isArray(dataPayload.settings)) {
    return {
      valid: false,
      error: 'INVALID BACKUP: Settings object is missing or malformed.',
    };
  }

  const s = dataPayload.settings as Record<string, unknown>;
  if (s.theme !== 'light' && s.theme !== 'dark') {
    return {
      valid: false,
      error: 'MALFORMED SETTINGS: Theme must be either "light" or "dark".',
    };
  }
  if (s.fontSize !== 'small' && s.fontSize !== 'medium' && s.fontSize !== 'large') {
    return {
      valid: false,
      error: 'MALFORMED SETTINGS: Font size must be "small", "medium", or "large".',
    };
  }

  // Construct valid AppDataSchema
  const validSchema: AppDataSchema = {
    version: schemaVer as number,
    logs: validatedLogs,
    projects: (dataPayload.projects as Project[]).sort((a, b) => a.order - b.order),
    settings: {
      theme: s.theme as 'light' | 'dark',
      fontSize: s.fontSize as 'small' | 'medium' | 'large',
    },
  };

  const backup: TodopBackupFile = {
    backupVersion: record.backupVersion as number,
    app: BACKUP_APP_IDENTIFIER,
    exportedAt: record.exportedAt as string,
    data: {
      schemaVersion: schemaVer as number,
      logs: validSchema.logs,
      projects: validSchema.projects,
      settings: validSchema.settings,
    },
  };

  return {
    valid: true,
    backup,
    data: validSchema,
  };
}
