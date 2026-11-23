import { BrandLogo } from '../common/BrandLogo';
import React from 'react';
import type { NavigationTab } from '../../types';
import { plannerNavigation, plannerSecondaryNavigation, type PlannerNavItem } from './plannerNavigation';
import './Sidebar.css';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

function SidebarNavButton({
  item: { tab, icon: Icon, label, ariaLabel },
  isActive,
  onSelectTab,
}: {
  item: PlannerNavItem;
  isActive: boolean;
  onSelectTab: (tab: NavigationTab) => void;
}) {
  return (
    <button
      type="button"
      className="sidebar-nav-item"
      onClick={() => onSelectTab(tab)}
      aria-label={ariaLabel}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="sidebar-nav-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
      </span>
      <span className="sidebar-nav-label">{label}</span>
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
          aria-label="TODOP — Open Upcoming"
        >
          <BrandLogo />
        </button>
      </div>

      {/* Primary navigation */}
      <nav className="sidebar-nav" aria-label="Pages">
        {plannerNavigation.map((item) => (
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
        {plannerSecondaryNavigation.map((item) => (
          <SidebarNavButton
            key={item.tab}
            item={item}
            isActive={currentTab === item.tab}
            onSelectTab={onSelectTab}
          />
        ))}
      </div>
    </aside>
  );
};
