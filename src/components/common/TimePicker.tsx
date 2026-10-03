import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import './TimePicker.css';

interface TimePickerProps {
  value: string; // HH:mm format (24-hour)
  onChange: (time: string) => void;
  disabled?: boolean;
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  
  // Parse incoming value
  const parseTime = (val: string) => {
    if (!val) return { h12: 12, m: 0, period: 'AM' };
    const [h, m] = val.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return { h12, m, period };
  };

  const { h12, m, period } = parseTime(value);

  const [tempHour, setTempHour] = useState(h12);
  const [tempMinute, setTempMinute] = useState(m);
  const [tempPeriod, setTempPeriod] = useState(period);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ opacity: 0, pointerEvents: 'none' });

  useEffect(() => {
    if (isOpen) {
      const current = parseTime(value);
      setTempHour(current.h12);
      setTempMinute(current.m);
      setTempPeriod(current.period);
      setMode('hour');
    }
  }, [isOpen, value]);

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

  const handleSave = () => {
    let h24 = tempHour === 12 ? 0 : tempHour;
    if (tempPeriod === 'PM') h24 += 12;
    
    const hh = h24.toString().padStart(2, '0');
    const mm = tempMinute.toString().padStart(2, '0');
    
    onChange(`${hh}:${mm}`);
    setIsOpen(false);
  };

  // Clock face numbers
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const renderClockFace = () => {
    const items = mode === 'hour' ? hours : minutes;
    const activeValue = mode === 'hour' ? tempHour : tempMinute;

    return (
      <div className="clock-face">
        {items.map((num, i) => {
          const angle = (i * 30) * (Math.PI / 180);
          const radius = 90; // center is at 110, radius is 90
          const cx = 110 + radius * Math.sin(angle);
          const cy = 110 - radius * Math.cos(angle);
          const isActive = num === activeValue;
          
          return (
            <div
              key={`${mode}-${num}`}
              className={`clock-number ${isActive ? 'active' : ''}`}
              style={{ left: `${cx}px`, top: `${cy}px` }}
              onClick={() => {
                if (mode === 'hour') {
                  setTempHour(num);
                  setMode('minute'); // auto switch to minutes
                } else {
                  setTempMinute(num);
                }
              }}
            >
              {mode === 'minute' ? num.toString().padStart(2, '0') : num}
            </div>
          );
        })}
        {/* Hand */}
        <div className="clock-hand" style={{ 
          transform: `rotate(${mode === 'hour' ? (tempHour % 12) * 30 : (tempMinute / 5) * 30}deg)` 
        }}>
          <div className="clock-hand-circle"></div>
        </div>
      </div>
    );
  };

  const displayTime = value ? (() => {
    const { h12, m, period } = parseTime(value);
    return `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
  })() : '';

  return (
    <div className="time-picker-container" ref={containerRef}>
      <button 
        ref={triggerRef}
        type="button"
        className="time-picker-trigger form-input"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span>{displayTime || 'Select time'}</span>
        <Clock size={16} className="time-picker-icon" />
      </button>

      {isOpen && createPortal(
        <>
          {window.innerWidth < 480 && <div className="time-picker-mobile-backdrop" onClick={() => setIsOpen(false)} />}
          <div className="time-picker-popover" ref={popoverRef} style={popoverStyle}>
            <div className="time-picker-header">
              <div className="time-picker-header-time">
                <span 
                  className={`time-part ${mode === 'hour' ? 'active' : ''}`}
                  onClick={() => setMode('hour')}
                >
                  {tempHour.toString().padStart(2, '0')}
                </span>
                <span className="time-separator">:</span>
                <span 
                  className={`time-part ${mode === 'minute' ? 'active' : ''}`}
                  onClick={() => setMode('minute')}
                >
                  {tempMinute.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="time-picker-header-period">
                <button 
                  type="button"
                  className={`period-btn ${tempPeriod === 'AM' ? 'active' : ''}`}
                  onClick={() => setTempPeriod('AM')}
                >
                  AM
                </button>
                <button 
                  type="button"
                  className={`period-btn ${tempPeriod === 'PM' ? 'active' : ''}`}
                  onClick={() => setTempPeriod('PM')}
                >
                  PM
                </button>
              </div>
            </div>
            
            <div className="time-picker-body">
              {renderClockFace()}
            </div>
            
            <div className="time-picker-footer">
              <button type="button" className="footer-btn cancel" onClick={() => setIsOpen(false)}>
                Cancel
              </button>
              <button type="button" className="footer-btn ok" onClick={handleSave}>
                OK
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};
