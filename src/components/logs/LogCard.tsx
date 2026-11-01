import { useStorage } from "../../hooks/useStorage";
import { getLocalDateKey } from "../../utils/calendar";
import { recurrenceLabel } from "../../utils/planning";
import { runUiAction } from "../../utils/asyncAction";
import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Check,
  CheckCheck,
  Pencil,
  Trash2,
  Repeat2,
  Sunrise,
} from "lucide-react";
import type { Log } from "../../types";
import { getCountdown } from "../../utils/time";
import "./LogCard.css";

interface LogCardProps {
  log: Log;
  currentTimestamp: number;
  onComplete: (id: string) => void | Promise<void>;
  onEdit: (log: Log) => void;
  onDelete: (id: string) => void | Promise<void>;
}

export const LogCard: React.FC<LogCardProps> = ({
  log,
  currentTimestamp,
  onComplete,
  onEdit,
  onDelete,
}) => {
  const { planMyDay, projects } = useStorage();
  const project = projects.find((project) => project.id === log.projectId);
  const today = getLocalDateKey(new Date(currentTimestamp));
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
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Prevent triggering edit if clicking on a button or menu
    if (target.closest("button") || target.closest(".log-overflow-dropdown")) {
      return;
    }
    onEdit(log);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
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
    runUiAction(() => onDelete(log.id));
  };

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    runUiAction(() => onComplete(log.id));
  };

  return (
    <article
      className={`log-card ${log.completed ? "completed" : countdown.isOverdue ? "overdue" : ""} ${menuOpen ? "menu-open" : ""}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Log: ${log.title}, status: ${log.completed ? "Completed" : countdown.label}${log.subtasks && log.subtasks.length > 0 ? `, ${log.subtasks.filter((s) => s.completed).length} of ${log.subtasks.length} subtasks completed` : ""}. Tap to view or edit details.`}
    >
      <button
        type="button"
        className={`log-card-complete-btn ${log.completed ? "completed" : ""}`}
        onClick={handleComplete}
        aria-pressed={log.completed}
        aria-label={
          log.completed
            ? `Mark "${log.title}" as active`
            : `Mark "${log.title}" as completed`
        }
        title={log.completed ? "Mark as active" : "Mark as completed"}
      >
        <Check size={17} strokeWidth={2.5} />
      </button>
      <div className="log-card-details">
        <h3 className="log-card-title">{log.title}</h3>
        <div className="log-card-project">
          <span className="log-project-dot" />
          {project?.name ?? "Personal"}
          {log.subtasks.length > 0 && (
            <span className="log-card-subtasks">
              {" "}
              · {log.subtasks.filter((s) => s.completed).length}/
              {log.subtasks.length} subtasks
            </span>
          )}
        </div>
        {((log.priority && log.priority !== "normal") ||
          log.recurrence ||
          log.myDay === today) && (
          <div className="task-meta-line">
            {log.priority && log.priority !== "normal" && (
              <span className={`meta-${log.priority}`}>
                {log.priority === "high" ? "High priority" : "Low priority"}
              </span>
            )}
            {log.recurrence && (
              <span>
                <Repeat2 size={11} />
                {recurrenceLabel(log.recurrence)}
              </span>
            )}
            {log.myDay === today && (
              <span className="meta-day">
                <Sunrise size={11} />
                My Day
              </span>
            )}
          </div>
        )}
      </div>
      <div className="log-card-actions">
        {(log.deadline || log.completed) && (
          <div className="log-card-countdown" aria-live="polite">
            {log.completed ? (
              <CheckCheck size={23} aria-label="Completed" />
            ) : countdown.isOverdue ? (
              <span className="overdue-tag">OVERDUE</span>
            ) : (
              <span>{countdown.label}</span>
            )}
          </div>
        )}
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
          {!log.completed && (
            <button
              type="button"
              className="log-overflow-item"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                runUiAction(() =>
                  planMyDay(log.id, log.myDay === today ? null : today),
                );
              }}
            >
              <Sunrise size={14} />
              <span>
                {log.myDay === today ? "Remove from My Day" : "Add to My Day"}
              </span>
            </button>
          )}
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
