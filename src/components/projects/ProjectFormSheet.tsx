import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Project } from '../../types';
import './ProjectFormSheet.css';

interface ProjectFormSheetProps {
  isOpen: boolean;
  editingProject?: Project | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

/**
 * ProjectFormSheet — create or rename a project.
 *
 * State is initialised directly from props at mount time. The parent must
 * supply a stable `key` (e.g. editingProject?.id ?? 'new') so that React
 * remounts this component — and therefore resets local state — whenever the
 * editing context changes. This avoids the react/set-state-in-effect pattern.
 */
export const ProjectFormSheet: React.FC<ProjectFormSheetProps> = ({
  isOpen,
  editingProject,
  onClose,
  onSubmit,
}) => {
  // State is derived from props at initialisation only.
  // The parent controls remounting via a `key` prop.
  const [name, setName] = useState(editingProject?.name ?? '');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(editingProject);

  // Auto-focus and select text when the sheet opens.
  // No setState here — only DOM side-effects.
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Project name cannot be empty.');
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > 80) {
      setError('Project name must be 80 characters or fewer.');
      return;
    }
    onSubmit(trimmed);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="project-sheet-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="project-sheet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-sheet-title"
      >
        <div className="project-sheet-header">
          <h2 id="project-sheet-title" className="project-sheet-title">
            {isEditing ? 'RENAME PROJECT' : 'NEW PROJECT'}
          </h2>
          <button
            type="button"
            className="project-sheet-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="project-sheet-content">
          <div className="project-form-field">
            <label htmlFor="project-name-input" className="project-form-label">
              Project Name
            </label>
            <input
              id="project-name-input"
              ref={inputRef}
              type="text"
              className="project-form-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Thesis, Work, Personal"
              maxLength={80}
              autoComplete="off"
            />
            {error && (
              <div className="project-form-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="project-sheet-actions">
            <button
              type="button"
              className="project-btn project-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="project-btn project-btn-primary">
              {isEditing ? 'Save Name' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
