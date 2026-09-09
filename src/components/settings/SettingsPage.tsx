import React from 'react';
import { Moon, Sun, Type } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import type { AppFontSize, AppTheme } from '../../types';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, activeLogs, completedLogs, projects } = useStorage();

  const currentTheme: AppTheme = settings?.theme === 'light' ? 'light' : 'dark';
  const currentFontSize: AppFontSize =
    settings?.fontSize === 'small' || settings?.fontSize === 'large'
      ? settings?.fontSize
      : 'medium';

  const handleThemeChange = async (theme: AppTheme) => {
    if (theme === currentTheme) return;
    await updateSettings({ theme });
  };

  const handleFontSizeChange = async (fontSize: AppFontSize) => {
    if (fontSize === currentFontSize) return;
    await updateSettings({ fontSize });
  };

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <h1 className="settings-heading">SETTINGS</h1>
        <p className="settings-subtitle">Customize your TODOP experience.</p>
      </div>

      {/* Appearance Section */}
      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="settings-section-title">
          APPEARANCE
        </h2>

        <div className="settings-card">
          <div className="settings-item-info">
            <span className="settings-item-name">Theme</span>
            <span className="settings-item-desc">
              Choose between dark mode and clean high-contrast light mode
            </span>
          </div>

          <div
            className="segmented-control"
            role="radiogroup"
            aria-label="App Theme"
          >
            <button
              type="button"
              className={`segmented-control-btn ${currentTheme === 'dark' ? 'active' : ''}`}
              role="radio"
              aria-checked={currentTheme === 'dark'}
              onClick={() => handleThemeChange('dark')}
            >
              <Moon size={15} strokeWidth={2} />
              <span>DARK</span>
            </button>

            <button
              type="button"
              className={`segmented-control-btn ${currentTheme === 'light' ? 'active' : ''}`}
              role="radio"
              aria-checked={currentTheme === 'light'}
              onClick={() => handleThemeChange('light')}
            >
              <Sun size={15} strokeWidth={2} />
              <span>LIGHT</span>
            </button>
          </div>
        </div>
      </section>

      {/* Font Size Section */}
      <section className="settings-section" aria-labelledby="fontsize-heading">
        <h2 id="fontsize-heading" className="settings-section-title">
          TEXT SIZE
        </h2>

        <div className="settings-card">
          <div className="settings-item-info">
            <span className="settings-item-name">Font Scale</span>
            <span className="settings-item-desc">
              Adjust readability of logs, labels, and text across all views
            </span>
          </div>

          <div
            className="segmented-control"
            role="radiogroup"
            aria-label="Text Size"
          >
            <button
              type="button"
              className={`segmented-control-btn ${currentFontSize === 'small' ? 'active' : ''}`}
              role="radio"
              aria-checked={currentFontSize === 'small'}
              onClick={() => handleFontSizeChange('small')}
            >
              <Type size={13} strokeWidth={2} />
              <span>SMALL</span>
            </button>

            <button
              type="button"
              className={`segmented-control-btn ${currentFontSize === 'medium' ? 'active' : ''}`}
              role="radio"
              aria-checked={currentFontSize === 'medium'}
              onClick={() => handleFontSizeChange('medium')}
            >
              <Type size={15} strokeWidth={2} />
              <span>MEDIUM</span>
            </button>

            <button
              type="button"
              className={`segmented-control-btn ${currentFontSize === 'large' ? 'active' : ''}`}
              role="radio"
              aria-checked={currentFontSize === 'large'}
              onClick={() => handleFontSizeChange('large')}
            >
              <Type size={17} strokeWidth={2.2} />
              <span>LARGE</span>
            </button>
          </div>
        </div>
      </section>

      {/* Storage & Architecture Info */}
      <section className="settings-section" aria-labelledby="storage-info-heading">
        <h2 id="storage-info-heading" className="settings-section-title">
          STORAGE & ARCHITECTURE
        </h2>

        <div className="settings-card">
          <div className="settings-meta-list">
            <div className="settings-meta-row">
              <span className="settings-meta-label">Storage Engine</span>
              <span className="settings-meta-value">LocalStorage (Schema v1)</span>
            </div>
            <div className="settings-meta-row">
              <span className="settings-meta-label">Active Logs</span>
              <span className="settings-meta-value">{activeLogs.length}</span>
            </div>
            <div className="settings-meta-row">
              <span className="settings-meta-label">Completed Logs</span>
              <span className="settings-meta-value">{completedLogs.length}</span>
            </div>
            <div className="settings-meta-row">
              <span className="settings-meta-label">Projects</span>
              <span className="settings-meta-value">{projects.length}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
