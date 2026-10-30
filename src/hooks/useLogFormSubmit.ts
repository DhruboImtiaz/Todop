import type { Log, LogFormValues } from '../types';
import { useStorage } from './useStorage';

/** Keep assignment, deadline clearing and drafted subtasks consistent in every view. */
export function useLogFormSubmit(editingLog: Log | null, onSaved: () => void) {
  const { createLog, updateLog } = useStorage();
  return async ({ draftSubtasks, ...values }: LogFormValues) => {
    const input = { ...values, projectId: values.projectId ?? null };
    if (editingLog) {
      await updateLog({ id: editingLog.id, ...input });
    } else {
      await createLog({ ...input, draftSubtasks });
    }
    onSaved();
  };
}
