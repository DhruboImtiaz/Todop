import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import type { NavigationTab } from '../../types';
import './TopBar.css';

interface TopBarProps {
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ currentTab, onNavigate }) => {
  return (
    <header className="top-bar-header" role="banner">
      <div className="top-bar-container">
        <button
          type="button"
          className="top-bar-brand"
          onClick={() => onNavigate('upcoming')}
          aria-label="TODOP Home - Navigate to Upcoming"
        >
          <span>TODOP</span>
          <span className="top-bar-brand-dot" aria-hidden="true" />
        </button>

        <button
          type="button"
          className={`top-bar-settings-btn ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate(currentTab === 'settings' ? 'upcoming' : 'settings')}
          aria-label="Settings"
          title="Settings"
        >
          <SettingsIcon size={20} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
};
