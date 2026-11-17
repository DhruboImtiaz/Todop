import { useSyncExternalStore } from 'react';
import { SupabaseRepository } from '../../services/storage/supabaseRepository';
import { createBackup, downloadBackupFile } from '../../utils/backup';

export function WorkspaceSyncStatus({ repository }: { repository: SupabaseRepository }) {
  const { pending, phase, message } = useSyncExternalStore(repository.subscribe, repository.getSyncStatus);
  if (phase === 'conflict') {
    return (
      <section className="workspace-sync" aria-label="Sync conflict">
        <p role="alert">Sync conflict. {message} Your device changes are still saved here.</p>
        <div className="workspace-sync-actions">
          <button onClick={() => downloadBackupFile(createBackup(repository.getSnapshot()))}>Download device backup</button>
          <button onClick={() => {
            if (window.confirm('Use the cloud version and discard unsynced changes on this device?')) {
              void repository.useCloudVersion();
            }
          }}>Use cloud version</button>
        </div>
      </section>
    );
  }

  let text = 'All changes synced.';
  if (phase === 'offline') text = pending ? 'Offline. Changes saved on this device.' : 'Offline. You can keep editing.';
  else if (phase === 'error') text = pending ? 'Sync unavailable. Changes saved on this device.' : message;
  else if (pending) text = 'Syncing changes…';
  return (
    <div className="workspace-sync">
      <p role="status">{text}</p>
      {phase === 'error' && <button onClick={() => { void repository.refresh(); }}>Retry sync</button>}
    </div>
  );
}
