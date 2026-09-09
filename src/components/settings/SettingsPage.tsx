import React, { useRef, useState } from 'react';
import { Download, Moon, Sun, Type, Upload, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useStorage } from '../../hooks/useStorage';
import type { AppDataSchema, AppFontSize, AppTheme } from '../../types';
import { createBackup, downloadBackupFile, validateBackup } from '../../utils/backup';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    activeLogs,
    completedLogs,
    projects,
    exportData,
    importData,
  } = useStorage();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingRestoreData, setPendingRestoreData] = useState<AppDataSchema | null>(null);
  const [pendingSummary, setPendingSummary] = useState<{ logCount: number; projectCount: number } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  const currentTheme: AppTheme = settings?.theme === 'dark' ? 'dark' : 'light';
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

  // Backup Data handler
  const handleBackupData = async () => {
    try {
      setRestoreError(null);
      setRestoreSuccess(null);
      const appData = await exportData();
      const backup = createBackup(appData);
      downloadBackupFile(backup);
    } catch (err) {
      console.error('Failed to create backup', err);
      setRestoreError('Failed to generate backup file.');
    }
  };

  // Trigger file picker
  const handleOpenRestorePicker = () => {
    setRestoreError(null);
    setRestoreSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle selected JSON file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content !== 'string') {
        setRestoreError('INVALID BACKUP: The selected file could not be read. No existing data was changed.');
        return;
      }

      const validation = validateBackup(content);
      if (!validation.valid) {
        setRestoreError(`INVALID BACKUP: The selected file could not be restored. ${validation.error} No existing data was changed.`);
        return;
      }

      // Valid backup: stage for confirmation
      setPendingRestoreData(validation.data);
      setPendingSummary({
        logCount: validation.data.logs.length,
        projectCount: validation.data.projects.length,
      });
      setIsConfirmModalOpen(true);
    };

    reader.onerror = () => {
      setRestoreError('INVALID BACKUP: Error reading file. No existing data was changed.');
    };

    reader.readAsText(file);
  };

  // Cancel restore
  const handleCancelRestore = () => {
    setIsConfirmModalOpen(false);
    setPendingRestoreData(null);
    setPendingSummary(null);
  };

  // Confirm restore: atomic replacement
  const handleConfirmRestore = async () => {
    if (!pendingRestoreData) return;

    try {
      await importData(pendingRestoreData);
      setIsConfirmModalOpen(false);
      setPendingRestoreData(null);
      setPendingSummary(null);
      setRestoreError(null);
      setRestoreSuccess('DATA RESTORED: Your TODOP data has been restored successfully.');
    } catch (err) {
      console.error('Failed to restore data', err);
      setRestoreError('RESTORE FAILED: An error occurred while applying the backup. Existing data was preserved.');
      setIsConfirmModalOpen(false);
    }
  };

  return (
    <div className="settings-page">
      {/* Hidden Native File Picker */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {/* Header */}
      <div className="settings-header">
        <h1 className="settings-heading">SETTINGS</h1>
        <p className="settings-subtitle">Customize your TODOP experience.</p>
      </div>

      {/* Feedback Messages */}
      {restoreError && (
        <div className="settings-feedback-banner error" role="alert">
          <AlertTriangle size={18} className="feedback-icon" />
          <div className="feedback-text-wrap">
            <span className="feedback-title">INVALID BACKUP</span>
            <span className="feedback-desc">{restoreError}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setRestoreError(null)}
            aria-label="Dismiss error"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {restoreSuccess && (
        <div className="settings-feedback-banner success" role="status">
          <CheckCircle2 size={18} className="feedback-icon" />
          <div className="feedback-text-wrap">
            <span className="feedback-title">DATA RESTORED</span>
            <span className="feedback-desc">{restoreSuccess}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setRestoreSuccess(null)}
            aria-label="Dismiss message"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Data Backup & Restore Section */}
      <section className="settings-section" aria-labelledby="data-heading">
        <h2 id="data-heading" className="settings-section-title">
          DATA
        </h2>

        <div className="settings-card">
          <div className="settings-item-info">
            <span className="settings-item-name">Backup & Restore</span>
            <span className="settings-item-desc">
              Save your logs, projects, and settings to a file.
            </span>
          </div>

          <div className="settings-data-actions">
            <button
              type="button"
              className="settings-action-btn primary"
              onClick={handleBackupData}
            >
              <Download size={16} strokeWidth={2.2} />
              <span>BACKUP DATA</span>
            </button>

            <button
              type="button"
              className="settings-action-btn secondary"
              onClick={handleOpenRestorePicker}
            >
              <Upload size={16} strokeWidth={2.2} />
              <span>RESTORE DATA</span>
            </button>
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="settings-section-title">
          APPEARANCE
        </h2>

        <div className="settings-card">
          <div className="settings-item-info">
            <span className="settings-item-name">Theme</span>
            <span className="settings-item-desc">
              Choose between clean light mode (default) and dark mode
            </span>
          </div>

          <div
            className="segmented-control"
            role="radiogroup"
            aria-label="App Theme"
          >
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

      {/* Restore Confirmation Modal */}
      {isConfirmModalOpen && (
        <div
          className="restore-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelRestore();
          }}
          role="presentation"
        >
          <div
            className="restore-modal-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="restore-modal-title"
            aria-describedby="restore-modal-desc"
          >
            <div className="restore-modal-icon-row">
              <div className="restore-modal-icon">
                <AlertTriangle size={22} strokeWidth={2} />
              </div>
            </div>

            <h2 id="restore-modal-title" className="restore-modal-title">
              CONFIRM RESTORE
            </h2>

            <p id="restore-modal-desc" className="restore-modal-desc">
              This will replace your current TODOP data with the backup.
            </p>

            {pendingSummary && (
              <div className="restore-modal-summary">
                <span>Backup contains:</span>
                <strong>
                  {pendingSummary.logCount} log{pendingSummary.logCount !== 1 ? 's' : ''},{' '}
                  {pendingSummary.projectCount} project{pendingSummary.projectCount !== 1 ? 's' : ''}, and saved settings.
                </strong>
              </div>
            )}

            <div className="restore-modal-actions">
              <button
                type="button"
                className="restore-modal-btn cancel"
                onClick={handleCancelRestore}
              >
                <X size={15} strokeWidth={2} />
                <span>CANCEL</span>
              </button>
              <button
                type="button"
                className="restore-modal-btn confirm"
                onClick={handleConfirmRestore}
              >
                <Upload size={15} strokeWidth={2} />
                <span>RESTORE DATA</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
