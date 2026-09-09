import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { Project } from '../../types';
import './DeleteProjectDialog.css';

interface DeleteProjectDialogProps {
  project: Project | null;
  affectedLogCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteProjectDialog: React.FC<DeleteProjectDialogProps> = ({
  project,
  affectedLogCount,
  onCancel,
  onConfirm,
}) => {
  if (!project) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      className="delete-dialog-backdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className="delete-dialog-box"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
      >
        <div className="delete-dialog-icon-row">
          <div className="delete-dialog-icon">
            <Trash2 size={20} strokeWidth={1.8} />
          </div>
        </div>

        <h2 id="delete-dialog-title" className="delete-dialog-title">
          Delete Project?
        </h2>

        <p id="delete-dialog-desc" className="delete-dialog-desc">
          <strong className="delete-dialog-project-name">{project.name}</strong>{' '}
          will be permanently deleted.
        </p>

        {affectedLogCount > 0 ? (
          <p className="delete-dialog-note">
            The {affectedLogCount} log{affectedLogCount !== 1 ? 's' : ''} inside this project will
            remain, but they will become unassigned.
          </p>
        ) : (
          <p className="delete-dialog-note">This project has no logs.</p>
        )}

        <div className="delete-dialog-actions">
          <button
            type="button"
            className="delete-dialog-btn delete-dialog-cancel"
            onClick={onCancel}
          >
            <X size={15} strokeWidth={2} />
            Cancel
          </button>
          <button
            type="button"
            className="delete-dialog-btn delete-dialog-confirm"
            onClick={onConfirm}
          >
            <Trash2 size={15} strokeWidth={2} />
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
};
