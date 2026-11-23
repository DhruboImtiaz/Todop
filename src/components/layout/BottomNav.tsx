import type { NavigationTab } from '../../types';
import { plannerNavigation } from './plannerNavigation';
import './BottomNav.css';

interface BottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  return (
    <nav className="bottom-nav-bar" aria-label="Main Navigation">
      <div className="bottom-nav-container">
        {plannerNavigation.map(({ tab, icon: Icon, label, ariaLabel }) => {
          const active = currentTab === tab;
          return (
            <button
              key={tab}
              type="button"
              className="bottom-nav-item"
              onClick={() => onSelectTab(tab)}
              aria-label={ariaLabel}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              <span className="bottom-nav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
