import type { AppDataSchema } from '../../types';
import { supabase } from '../supabase/client';
import { PlannerRepository } from './plannerRepository';
import type { StorageListener } from './storageRepository';
import { emptyWorkspace, parseRevision, type Revision } from './workspaceSnapshot';

export type TeamWorkspace = { id: string; owner_id: string; name: string };
export type TeamMember = { user_id: string; display_name: string };
export type TeamInvite = { token: string; expires_at: string };
const workspaceColumns = 'id,owner_id,name';

export async function listTeamWorkspaces(): Promise<TeamWorkspace[]> {
  const result = await supabase.from('team_workspaces').select(workspaceColumns).order('name');
  if (result.error) throw new Error('Could not load your shared workspaces.');
  return result.data;
}

export async function createTeamWorkspace(name: string): Promise<TeamWorkspace> {
  const result = await supabase.from('team_workspaces').insert({ name: name.trim() }).select(workspaceColumns).single();
  if (result.error) throw new Error('Could not create the shared workspace.');
  return result.data;
}

export async function acceptTeamInvitation(token: string, name: string): Promise<string> {
  const result = await supabase.rpc('join_team_workspace', { invite_token: token, member_name: name.trim() });
  if (result.error || !result.data) throw new Error('Could not join. Check your connection and ask the owner for a fresh invite if needed.');
  return result.data;
}

export async function loadTeamAccess(workspaceId: string): Promise<{ members: TeamMember[]; invites: TeamInvite[] }> {
  const [members, invites] = await Promise.all([
    supabase.from('team_workspace_members').select('user_id,display_name').eq('workspace_id', workspaceId).order('display_name'),
    supabase.from('team_workspace_invites').select('token,expires_at').eq('workspace_id', workspaceId)
      .gt('expires_at', new Date().toISOString()).order('expires_at', { ascending: false }),
  ]);
  if (members.error || invites.error) throw new Error('Could not load workspace access.');
  return { members: members.data, invites: invites.data };
}

export async function createTeamInvite(workspaceId: string): Promise<void> {
  const result = await supabase.from('team_workspace_invites').insert({ workspace_id: workspaceId });
  if (result.error) throw new Error('Could not create an invitation.');
}

export async function revokeTeamInvite(workspaceId: string, token: string): Promise<void> {
  const result = await supabase.from('team_workspace_invites').delete().eq('workspace_id', workspaceId).eq('token', token);
  if (result.error) throw new Error('Could not revoke the invitation.');
}

export async function removeTeamMember(workspaceId: string, userId: string): Promise<void> {
  const result = await supabase.from('team_workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  if (result.error) throw new Error('Could not change workspace access.');
}

export class TeamAccessError extends Error {}

export class TeamWorkspaceRepository extends PlannerRepository {
  private readonly id: string;
  private current: Revision = { revision: -1, data: emptyWorkspace() };
  private listeners = new Set<StorageListener>();
  private readRevisions = new WeakMap<AppDataSchema, number>();

  constructor(workspaceId: string) {
    super();
    this.id = workspaceId;
  }

  getSnapshot = () => this.current.data;
  subscribe = (listener: StorageListener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(value: Revision) {
    if (value.revision <= this.current.revision) return;
    this.current = value;
    for (const listener of this.listeners) listener();
  }

  async refresh(): Promise<TeamWorkspace> {
    const result = await supabase.from('team_workspaces')
      .select(`${workspaceColumns}, data, revision`).eq('id', this.id).maybeSingle();
    if (result.error) throw new Error('Could not connect to the shared workspace.');
    if (!result.data) throw new TeamAccessError('This workspace is unavailable to your account.');
    this.publish(parseRevision(result.data));
    const { id, owner_id, name } = result.data;
    return { id, owner_id, name };
  }

  protected async readData(): Promise<AppDataSchema> {
    await this.refresh();
    const data = structuredClone(this.current.data);
    this.readRevisions.set(data, this.current.revision);
    return data;
  }

  protected async writeData(data: AppDataSchema): Promise<void> {
    const revision = this.readRevisions.get(data);
    if (revision === undefined) throw new Error('Open the shared workspace before making changes.');
    const result = await supabase.from('team_workspaces').update({ data })
      .eq('id', this.id).eq('revision', revision).select('revision').maybeSingle();
    if (result.error) throw new Error('Could not save your shared change. Check your connection and retry.');
    if (!result.data) {
      await this.refresh();
      throw new Error('The workspace changed while you were editing. The latest version is loaded. Please retry.');
    }
    this.publish({ revision: result.data.revision, data });
  }
}
