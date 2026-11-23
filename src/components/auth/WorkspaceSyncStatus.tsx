import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SupabaseRepository } from '../../services/storage/supabaseRepository';
import { createBackup, downloadBackupFile } from '../../utils/backup';

const CONFIRMATION_DURATION_MS = 4000;

export function WorkspaceSyncStatus({ repository }: { repository: SupabaseRepository }) {
  const { pending, phase, message, confirmedAt } = useSyncExternalStore(repository.subscribe, repository.getSyncStatus);
  const [dismissedThrough, setDismissedThrough] = useState(() => Date.now() - CONFIRMATION_DURATION_MS);

  useEffect(() => {
    if (confirmedAt === null) return;
    const remaining = confirmedAt + CONFIRMATION_DURATION_MS - Date.now();
    const timeout = window.setTimeout(() => setDismissedThrough(confirmedAt), remaining);
    return () => window.clearTimeout(timeout);
  }, [confirmedAt]);

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

  if (phase === 'offline' || phase === 'error') {
    const text = phase === 'offline'
      ? (pending ? 'Offline. Changes saved on this device.' : 'Offline. You can keep editing.')
      : (pending ? 'Sync unavailable. Changes saved on this device.' : message);
    return (
      <div className="workspace-sync">
        <p role="status">{text}</p>
        {phase === 'error' && <button onClick={() => { void repository.refresh(); }}>Retry sync</button>}
      </div>
    );
  }

  const confirmed = !pending && confirmedAt !== null && confirmedAt > dismissedThrough;
  return (
    <div className="workspace-sync-notice" role="status" style={{ animationDuration: `${CONFIRMATION_DURATION_MS}ms` }}>
      {pending && <span>Syncing…</span>}
      {confirmed && <span className="workspace-sync-confirmation" key={confirmedAt}>
        <span aria-hidden="true">Synced</span>
        <span className="sr-only">All changes synced.</span>
      </span>}
    </div>
  );
}
