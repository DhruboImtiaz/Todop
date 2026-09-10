import React from 'react';
import { CalendarClock, FolderGit2, Calendar, Search } from 'lucide-react';
import type { NavigationTab } from '../../types';
import './BottomNav.css';

interface BottomNavProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  return (
    <nav className="bottom-nav-bar" aria-label="Main Navigation">
      <div className="bottom-nav-container">
        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => onSelectTab('upcoming')}
          aria-label="Upcoming tasks"
          aria-current={currentTab === 'upcoming' ? 'page' : undefined}
        >
          <div className="bottom-nav-icon-wrap">
            <CalendarClock size={20} strokeWidth={currentTab === 'upcoming' ? 2.2 : 1.8} />
          </div>
          <span className="bottom-nav-label">UPCOMING</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'projects' ? 'active' : ''}`}
          onClick={() => onSelectTab('projects')}
          aria-label="Projects"
          aria-current={currentTab === 'projects' ? 'page' : undefined}
        >
          <div className="bottom-nav-icon-wrap">
            <FolderGit2 size={20} strokeWidth={currentTab === 'projects' ? 2.2 : 1.8} />
          </div>
          <span className="bottom-nav-label">PROJECTS</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'calendar' ? 'active' : ''}`}
          onClick={() => onSelectTab('calendar')}
          aria-label="Calendar"
          aria-current={currentTab === 'calendar' ? 'page' : undefined}
        >
          <div className="bottom-nav-icon-wrap">
            <Calendar size={20} strokeWidth={currentTab === 'calendar' ? 2.2 : 1.8} />
          </div>
          <span className="bottom-nav-label">CALENDAR</span>
        </button>

        <button
          type="button"
          className={`bottom-nav-item ${currentTab === 'search' ? 'active' : ''}`}
          onClick={() => onSelectTab('search')}
          aria-label="Search"
          aria-current={currentTab === 'search' ? 'page' : undefined}
        >
          <div className="bottom-nav-icon-wrap">
            <Search size={20} strokeWidth={currentTab === 'search' ? 2.2 : 1.8} />
          </div>
          <span className="bottom-nav-label">SEARCH</span>
        </button>
      </div>
    </nav>
  );
};
