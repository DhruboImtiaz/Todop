import { useState } from 'react';
import { Clock } from 'lucide-react';
import { PickerPopover } from './PickerPopover';
import './TimePicker.css';

interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
}
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const pad = (value: number) => String(value).padStart(2, '0');
function parseTime(value: string) {
  const [hour = 0, minute = 0] = value ? value.split(':').map(Number) : [];
  return { hour: hour % 12 || 12, minute, period: hour >= 12 ? 'PM' : 'AM' };
}

export function TimePicker({ id, value, onChange, disabled }: TimePickerProps) {
  const [draft, setDraft] = useState(() => parseTime(value));
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const current = parseTime(value);
  const display = value ? `${pad(current.hour)}:${pad(current.minute)} ${current.period}` : '';
  const items = mode === 'hour' ? HOURS : MINUTES;
  const active = mode === 'hour' ? draft.hour : draft.minute;

  return (
    <PickerPopover id={id} kind="time" value={display} disabled={disabled} icon={<Clock size={16} />}
      onOpen={() => { setDraft(parseTime(value)); setMode('hour'); }}
      onConfirm={() => onChange(`${pad(draft.hour % 12 + (draft.period === 'PM' ? 12 : 0))}:${pad(draft.minute)}`)}>
      <div className="time-picker-header">
        <div className="time-picker-header-time">
          <button type="button" className={`time-part ${mode === 'hour' ? 'active' : ''}`}
            aria-label="Choose hour" aria-pressed={mode === 'hour'} onClick={() => setMode('hour')}>
            {pad(draft.hour)}
          </button>
          <span className="time-separator">:</span>
          <button type="button" className={`time-part ${mode === 'minute' ? 'active' : ''}`}
            aria-label="Choose minute" aria-pressed={mode === 'minute'} onClick={() => setMode('minute')}>
            {pad(draft.minute)}
          </button>
        </div>
        <div className="time-picker-header-period">
          {['AM', 'PM'].map(period => (
            <button key={period} type="button" className={`period-btn ${draft.period === period ? 'active' : ''}`}
              aria-pressed={draft.period === period} onClick={() => setDraft({ ...draft, period })}>{period}</button>
          ))}
        </div>
      </div>
      <div className="time-picker-body">
        <div className="clock-face" role="group" aria-label={mode === 'hour' ? 'Hours' : 'Minutes'}>
          {items.map((number, index) => {
            const angle = index * Math.PI / 6;
            return (
              <button key={`${mode}-${number}`} type="button" aria-pressed={number === active}
                aria-label={`${number} ${mode === 'hour' ? 'hours' : 'minutes'}`}
                className={`clock-number ${number === active ? 'active' : ''}`}
                style={{ left: `${110 + 90 * Math.sin(angle)}px`, top: `${110 - 90 * Math.cos(angle)}px` }}
                onClick={() => {
                  setDraft({ ...draft, [mode]: number });
                  if (mode === 'hour') setMode('minute');
                }}>
                {mode === 'minute' ? pad(number) : number}
              </button>
            );
          })}
          <div className="clock-hand" aria-hidden="true"
            style={{ transform: `rotate(${mode === 'hour' ? draft.hour % 12 * 30 : draft.minute * 6}deg)` }}>
            <div className="clock-hand-circle" />
          </div>
        </div>
      </div>
    </PickerPopover>
  );
}
