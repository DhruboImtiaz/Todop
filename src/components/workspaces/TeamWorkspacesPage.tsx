import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStorage } from '../../hooks/useStorage';
import { StorageProvider } from '../../context/StorageProvider';
import {
  acceptTeamInvitation, createTeamWorkspace, listTeamWorkspaces, removeTeamMember,
  TeamAccessError, TeamWorkspaceRepository, type TeamWorkspace,
} from '../../services/storage/teamWorkspaceRepository';
import { ProjectDetailPage } from '../projects/ProjectDetailPage';
import { ProjectsPage } from '../projects/ProjectsPage';
import { ErrorBanner } from '../common/ErrorBanner';
import { UndoToast } from '../common/UndoToast';
import { navigate } from '../../utils/navigation';
import { isWorkspaceId, teamPath, teamSignInPath } from '../../utils/teamRoutes';
import { TeamAccessPanel } from './TeamAccessPanel';
import './TeamWorkspacesPage.css';

function TeamLayout({ back, backLabel, workspace, children }: {
  back: string;
  backLabel: string;
  workspace?: TeamWorkspace;
  children: ReactNode;
}) {
  return (
    <main className="content-frame team-workspaces">
      <nav className="team-breadcrumbs" aria-label="Workspace navigation">
        <button className="workspace-secondary" onClick={() => navigate(back)}>
          <ArrowLeft size={16} aria-hidden="true" />{backLabel}
        </button>
        {workspace && (
          <>
            <span aria-hidden="true">/</span>
            <button className="workspace-secondary" onClick={() => navigate(teamPath(workspace.id))} aria-label="Back to Projects">
              {workspace.name}
            </button>
          </>
        )}
      </nav>
      {children}
    </main>
  );
}

function TeamIndex({ userId, suggestedName, invite }: { userId: string; suggestedName: string; invite: string | null }) {
  const [workspaces, setWorkspaces] = useState<TeamWorkspace[] | null>(null);
  const [name, setName] = useState(invite ? suggestedName : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');

  useEffect(() => {
    if (invite) return;
    let current = true;
    void listTeamWorkspaces().then(result => {
      if (current) setWorkspaces(result);
    }).catch(() => {
      if (current) setListError('Could not load your workspaces. Reconnect and reload the page.');
    });
    return () => { current = false; };
  }, [invite]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const id = invite ? await acceptTeamInvitation(invite, name) : (await createTeamWorkspace(name)).id;
      navigate(teamPath(id));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open the workspace.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <TeamLayout back={invite ? '/workspaces' : '/projects'} backLabel={invite ? 'Shared workspaces' : 'Personal projects'}>
      <header className="team-heading">
        <UsersRound size={26} aria-hidden="true" />
        <h1 className="page-title">{invite ? 'Join a shared workspace' : 'Shared workspaces'}</h1>
      </header>
      {!invite && (
        <section aria-label="Your workspaces" className="team-list">
          {listError ? <p role="alert">{listError}</p> : !workspaces ? <p role="status">Loading workspaces…</p> :
            workspaces.length === 0 ? <p>Create a workspace to plan projects with other people.</p> :
            workspaces.map(workspace => (
              <button className="team-workspace-link" key={workspace.id} onClick={() => navigate(teamPath(workspace.id))}>
                <strong>{workspace.name}</strong>
                <span>{workspace.owner_id === userId ? 'Owner' : 'Collaborator'}</span>
              </button>
            ))}
        </section>
      )}
      <form className="team-panel team-form" onSubmit={submit}>
        <label>{invite ? 'Display name' : 'Workspace name'}
          <input value={name} onChange={event => setName(event.target.value)} required maxLength={80} disabled={busy} />
        </label>
        <button className="workspace-primary" disabled={busy || !name.trim()}>
          {invite ? 'Accept invitation' : 'Create workspace'}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </TeamLayout>
  );
}

function TeamProjects({ workspaceId, projectId }: { workspaceId: string; projectId?: string }) {
  const { projects } = useStorage();
  const project = projects.find(item => item.id === projectId);
  return (
    <>
      <ErrorBanner />
      <UndoToast />
      {project ? <ProjectDetailPage key={project.id} shared project={project} onBack={() => navigate(teamPath(workspaceId))} /> :
        <ProjectsPage shared onNavigateToProject={id => navigate(teamPath(workspaceId, id))} />}
    </>
  );
}

function TeamDetail({ userId, workspaceId, projectId }: { userId: string; workspaceId: string; projectId?: string }) {
  const repository = useMemo(() => new TeamWorkspaceRepository(workspaceId), [workspaceId]);
  const [workspace, setWorkspace] = useState<TeamWorkspace | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const value = await repository.refresh();
        if (current) {
          setWorkspace(value);
          setError('');
        }
      } catch (failure) {
        if (current) {
          if (failure instanceof TeamAccessError) setWorkspace(null);
          setError(failure instanceof Error ? failure.message : 'Could not open the workspace.');
        }
      } finally {
        pending = false;
      }
    };
    const requestRefresh = () => { void refresh(); };
    requestRefresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') requestRefresh();
    }, 15_000);
    window.addEventListener('focus', requestRefresh);
    window.addEventListener('online', requestRefresh);
    return () => {
      current = false;
      clearInterval(interval);
      window.removeEventListener('focus', requestRefresh);
      window.removeEventListener('online', requestRefresh);
    };
  }, [repository, attempt]);

  async function leave() {
    if (!window.confirm('Leave this shared workspace?')) return;
    setLeaving(true);
    setActionError('');
    try {
      await removeTeamMember(workspaceId, userId);
      navigate('/workspaces');
    } catch {
      setActionError('Could not leave the workspace. Please try again.');
    } finally {
      setLeaving(false);
    }
  }

  return (
    <TeamLayout back="/workspaces" backLabel="Shared workspaces" workspace={projectId ? workspace ?? undefined : undefined}>
      {error && <div role="alert" className="team-panel">
        <p>{error}</p>
        <button className="workspace-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button>
      </div>}
      {!workspace && !error && <p role="status">Opening shared workspace…</p>}
      {workspace && (
        <>
          {!projectId && (
            <header className="team-heading">
              <UsersRound size={22} aria-hidden="true" />
              <h1 className="page-title">{workspace.name}</h1>
            </header>
          )}
          {!projectId && (workspace.owner_id === userId ? <TeamAccessPanel workspaceId={workspaceId} /> :
            <button className="workspace-secondary" disabled={leaving} onClick={leave}>Leave workspace</button>)}
          {actionError && <p role="alert">{actionError}</p>}
          <StorageProvider repository={repository} applyWorkspaceAppearance={false}>
            <TeamProjects workspaceId={workspaceId} projectId={projectId} />
          </StorageProvider>
        </>
      )}
    </TeamLayout>
  );
}

export default function TeamWorkspacesPage({ location }: { location: string }) {
  const { session } = useAuth();
  if (!session || session.user.is_anonymous) return (
    <TeamLayout back="/" backLabel="Back to Todop">
      <h1 className="page-title">Shared workspaces</h1>
      <p>Sign in to open a shared workspace or accept an invitation.</p>
      <button className="workspace-primary" onClick={() => navigate(teamSignInPath(location))}>Sign in</button>
    </TeamLayout>
  );

  const route = new URL(location, window.location.origin);
  const invite = route.searchParams.get('invite');
  const [, , id, section, rawProjectId] = route.pathname.split('/');
  const userId = session.user.id;
  if (isWorkspaceId(id ?? null) && (!section || section === 'projects')) {
    let projectId: string | undefined;
    try { projectId = rawProjectId ? decodeURIComponent(rawProjectId) : undefined; } catch { /* Invalid project link. */ }
    return <TeamDetail key={`${userId}:${id}`} userId={userId} workspaceId={id} projectId={projectId} />;
  }
  if (id || (invite && !isWorkspaceId(invite))) return (
    <TeamLayout back="/workspaces" backLabel="Shared workspaces">
      <h1 className="page-title">Workspace link unavailable</h1>
      <p>Check the link or ask the workspace owner for a fresh invitation.</p>
    </TeamLayout>
  );
  return <TeamIndex key={`${userId}:${invite ?? ''}`} userId={userId} invite={invite}
    suggestedName={(session.user.email?.split('@')[0] ?? '').slice(0, 80)} />;
}
