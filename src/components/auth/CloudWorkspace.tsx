import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { StorageProvider } from '../../context/StorageProvider';
import { SupabaseRepository } from '../../services/storage/supabaseRepository';
import { supabase, supabaseUrl } from '../../services/supabase/client';
import { navigate } from '../../utils/navigation';

export function CloudWorkspace({ userId, children }: { userId: string; children: ReactNode }) {
  const repository = useMemo(() => new SupabaseRepository(supabase, userId, supabaseUrl), [userId]);
  const { ready, phase, message } = useSyncExternalStore(repository.subscribe, repository.getSyncStatus);

  useEffect(() => {
    const refresh = () => { void repository.refresh(); };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === repository.cacheKey || event.key === null) repository.reloadDevice();
    };
    refresh();
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [repository]);

  if (ready) return <StorageProvider repository={repository}>{children}</StorageProvider>;
  const unavailable = phase === 'offline' || phase === 'error';
  return (
    <main className="workspace-loading" aria-live="polite">
      <h1>Your planner</h1>
      <p>{phase === 'offline' ? 'Open your account planner online once to make it available offline.' : message || 'Opening your workspace…'}</p>
      {unavailable && (
        <>
          <button onClick={() => { void repository.refresh(); }}>Try again</button>
          <button onClick={() => navigate('/')}>Back to home</button>
        </>
      )}
    </main>
  );
}
