import { CalendarClock } from 'lucide-react';
import './EmptyState.css';

export function EmptyState() {
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon-wrap" aria-hidden="true">
        <CalendarClock size={30} strokeWidth={1.8} />
      </div>

      <h2 className="empty-state-title">NO LOGS YET</h2>

      <p className="empty-state-desc">
        Create your first log to start planning your work.
      </p>
    </div>
  );
}
