import type { Log } from '../types';

export interface CalendarDay {
  date: Date;
  dateKey: string; // 'YYYY-MM-DD'
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Returns a local date key 'YYYY-MM-DD' for a given ISO string or Date using local timezone.
 */
export function getLocalDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) {
    return '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's local date key 'YYYY-MM-DD'.
 */
export function todayLocalKey(): string {
  return getLocalDateKey(new Date());
}

/**
 * Returns the previous month { year, month } (0-indexed month: 0-11).
 */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 0) {
    return { year: year - 1, month: 11 };
  }
  return { year, month: month - 1 };
}

/**
 * Returns the next month { year, month } (0-indexed month: 0-11).
 */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 11) {
    return { year: year + 1, month: 0 };
  }
  return { year, month: month + 1 };
}

/**
 * Builds a 42-cell (6 rows x 7 columns) grid of calendar days starting on Monday.
 * month is 0-indexed (0 = Jan, 11 = Dec).
 */
export function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const todayKey = todayLocalKey();
  
  // 1st of current month
  const firstOfMonth = new Date(year, month, 1);
  // getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Monday-first offset: Mon -> 0, Tue -> 1, ..., Sun -> 6
  const rawFirstDow = firstOfMonth.getDay();
  const leadingDaysCount = (rawFirstDow + 6) % 7;

  // Days in current month: day 0 of month+1 gives last day of current month
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  // Days in previous month:
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);

  const grid: CalendarDay[] = [];

  // 1. Leading days from previous month
  for (let i = leadingDaysCount - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const d = new Date(prev.year, prev.month, dayNum);
    const dateKey = getLocalDateKey(d);
    grid.push({
      date: d,
      dateKey,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
    });
  }

  // 2. Days of current month
  for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
    const d = new Date(year, month, dayNum);
    const dateKey = getLocalDateKey(d);
    grid.push({
      date: d,
      dateKey,
      dayNumber: dayNum,
      isCurrentMonth: true,
      isToday: dateKey === todayKey,
    });
  }

  // 3. Trailing days from next month to fill 42 cells
  const remainingCells = 42 - grid.length;
  for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
    const d = new Date(next.year, next.month, dayNum);
    const dateKey = getLocalDateKey(d);
    grid.push({
      date: d,
      dateKey,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateKey === todayKey,
    });
  }

  return grid;
}

/**
 * Groups logs by local date key 'YYYY-MM-DD'.
 * Defensively skips logs with invalid or missing deadlines.
 */
export function groupLogsByLocalDate(logs: Log[]): Map<string, Log[]> {
  const map = new Map<string, Log[]>();
  for (const log of logs) {
    if (!log.deadline) continue;
    const dateKey = getLocalDateKey(log.deadline);
    if (!dateKey) continue;
    const list = map.get(dateKey);
    if (list) {
      list.push(log);
    } else {
      map.set(dateKey, [log]);
    }
  }
  return map;
}
