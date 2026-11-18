import { useEffect, useState } from 'react';
import { createTeamInvite, loadTeamAccess, removeTeamMember, revokeTeamInvite } from '../../services/storage/teamWorkspaceRepository';

export function TeamAccessPanel({ workspaceId }: { workspaceId: string }) {
  const [access, setAccess] = useState<Awaited<ReturnType<typeof loadTeamAccess>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    void loadTeamAccess(workspaceId).then(result => {
      if (current) setAccess(result);
    }).catch(() => {
      if (current) setError('Could not load workspace access.');
    });
    return () => { current = false; };
  }, [workspaceId]);

  async function change(operation: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
      setAccess(await loadTeamAccess(workspaceId));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not change workspace access.');
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Invite link copied.');
      setError('');
    } catch {
      setError('Select the invite link to copy it.');
    }
  }

  return (
    <details className="team-panel">
      <summary>Members and invitations</summary>
      <div className="team-panel-content">
        <h2>Members</h2>
        {access?.members.length === 0 && <p>You’re the only person in this workspace.</p>}
        {access?.members.map(member => (
          <div className="team-member" key={member.user_id}>
            <span>{member.display_name}</span>
            <button className="workspace-secondary" disabled={busy} aria-label={`Remove ${member.display_name}`}
              onClick={() => {
                if (window.confirm(`Remove ${member.display_name} from this workspace?`))
                  void change(() => removeTeamMember(workspaceId, member.user_id));
              }}>Remove</button>
          </div>
        ))}
        <h2>Invite a collaborator</h2>
        <p>Each link can admit one signed-in account and expires after seven days.</p>
        <button className="workspace-primary" disabled={busy}
          onClick={() => { void change(() => createTeamInvite(workspaceId)); }}>Create invite link</button>
        {access?.invites.map(({ token, expires_at }, index) => {
          const link = `${window.location.origin}/workspaces?invite=${token}`;
          return (
            <div className="team-invite" key={token}>
              <label>Invite link {index + 1}
                <input readOnly value={link} onFocus={event => event.currentTarget.select()} />
              </label>
              <small>Expires {new Date(expires_at).toLocaleDateString()}</small>
              <div className="team-actions">
                <button className="workspace-secondary" onClick={() => { void copy(link); }}>Copy link</button>
                <button className="workspace-secondary" disabled={busy}
                  onClick={() => { void change(() => revokeTeamInvite(workspaceId, token)); }}>Revoke</button>
              </div>
            </div>
          );
        })}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
