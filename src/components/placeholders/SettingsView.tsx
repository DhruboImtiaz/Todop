import React from 'react';
import { useStorage } from '../../hooks/useStorage';
import './Placeholder.css';

interface SettingsViewProps {
  onBackToUpcoming: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBackToUpcoming }) => {
  const { activeLogs, completedLogs } = useStorage();

  return (
    <section className="placeholder-page" aria-labelledby="settings-heading">
      <div className="placeholder-header">
        <h1 id="settings-heading" className="placeholder-title">
          SETTINGS
        </h1>
        <p className="placeholder-subtitle">Preferences & Storage Architecture</p>
      </div>

      <div className="settings-list">
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Theme</div>
            <div className="settings-item-desc">Pure dark with Cyan accent</div>
          </div>
          <span className="settings-item-value">DARK</span>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-item-label">Storage Engine</div>
            <div className="settings-item-desc">Centralized LocalStorage Repository</div>
          </div>
          <span className="settings-item-value">SCHEMA V1</span>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-item-label">Active Tasks</div>
            <div className="settings-item-desc">Visible on Upcoming page</div>
          </div>
          <span className="settings-item-value">{activeLogs.length}</span>
        </div>

        <div className="settings-item">
          <div>
            <div className="settings-item-label">Completed Tasks</div>
            <div className="settings-item-desc">Preserved locally for archive & search</div>
          </div>
          <span className="settings-item-value">{completedLogs.length}</span>
        </div>
      </div>

      <div className="placeholder-card" style={{ marginTop: '8px' }}>
        <span className="placeholder-tag">Phase 2 Roadmap</span>
        <p className="placeholder-text">
          JSON Backup & Restore, Font size toggles, and notification settings are queued for Phase 2.
        </p>
        <button
          type="button"
          className="placeholder-back-btn"
          onClick={onBackToUpcoming}
        >
          Back to Upcoming
        </button>
      </div>
    </section>
  );
};
