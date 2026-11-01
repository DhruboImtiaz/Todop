import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStorage } from '../../hooks/useStorage';
import { supabase } from '../../services/supabase/client';
import { defaultStorageRepository } from '../../services/storage/localStorageRepository';
import { navigate } from '../../utils/navigation';
export function AccountPanel() {
  const { session } = useAuth();
  const { importData, activeLogs, completedLogs, projects } = useStorage();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const empty = activeLogs.length + completedLogs.length + projects.length === 0;
  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) { setError(error.message); setBusy(false); return; }
    navigate('/');
  }
  async function copyDevicePlanner() {
    setBusy(true); setError('');
    try {
      const data = await defaultStorageRepository.exportData();
      await importData(data);
      setMessage('Your device planner has been copied to your account. The device copy is still available when signed out.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not copy your planner.'); }
    finally { setBusy(false); }
  }
  return <section className="settings-section" aria-labelledby="account-heading"><h2 id="account-heading" className="settings-section-title">ACCOUNT</h2><div className="settings-card account-panel"><div className="settings-item-info"><span className="settings-item-name">{session ? session.user.email : 'Your device planner'}</span><span className="settings-item-desc">{session ? 'Saved to your private cloud workspace. Cloud edits need a connection.' : 'Saved on this browser. Create an account to keep a separate planner across devices.'}</span></div><div className="settings-data-actions">{session ? <><button className="settings-action-btn secondary" disabled={busy} onClick={() => { void signOut().catch(() => { setError('Could not sign out. Please try again.'); setBusy(false); }); }}>Sign out</button>{empty && <button className="settings-action-btn primary" disabled={busy} onClick={copyDevicePlanner}>Copy device planner to account</button>}</> : <button className="settings-action-btn primary" onClick={() => navigate('/auth?mode=signup')}>Create account / Sign in</button>}<button className="settings-action-btn secondary" onClick={() => navigate('/')}>About Todop</button></div>{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}</div></section>;
}
