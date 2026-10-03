import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { buildMonthGrid, todayLocalKey, prevMonth, nextMonth } from '../../utils/calendar';
import './DatePicker.css';

interface DatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const todayKey = todayLocalKey();

  // Safe parsing using local timezone to avoid UTC shift bugs
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const [tempDate, setTempDate] = useState<string>(value);
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth());

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ opacity: 0, pointerEvents: 'none' });

  useEffect(() => {
    if (isOpen) {
      const d = parseLocalDate(value || todayKey);
      setTempDate(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [isOpen, value, todayKey]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const updatePosition = () => {
    if (!triggerRef.current || !popoverRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();

    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    if (window.innerWidth < 480) {
      setPopoverStyle({
        zIndex: 100000,
        opacity: 1,
        pointerEvents: 'auto',
      });
      return;
    }

    let top = triggerRect.bottom + 8;
    let left = triggerRect.left;

    if (spaceBelow < popoverRect.height + 16 && spaceAbove > spaceBelow) {
      top = triggerRect.top - popoverRect.height - 8;
    }

    if (left + popoverRect.width > window.innerWidth - 16) {
      left = window.innerWidth - popoverRect.width - 16;
    }

    setPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 100000,
      opacity: 1,
      pointerEvents: 'auto',
      transform: 'none',
    });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    } else {
      setPopoverStyle({ opacity: 0, pointerEvents: 'none' });
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const grid = buildMonthGrid(viewYear, viewMonth);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

  const handleDayClick = (dateKey: string, isCurrentMonth: boolean) => {
    setTempDate(dateKey);
    if (!isCurrentMonth) {
      const d = parseLocalDate(dateKey);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const handlePrevMonth = () => {
    const { year, month } = prevMonth(viewYear, viewMonth);
    setViewYear(year);
    setViewMonth(month);
  };

  const handleNextMonth = () => {
    const { year, month } = nextMonth(viewYear, viewMonth);
    setViewYear(year);
    setViewMonth(month);
  };

  const handleToday = () => {
    const today = parseLocalDate(todayKey);
    setTempDate(todayKey);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const handleSave = () => {
    if (tempDate) {
      onChange(tempDate);
    }
    setIsOpen(false);
  };

  const displayDate = value ? (() => {
    const [y, m, d] = value.split('-');
    return `${m}/${d}/${y}`;
  })() : '';

  return (
    <div className="date-picker-container" ref={containerRef}>
      <button 
        ref={triggerRef}
        type="button"
        className="date-picker-trigger form-input"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label="Select date"
      >
        <span>{displayDate || 'Select date'}</span>
        <Calendar size={16} className="date-picker-icon" />
      </button>

      {isOpen && createPortal(
        <>
          {window.innerWidth < 480 && <div className="date-picker-mobile-backdrop" onClick={() => setIsOpen(false)} />}
          <div className="date-picker-popover" ref={popoverRef} style={popoverStyle} role="dialog" aria-label="Calendar">
            <div className="date-picker-header">
              <button type="button" className="nav-btn" onClick={handlePrevMonth} aria-label="Previous month">
                <ChevronLeft size={20} />
              </button>
              <span className="month-year-label">{monthNames[viewMonth]} {viewYear}</span>
              <button type="button" className="nav-btn" onClick={handleNextMonth} aria-label="Next month">
                <ChevronRight size={20} />
              </button>
            </div>
            
            <div className="date-picker-body">
              <div className="date-picker-weekdays" role="row">
                {weekdays.map((d, i) => <span key={i} role="columnheader">{d}</span>)}
              </div>
              <div className="date-picker-grid" role="grid">
                {grid.map(day => {
                  const isSelected = tempDate === day.dateKey;
                  const isToday = todayKey === day.dateKey;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      role="gridcell"
                      aria-selected={isSelected}
                      aria-label={`${monthNames[day.date.getMonth()]} ${day.dayNumber}, ${day.date.getFullYear()}`}
                      className={`date-picker-day 
                        ${day.isCurrentMonth ? '' : 'muted'} 
                        ${isSelected ? 'selected' : ''} 
                        ${isToday ? 'today' : ''}
                      `}
                      onClick={() => handleDayClick(day.dateKey, day.isCurrentMonth)}
                    >
                      {day.dayNumber}
                      {isToday && !isSelected && <div className="today-dot" />}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="date-picker-footer">
              <button type="button" className="footer-btn today-btn" onClick={handleToday}>
                TODAY
              </button>
              <div className="footer-right">
                <button type="button" className="footer-btn cancel" onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="footer-btn ok" onClick={handleSave}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
