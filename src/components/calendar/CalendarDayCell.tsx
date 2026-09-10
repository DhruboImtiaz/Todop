import React from 'react';
import type { Log } from '../../types';
import type { CalendarDay } from '../../utils/calendar';
import './CalendarDayCell.css';

interface CalendarDayCellProps {
  day: CalendarDay;
  logs: Log[];
  isSelected: boolean;
  onSelect: (dateKey: string) => void;
}

export const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  day,
  logs,
  isSelected,
  onSelect,
}) => {
  const hasActiveLogs = logs.some((log) => !log.completed);

  const cellClasses = [
    'calendar-day-cell',
    day.isCurrentMonth ? 'current-month' : 'other-month',
    day.isToday ? 'today' : '',
    isSelected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const activeCount = logs.filter((l) => !l.completed).length;
  const completedCount = logs.filter((l) => l.completed).length;
  const ariaLabel = `${day.dateKey}${day.isToday ? ' (Today)' : ''}${
    logs.length > 0
      ? `, ${activeCount} active, ${completedCount} completed tasks`
      : ', no tasks'
  }`;

  return (
    <button
      type="button"
      className={cellClasses}
      onClick={() => onSelect(day.dateKey)}
      aria-label={ariaLabel}
      aria-selected={isSelected}
      role="gridcell"
    >
      <div className="calendar-day-number-wrap">
        <span className="calendar-day-number">{day.dayNumber}</span>
      </div>

      <div className="calendar-dots-container" aria-hidden="true">
        {hasActiveLogs && <span className="calendar-dot" />}
      </div>
    </button>
  );
};
