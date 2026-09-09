import React from 'react';
import { CalendarClock, Plus } from 'lucide-react';
import './EmptyState.css';

interface EmptyStateProps {
  onCreateLog: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onCreateLog }) => {
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon-wrap" aria-hidden="true">
        <CalendarClock size={30} strokeWidth={1.8} />
      </div>

      <h2 className="empty-state-title">NO LOGS YET</h2>

      <p className="empty-state-desc">
        Create your first log to start planning your work.
      </p>

      <button
        type="button"
        className="empty-state-btn"
        onClick={onCreateLog}
        aria-label="Create First Log"
      >
        <Plus size={18} strokeWidth={2.5} />
        <span>Create First Log</span>
      </button>
    </div>
  );
};
