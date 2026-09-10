import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { Log } from '../../types';
import { LogCard } from '../logs/LogCard';
import { todayLocalKey } from '../../utils/calendar';
import './CalendarDayPanel.css';

interface CalendarDayPanelProps {
  dateKey: string;
  activeLogs: Log[];
  completedLogs: Log[];
  currentTimestamp: number;
  onComplete: (id: string) => void;
  onEdit: (log: Log) => void;
  onDelete: (id: string) => void;
  onCreateLog: () => void;
}

export const CalendarDayPanel: React.FC<CalendarDayPanelProps> = ({
  dateKey,
  activeLogs,
  completedLogs,
  currentTimestamp,
  onComplete,
  onEdit,
  onDelete,
  onCreateLog,
}) => {
  const isToday = dateKey === todayLocalKey();

  // Format dateKey (YYYY-MM-DD) cleanly in local time
  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const totalLogs = activeLogs.length + completedLogs.length;

  return (
    <div className="calendar-day-panel">
      <div className="calendar-day-panel-header">
        <div className="calendar-day-panel-title-wrap">
          <h2 className="calendar-day-panel-title">
            {isToday ? `Today — ${formattedDate}` : formattedDate}
          </h2>
          <p className="calendar-day-panel-subtitle">
            {totalLogs === 0
              ? 'No tasks scheduled'
              : `${activeLogs.length} active, ${completedLogs.length} completed`}
          </p>
        </div>
        <button
          type="button"
          className="calendar-day-panel-add-btn"
          onClick={onCreateLog}
          aria-label={`Add log for ${formattedDate}`}
        >
          + ADD LOG
        </button>
      </div>

      {totalLogs === 0 ? (
        <div className="calendar-day-empty">
          <div className="calendar-day-empty-icon">
            <CalendarIcon size={32} strokeWidth={1.2} />
          </div>
          <p className="calendar-day-empty-heading">NO LOGS SCHEDULED</p>
          <p className="calendar-day-empty-sub">
            There are no tasks with deadlines on this day.
          </p>
          <button
            type="button"
            className="calendar-day-empty-btn"
            onClick={onCreateLog}
          >
            + Add Log
          </button>
        </div>
      ) : (
        <div className="calendar-day-content">
          {activeLogs.length > 0 && (
            <section className="calendar-day-section">
              <h3 className="calendar-day-section-heading">ACTIVE ({activeLogs.length})</h3>
              <div className="calendar-day-log-list">
                {activeLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    currentTimestamp={currentTimestamp}
                    onComplete={(id: string) => onComplete(id)}
                    onEdit={onEdit}
                    onDelete={(id: string) => onDelete(id)}
                  />
                ))}
              </div>
            </section>
          )}

          {completedLogs.length > 0 && (
            <section className="calendar-day-section">
              <h3 className="calendar-day-section-heading">COMPLETED ({completedLogs.length})</h3>
              <div className="calendar-day-log-list">
                {completedLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    currentTimestamp={currentTimestamp}
                    onComplete={(id: string) => onComplete(id)}
                    onEdit={onEdit}
                    onDelete={(id: string) => onDelete(id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
