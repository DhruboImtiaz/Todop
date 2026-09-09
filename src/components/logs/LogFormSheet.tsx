import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Trash2 } from 'lucide-react';
import type { Log } from '../../types';
import {
  getDefaultNewLogDateTime,
  isoToLocalDateAndTime,
  localDateTimeToIso,
} from '../../utils/time';
import { useStorage } from '../../hooks/useStorage';
import './LogFormSheet.css';

interface LogFormSheetProps {
  isOpen: boolean;
  initialLog?: Log | null;
  /** When opening from a project detail page, pre-select this project */
  defaultProjectId?: string | null;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    deadline: string;
    projectId?: string;
  }) => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const LogFormSheet: React.FC<LogFormSheetProps> = ({
  isOpen,
  initialLog,
  defaultProjectId,
  onClose,
  onSubmit,
  onComplete,
  onDelete,
}) => {
  const { projects } = useStorage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialLog) {
        setTitle(initialLog.title);
        setDescription(initialLog.description || '');
        const { date: d, time: t } = isoToLocalDateAndTime(initialLog.deadline);
        setDate(d);
        setTime(t);
        setProjectId(initialLog.projectId || '');
      } else {
        setTitle('');
        setDescription('');
        const { date: d, time: t } = getDefaultNewLogDateTime();
        setDate(d);
        setTime(t);
        // Pre-select defaultProjectId if provided
        setProjectId(defaultProjectId || '');
      }
      setError('');
      setShowDeleteConfirm(false);

      // Auto-focus title after sheet opens
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialLog]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showDeleteConfirm, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Please enter a log name');
      titleInputRef.current?.focus();
      return;
    }
    if (!date) {
      setError('Please select a deadline date');
      return;
    }

    const isoDeadline = localDateTimeToIso(date, time || '23:59');

    onSubmit({
      title: cleanTitle,
      description: description.trim() || undefined,
      deadline: isoDeadline,
      projectId: projectId || undefined,
    });
  };

  const handleCompleteClick = () => {
    if (initialLog && onComplete) {
      onComplete(initialLog.id);
    }
  };

  const handleConfirmDelete = () => {
    if (initialLog && onDelete) {
      onDelete(initialLog.id);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const isEditing = Boolean(initialLog);

  return (
    <div
      className="form-sheet-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="form-sheet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div className="form-sheet-header">
          <h2 id="sheet-title" className="form-sheet-title">
            {isEditing ? 'EDIT LOG' : 'NEW LOG'}
          </h2>
          <button
            type="button"
            className="form-sheet-close-btn"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form-sheet-content">
          {isEditing && initialLog && (
            <div className="form-field">
              <span className="form-label">Completion Status</span>
              <div className="form-status-badge">
                <span
                  className={`status-dot ${initialLog.completed ? 'completed' : 'active'}`}
                />
                <span>{initialLog.completed ? 'COMPLETED' : 'ACTIVE'}</span>
              </div>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="log-title-input" className="form-label">
              Log Name
            </label>
            <input
              id="log-title-input"
              ref={titleInputRef}
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Finish assignment"
              required
              autoComplete="off"
            />
          </div>

          <div className="form-field">
            <label htmlFor="log-desc-input" className="form-label">
              Description <span className="form-label-optional">(optional)</span>
            </label>
            <textarea
              id="log-desc-input"
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add key notes, links, or context..."
              rows={2}
            />
          </div>

          <div className="form-grid-row">
            <div className="form-field">
              <label htmlFor="log-date-input" className="form-label">
                Deadline Date
              </label>
              <input
                id="log-date-input"
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="log-time-input" className="form-label">
                Deadline Time
              </label>
              <input
                id="log-time-input"
                type="time"
                className="form-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="log-project-input" className="form-label">
              Project <span className="form-label-optional">(optional)</span>
            </label>
            <select
              id="log-project-input"
              className="form-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">No Project</option>
              {[...projects]
                .sort((a, b) => a.order - b.order)
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>

          {error && (
            <div
              style={{
                color: 'var(--overdue-text)',
                fontSize: '13px',
                marginTop: '-4px',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Actions */}
          {isEditing && initialLog ? (
            <div className="form-sheet-actions edit-actions-stack">
              <button type="submit" className="form-btn form-btn-primary">
                Save Changes
              </button>

              {!showDeleteConfirm ? (
                <div className="form-secondary-actions-row">
                  <button
                    type="button"
                    className="form-btn form-btn-secondary"
                    onClick={handleCompleteClick}
                    aria-label={initialLog.completed ? 'Mark as active' : 'Mark as complete'}
                  >
                    <Check size={16} strokeWidth={2.2} />
                    <span>{initialLog.completed ? 'Mark Active' : 'Mark as Complete'}</span>
                  </button>

                  <button
                    type="button"
                    className="form-btn form-btn-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    aria-label="Delete log"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                    <span>Delete Log</span>
                  </button>
                </div>
              ) : (
                <div className="delete-confirm-box" role="alert">
                  <p className="delete-confirm-text">
                    Permanently delete this log? This action cannot be undone.
                  </p>
                  <div className="delete-confirm-actions">
                    <button
                      type="button"
                      className="form-btn form-btn-secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="form-btn form-btn-danger-confirm"
                      onClick={handleConfirmDelete}
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="form-sheet-actions">
              <button
                type="button"
                className="form-btn form-btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="form-btn form-btn-primary">
                Create Log
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
