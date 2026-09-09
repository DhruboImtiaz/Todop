import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Check, Pencil, Trash2 } from 'lucide-react';
import type { Log } from '../../types';
import { getCountdown } from '../../utils/time';
import './LogCard.css';

interface LogCardProps {
  log: Log;
  currentTimestamp: number;
  onComplete: (id: string) => void;
  onEdit: (log: Log) => void;
  onDelete: (id: string) => void;
}

export const LogCard: React.FC<LogCardProps> = ({
  log,
  currentTimestamp,
  onComplete,
  onEdit,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const countdown = getCountdown(log.deadline, currentTimestamp);

  // Close overflow menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Prevent triggering edit if clicking on a button or menu
    if (target.closest('button') || target.closest('.log-overflow-dropdown')) {
      return;
    }
    onEdit(log);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      onEdit(log);
    }
  };

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onEdit(log);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete(log.id);
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onComplete(log.id);
  };

  return (
    <article
      className={`log-card ${log.completed ? 'completed' : countdown.isOverdue ? 'overdue' : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Log: ${log.title}, status: ${log.completed ? 'Completed' : countdown.label}. Tap to view or edit details.`}
    >
      <div className="log-card-header">
        <h3 className="log-card-title">{log.title}</h3>

        <div className="log-card-actions">
          <button
            type="button"
            className={`log-card-complete-btn ${log.completed ? 'completed' : ''}`}
            onClick={handleComplete}
            aria-label={log.completed ? `Mark "${log.title}" as active` : `Mark "${log.title}" as completed`}
            title={log.completed ? 'Mark as active' : 'Mark as completed'}
          >
            <Check size={14} strokeWidth={2.5} />
          </button>

          <button
            ref={buttonRef}
            type="button"
            className="log-card-overflow-btn"
            onClick={handleToggleMenu}
            aria-label={`Options for "${log.title}"`}
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <MoreVertical size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="log-card-countdown" aria-live="polite">
        {log.completed ? (
          <span className="completed-tag">COMPLETED</span>
        ) : countdown.isOverdue ? (
          <span className="overdue-tag">OVERDUE</span>
        ) : (
          <span>{countdown.label}</span>
        )}
      </div>

      {menuOpen && (
        <div ref={menuRef} className="log-overflow-dropdown" role="menu">
          <button
            type="button"
            className="log-overflow-item"
            role="menuitem"
            onClick={handleEdit}
          >
            <Pencil size={14} strokeWidth={1.8} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className="log-overflow-item delete-item"
            role="menuitem"
            onClick={handleDelete}
          >
            <Trash2 size={14} strokeWidth={1.8} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </article>
  );
};
