import { useLogFormSubmit } from '../../hooks/useLogFormSubmit';
import React, { useState } from 'react';
import type { Log } from '../../types';
import { useStorage } from '../../hooks/useStorage';
import { useRealtimeTicker } from '../../hooks/useRealtimeTicker';
import {
  buildMonthGrid,
  prevMonth,
  nextMonth,
  todayLocalKey,
  groupLogsByLocalDate,
} from '../../utils/calendar';
import { CalendarGrid } from './CalendarGrid';
import { CalendarDayPanel } from './CalendarDayPanel';
import { LogFormSheet } from '../logs/LogFormSheet';
import './CalendarPage.css';

export const CalendarPage: React.FC = () => {
  const {
    activeLogs,
    completedLogs,
    toggleLogCompletion,
    deleteLog,
  } = useStorage();

  const currentTimestamp = useRealtimeTicker(5000);

  // Initial local calendar date state
  const now = new Date();
  const [viewYear, setViewYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(now.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayLocalKey());

  // Sheet state
  const [editingLog, setEditingLog] = useState<Log | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Group all logs by local date
  const allLogs = [...activeLogs, ...completedLogs];
  const logsByDate = groupLogsByLocalDate(allLogs);
  const gridDays = buildMonthGrid(viewYear, viewMonth);

  // Derive selected date logs
  const selectedDateLogs = logsByDate.get(selectedDateKey) || [];
  const selectedActiveLogs = selectedDateLogs.filter((l) => !l.completed);
  const selectedCompletedLogs = selectedDateLogs.filter((l) => l.completed);

  // Navigation handlers
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
    const currentNow = new Date();
    const currentYear = currentNow.getFullYear();
    const currentMonth = currentNow.getMonth();
    const currentTodayKey = todayLocalKey();
    setViewYear(currentYear);
    setViewMonth(currentMonth);
    setSelectedDateKey(currentTodayKey);
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    // Parse target date and automatically navigate month view if clicked day is outside current month view
    const [y, m] = dateKey.split('-').map(Number);
    const targetMonth = m - 1;
    if (y !== viewYear || targetMonth !== viewMonth) {
      setViewYear(y);
      setViewMonth(targetMonth);
    }
  };

  // Log CRUD & Sheet handlers
  const handleOpenCreate = () => {
    setEditingLog(null);
    setIsSheetOpen(true);
  };

  const handleOpenEdit = (log: Log) => {
    setEditingLog(log);
    setIsSheetOpen(true);
  };

  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setEditingLog(null);
  };

  const handleFormSubmit = useLogFormSubmit(editingLog, handleCloseSheet);

  const handleComplete = async (id: string) => {
    await toggleLogCompletion(id);
  };

  const handleDelete = async (id: string) => {
    await deleteLog(id);
  };

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div className="page-header-main">
          <h1 className="page-title">CALENDAR</h1>
          <p className="page-subtitle">View tasks by deadline.</p>
        </div>
      </div>

      <CalendarGrid
        year={viewYear}
        month={viewMonth}
        gridDays={gridDays}
        logsByDate={logsByDate}
        selectedDateKey={selectedDateKey}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
        onSelectDate={handleSelectDate}
      />

      <CalendarDayPanel
        dateKey={selectedDateKey}
        activeLogs={selectedActiveLogs}
        completedLogs={selectedCompletedLogs}
        currentTimestamp={currentTimestamp}
        onComplete={handleComplete}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        onCreateLog={handleOpenCreate}
      />

      <LogFormSheet
        isOpen={isSheetOpen}
        initialLog={editingLog}
        defaultDate={selectedDateKey}
        onClose={handleCloseSheet}
        onSubmit={handleFormSubmit}
        onComplete={async (id) => {
          await handleComplete(id);
          handleCloseSheet();
        }}
        onDelete={async (id) => {
          await handleDelete(id);
          handleCloseSheet();
        }}
      />
    </div>
  );
};
