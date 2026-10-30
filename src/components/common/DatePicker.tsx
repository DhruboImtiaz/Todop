import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { buildMonthGrid, todayLocalKey, prevMonth, nextMonth } from '../../utils/calendar';
import { PickerPopover } from './PickerPopover';
import './DatePicker.css';

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function DatePicker({ id, value, onChange, disabled }: DatePickerProps) {
  const todayKey = todayLocalKey();
  const [tempDate, setTempDate] = useState(value);
  const [view, setView] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const showDate = (dateKey: string) => {
    const date = parseDate(dateKey);
    setTempDate(dateKey);
    setView({ year: date.getFullYear(), month: date.getMonth() });
  };
  const displayDate = value ? (() => {
    const [year, month, day] = value.split('-');
    return `${month}/${day}/${year}`;
  })() : '';

  return (
    <PickerPopover id={id} kind="date" value={displayDate} disabled={disabled}
      icon={<Calendar size={16} />} canConfirm={Boolean(tempDate)}
      onOpen={() => {
        const date = parseDate(value || todayKey);
        setTempDate(value);
        setView({ year: date.getFullYear(), month: date.getMonth() });
      }}
      onConfirm={() => onChange(tempDate)}
      footerStart={<button type="button" className="picker-footer-btn" onClick={() => showDate(todayKey)}>TODAY</button>}>
      <div className="date-picker-header">
        <button type="button" className="nav-btn" onClick={() => setView(prevMonth(view.year, view.month))} aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <span className="month-year-label">{MONTHS[view.month]} {view.year}</span>
        <button type="button" className="nav-btn" onClick={() => setView(nextMonth(view.year, view.month))} aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="date-picker-body">
        <div className="date-picker-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day, index) => <span key={index}>{day}</span>)}
        </div>
        <div className="date-picker-grid" role="group" aria-label="Days">
          {buildMonthGrid(view.year, view.month).map(day => {
            const selected = tempDate === day.dateKey;
            const today = todayKey === day.dateKey;
            return (
              <button key={day.dateKey} type="button" aria-pressed={selected}
                aria-label={`${MONTHS[day.date.getMonth()]} ${day.dayNumber}, ${day.date.getFullYear()}`}
                className={`date-picker-day ${day.isCurrentMonth ? '' : 'muted'} ${selected ? 'selected' : ''} ${today ? 'today' : ''}`}
                onClick={() => showDate(day.dateKey)}>
                {day.dayNumber}
                {today && !selected && <span className="today-dot" />}
              </button>
            );
          })}
        </div>
      </div>
    </PickerPopover>
  );
}
