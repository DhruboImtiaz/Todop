import React from 'react';
import { CalendarClock, FolderGit2, Calendar, Search, Settings } from 'lucide-react';
import type { NavigationTab } from '../../types';
import './Sidebar.css';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

interface NavItem {
  tab: NavigationTab;
  icon: React.ReactElement;
  label: string;
  ariaLabel: string;
}

const PRIMARY_NAV: NavItem[] = [
  {
    tab: 'upcoming',
    icon: <CalendarClock size={20} strokeWidth={1.8} />,
    label: 'UPCOMING',
    ariaLabel: 'Upcoming tasks',
  },
  {
    tab: 'projects',
    icon: <FolderGit2 size={20} strokeWidth={1.8} />,
    label: 'PROJECTS',
    ariaLabel: 'Projects',
  },
  {
    tab: 'calendar',
    icon: <Calendar size={20} strokeWidth={1.8} />,
    label: 'CALENDAR',
    ariaLabel: 'Calendar',
  },
  {
    tab: 'search',
    icon: <Search size={20} strokeWidth={1.8} />,
    label: 'SEARCH',
    ariaLabel: 'Search',
  },
];

function SidebarNavButton({
  item,
  isActive,
  onSelectTab,
}: {
  item: NavItem;
  isActive: boolean;
  onSelectTab: (tab: NavigationTab) => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-nav-item${isActive ? ' active' : ''}`}
      onClick={() => onSelectTab(item.tab)}
      aria-label={item.ariaLabel}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="sidebar-nav-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="sidebar-nav-label">{item.label}</span>
    </button>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      {/* Brand */}
      <div className="sidebar-brand-wrap">
        <button
          type="button"
          className="sidebar-brand"
          onClick={() => onSelectTab('upcoming')}
          aria-label="TODOP — Navigate to Upcoming"
        >
          <span>TODOP</span>
          <span className="sidebar-brand-dot" aria-hidden="true" />
        </button>
      </div>

      {/* Primary navigation */}
      <nav className="sidebar-nav" aria-label="Pages">
        {PRIMARY_NAV.map((item) => (
          <SidebarNavButton
            key={item.tab}
            item={item}
            isActive={currentTab === item.tab}
            onSelectTab={onSelectTab}
          />
        ))}
      </nav>

      {/* Settings at the bottom */}
      <div className="sidebar-footer">
        <SidebarNavButton
          item={{
            tab: 'settings',
            icon: <Settings size={20} strokeWidth={1.8} />,
            label: 'SETTINGS',
            ariaLabel: 'Settings',
          }}
          isActive={currentTab === 'settings'}
          onSelectTab={onSelectTab}
        />
      </div>
    </aside>
  );
};
