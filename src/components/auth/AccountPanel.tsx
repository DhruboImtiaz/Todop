import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStorage } from '../../hooks/useStorage';
import { supabase } from '../../services/supabase/client';
import { defaultStorageRepository } from '../../services/storage/localStorageRepository';
import { navigate } from '../../utils/navigation';

export function AccountPanel() {
  const { account } = useAuth();
  const { importData, activeLogs, completedLogs, deletedLogs, projects } = useStorage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const empty = activeLogs.length + completedLogs.length + deletedLogs.length + projects.length === 0;

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      navigate('/');
    } catch {
      setError('Could not sign out. Reconnect and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copyDevicePlanner() {
    setBusy(true);
    setError('');
    try {
      const data = await defaultStorageRepository.exportData();
      await importData(data, { onlyIfEmpty: true });
      setMessage('Copied to your account planner on this device. Changes sync when you’re connected.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not copy your planner.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section" aria-labelledby="account-heading">
      <h2 id="account-heading" className="settings-section-title">ACCOUNT</h2>
      <div className="settings-card account-panel">
        <div className="settings-item-info">
          <span className="settings-item-name">{account ? account.email ?? 'Your account planner' : 'Your device planner'}</span>
          <span className="settings-item-desc">
            {account ? 'Changes save on this device and sync to your account when you’re online.' :
              'Saved on this browser. Create an account to keep a separate planner across devices.'}
          </span>
        </div>
        <div className="settings-data-actions">
          {account ? (
            <>
              <button className="settings-action-btn secondary" disabled={busy} onClick={signOut}>Sign out</button>
              {empty && <button className="settings-action-btn primary" disabled={busy} onClick={copyDevicePlanner}>Copy device planner to account</button>}
            </>
          ) : (
            <button className="settings-action-btn primary" onClick={() => navigate('/auth?mode=signup')}>Create account / Sign in</button>
          )}
          <button className="settings-action-btn secondary" onClick={() => navigate('/')}>About Todop</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}
