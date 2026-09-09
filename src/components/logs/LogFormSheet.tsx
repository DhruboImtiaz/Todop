import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Trash2, Plus } from 'lucide-react';
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
    draftSubtasks?: string[];
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
  const {
    projects,
    activeLogs,
    completedLogs,
    addSubtask,
    updateSubtaskTitle,
    toggleSubtaskCompletion,
    deleteSubtask,
  } = useStorage();

  const isEditing = Boolean(initialLog);
  const currentReactiveLog = initialLog
    ? activeLogs.find((l) => l.id === initialLog.id) ||
      completedLogs.find((l) => l.id === initialLog.id) ||
      initialLog
    : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Subtasks state
  const [draftSubtasks, setDraftSubtasks] = useState<string[]>([]);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDraftIndex, setEditingDraftIndex] = useState<number | null>(null);
  const [editingDraftTitle, setEditingDraftTitle] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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
        setProjectId(defaultProjectId || '');
      }
      setDraftSubtasks([]);
      setIsAddingSubtask(false);
      setSubtaskInput('');
      setEditingSubtaskId(null);
      setEditingTitle('');
      setEditingDraftIndex(null);
      setEditingDraftTitle('');
      setError('');
      setShowDeleteConfirm(false);

      // Auto-focus title after sheet opens
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialLog, defaultProjectId]);

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

  // Subtask handlers for existing logs
  const handleAddSubtask = async () => {
    const clean = subtaskInput.trim();
    if (!clean) return;
    if (initialLog) {
      await addSubtask(initialLog.id, clean);
    } else {
      setDraftSubtasks((prev) => [...prev, clean]);
    }
    setSubtaskInput('');
    setTimeout(() => subtaskInputRef.current?.focus(), 30);
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (initialLog) {
      await toggleSubtaskCompletion(initialLog.id, subtaskId);
    }
  };

  const handleStartEditSubtask = (id: string, currentText: string) => {
    setEditingSubtaskId(id);
    setEditingTitle(currentText);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleSaveSubtaskTitle = async (subtaskId: string) => {
    const clean = editingTitle.trim();
    if (clean && initialLog) {
      await updateSubtaskTitle(initialLog.id, subtaskId, clean);
    }
    setEditingSubtaskId(null);
    setEditingTitle('');
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (initialLog) {
      await deleteSubtask(initialLog.id, subtaskId);
    }
  };

  // Subtask handlers for new logs (draft items)
  const handleStartEditDraft = (index: number, currentText: string) => {
    setEditingDraftIndex(index);
    setEditingDraftTitle(currentText);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleSaveDraftTitle = (index: number) => {
    const clean = editingDraftTitle.trim();
    if (clean) {
      setDraftSubtasks((prev) => prev.map((t, i) => (i === index ? clean : t)));
    }
    setEditingDraftIndex(null);
    setEditingDraftTitle('');
  };

  const handleDeleteDraft = (index: number) => {
    setDraftSubtasks((prev) => prev.filter((_, i) => i !== index));
  };

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

    if (initialLog) {
      // For existing logs, subtasks are already saved directly in repository
      onSubmit({
        title: cleanTitle,
        description: description.trim() || undefined,
        deadline: isoDeadline,
        projectId: projectId || undefined,
      });
    } else {
      // For new logs, pass draftSubtasks so they are created after the parent Log is created
      onSubmit({
        title: cleanTitle,
        description: description.trim() || undefined,
        deadline: isoDeadline,
        projectId: projectId || undefined,
        draftSubtasks: draftSubtasks.length > 0 ? draftSubtasks : undefined,
      });
    }
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

          {/* Subtasks Section */}
          <div className="form-field subtasks-form-section">
            <div className="subtasks-section-header">
              <span className="form-label">
                SUBTASKS
                {isEditing && currentReactiveLog && currentReactiveLog.subtasks.length > 0 && (
                  <span className="subtasks-count-pill">
                    {currentReactiveLog.subtasks.filter((s) => s.completed).length} / {currentReactiveLog.subtasks.length}
                  </span>
                )}
                {!isEditing && draftSubtasks.length > 0 && (
                  <span className="subtasks-count-pill">
                    {draftSubtasks.length}
                  </span>
                )}
              </span>
            </div>

            {/* Existing Log Subtasks List */}
            {isEditing && currentReactiveLog && currentReactiveLog.subtasks.length > 0 && (
              <div className="subtasks-list" role="list">
                {currentReactiveLog.subtasks.map((st) => {
                  const isEditingThis = editingSubtaskId === st.id;
                  return (
                    <div key={st.id} className="subtask-row" role="listitem">
                      <button
                        type="button"
                        className={`subtask-checkbox ${st.completed ? 'completed' : ''}`}
                        onClick={() => handleToggleSubtask(st.id)}
                        role="checkbox"
                        aria-checked={st.completed}
                        aria-label={st.completed ? `Mark "${st.title}" as incomplete` : `Mark "${st.title}" as completed`}
                      >
                        <Check size={12} strokeWidth={2.8} />
                      </button>

                      {isEditingThis ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          className="subtask-inline-edit-input"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveSubtaskTitle(st.id);
                            } else if (e.key === 'Escape') {
                              e.stopPropagation();
                              setEditingSubtaskId(null);
                            }
                          }}
                          onBlur={() => handleSaveSubtaskTitle(st.id)}
                          aria-label="Edit subtask title"
                        />
                      ) : (
                        <span
                          className={`subtask-text ${st.completed ? 'completed' : ''}`}
                          onClick={() => handleStartEditSubtask(st.id, st.title)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Subtask: ${st.title}. Tap or press Enter to edit.`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleStartEditSubtask(st.id, st.title);
                            }
                          }}
                        >
                          {st.title}
                        </span>
                      )}

                      <button
                        type="button"
                        className="subtask-delete-btn"
                        onClick={() => handleDeleteSubtask(st.id)}
                        aria-label={`Delete subtask "${st.title}"`}
                        title="Delete subtask"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* New Log Draft Subtasks List */}
            {!isEditing && draftSubtasks.length > 0 && (
              <div className="subtasks-list" role="list">
                {draftSubtasks.map((draftTitle, idx) => {
                  const isEditingThis = editingDraftIndex === idx;
                  return (
                    <div key={idx} className="subtask-row" role="listitem">
                      <span className="subtask-checkbox draft" aria-hidden="true" />

                      {isEditingThis ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          className="subtask-inline-edit-input"
                          value={editingDraftTitle}
                          onChange={(e) => setEditingDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveDraftTitle(idx);
                            } else if (e.key === 'Escape') {
                              e.stopPropagation();
                              setEditingDraftIndex(null);
                            }
                          }}
                          onBlur={() => handleSaveDraftTitle(idx)}
                          aria-label="Edit subtask title"
                        />
                      ) : (
                        <span
                          className="subtask-text"
                          onClick={() => handleStartEditDraft(idx, draftTitle)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Draft subtask: ${draftTitle}. Tap or press Enter to edit.`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleStartEditDraft(idx, draftTitle);
                            }
                          }}
                        >
                          {draftTitle}
                        </span>
                      )}

                      <button
                        type="button"
                        className="subtask-delete-btn"
                        onClick={() => handleDeleteDraft(idx)}
                        aria-label={`Delete subtask "${draftTitle}"`}
                        title="Delete subtask"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Subtask Input or Trigger Button */}
            {!isAddingSubtask ? (
              <button
                type="button"
                className="subtask-add-trigger"
                onClick={() => {
                  setIsAddingSubtask(true);
                  setSubtaskInput('');
                  setTimeout(() => subtaskInputRef.current?.focus(), 50);
                }}
              >
                <Plus size={16} strokeWidth={2.4} />
                <span>ADD SUBTASK</span>
              </button>
            ) : (
              <div className="subtask-add-box">
                <input
                  ref={subtaskInputRef}
                  type="text"
                  className="subtask-add-input"
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  placeholder="Enter subtask item..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    } else if (e.key === 'Escape') {
                      e.stopPropagation();
                      setIsAddingSubtask(false);
                      setSubtaskInput('');
                    }
                  }}
                  autoComplete="off"
                  aria-label="New subtask title"
                />
                <div className="subtask-add-btn-group">
                  <button
                    type="button"
                    className="subtask-inline-btn primary"
                    onClick={handleAddSubtask}
                    disabled={!subtaskInput.trim()}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    className="subtask-inline-btn secondary"
                    onClick={() => {
                      setIsAddingSubtask(false);
                      setSubtaskInput('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
