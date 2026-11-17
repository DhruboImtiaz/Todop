const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export const isWorkspaceId = (value: string | null): value is string => value !== null && uuid.test(value);
export const isTeamPath = (path: string) => path === '/workspaces' || path.startsWith('/workspaces/');
export const teamPath = (workspaceId: string, projectId?: string) =>
  `/workspaces/${workspaceId}${projectId ? `/projects/${encodeURIComponent(projectId)}` : ''}`;

export function teamSignInPath(next: string) {
  return `/auth?next=${encodeURIComponent(next)}`;
}

export function accountReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/workspaces') || raw.includes('\\')) return '/app';
  const route = new URL(raw, window.location.origin);
  return route.origin === window.location.origin && isTeamPath(route.pathname) ? route.pathname + route.search : '/app';
}
