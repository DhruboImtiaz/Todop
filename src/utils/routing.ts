import type { AppRoute, NavigationTab } from '../types';

export function getRouteFromPath(path: string): AppRoute {
  const cleanPath = path.trim();
  const normalized = cleanPath.replace(/\/+$/, '').toLowerCase();

  if (normalized.startsWith('/projects/')) {
    const rawId = cleanPath.substring('/projects/'.length).replace(/\/+$/, '');
    if (rawId) {
      return { tab: 'projects', projectId: rawId };
    }
    return { tab: 'projects', projectId: null };
  }

  if (normalized === '/projects') return { tab: 'projects', projectId: null };
  if (normalized === '/calendar') return { tab: 'calendar' };
  if (normalized === '/search') return { tab: 'search' };
  if (normalized === '/settings') return { tab: 'settings' };
  return { tab: 'upcoming' };
}

export function getPathFromRoute(route: AppRoute): string {
  if (route.tab === 'projects') {
    return route.projectId ? `/projects/${encodeURIComponent(route.projectId)}` : '/projects';
  }
  if (route.tab === 'calendar') return '/calendar';
  if (route.tab === 'search') return '/search';
  if (route.tab === 'settings') return '/settings';
  return '/';
}

export function getTabFromPath(path: string): NavigationTab {
  return getRouteFromPath(path).tab;
}

export function getPathFromTab(tab: NavigationTab): string {
  return getPathFromRoute({ tab });
}
