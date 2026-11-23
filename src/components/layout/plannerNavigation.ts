import { CalendarClock, FolderGit2, Calendar, Search, Settings, Trash2, type LucideIcon } from 'lucide-react';
import type { NavigationTab } from '../../types';

export type PlannerNavItem = {
  tab: NavigationTab;
  icon: LucideIcon;
  label: string;
  ariaLabel?: string;
};

export const plannerNavigation: PlannerNavItem[] = [
  { tab: 'upcoming', icon: CalendarClock, label: 'Upcoming', ariaLabel: 'Upcoming tasks' },
  { tab: 'projects', icon: FolderGit2, label: 'Projects' },
  { tab: 'calendar', icon: Calendar, label: 'Calendar' },
  { tab: 'search', icon: Search, label: 'Search' },
];

export const plannerSecondaryNavigation: PlannerNavItem[] = [
  { tab: 'trash', icon: Trash2, label: 'Recently deleted' },
  { tab: 'settings', icon: Settings, label: 'Settings' },
];
