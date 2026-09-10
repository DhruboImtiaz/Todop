import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Log } from '../../types';
import type { CalendarDay } from '../../utils/calendar';
import { CalendarDayCell } from './CalendarDayCell';
import './CalendarGrid.css';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_LABELS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

interface CalendarGridProps {
  year: number;
  month: number;
  gridDays: CalendarDay[];
  logsByDate: Map<string, Log[]>;
  selectedDateKey: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectDate: (dateKey: string) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  year,
  month,
  gridDays,
  logsByDate,
  selectedDateKey,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
}) => {
  const monthTitle = `${MONTH_NAMES[month]} ${year}`;

  return (
    <div className="calendar-grid-container" aria-label="Monthly Calendar">
      <div className="calendar-header">
        <h2 className="calendar-month-title">{monthTitle}</h2>
        <div className="calendar-header-actions">
          <button
            type="button"
            className="calendar-today-btn"
            onClick={onToday}
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={onPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={onNextMonth}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-days-grid" role="grid" aria-label={`Days of ${monthTitle}`}>
        {gridDays.map((day) => {
          const dayLogs = logsByDate.get(day.dateKey) || [];
          return (
            <CalendarDayCell
              key={day.dateKey}
              day={day}
              logs={dayLogs}
              isSelected={day.dateKey === selectedDateKey}
              onSelect={onSelectDate}
            />
          );
        })}
      </div>
    </div>
  );
};
