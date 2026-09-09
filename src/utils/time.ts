export interface CountdownInfo {
  label: string;
  isOverdue: boolean;
}

/**
 * Parses date (YYYY-MM-DD) and time (HH:MM) strings in the browser's local timezone
 * and converts them into a standardized ISO 8601 string.
 */
export function localDateTimeToIso(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '23:59').split(':').map(Number);
  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return localDate.toISOString();
}

/**
 * Converts an ISO 8601 string into local YYYY-MM-DD and HH:MM components.
 */
export function isoToLocalDateAndTime(isoStr: string): { date: string; time: string } {
  const d = new Date(isoStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

/**
 * Calculates countdown from current timestamp to the deadline.
 * Rules:
 * - diff <= 0: OVERDUE
 * - More than 24 hours: X D YH ZM
 * - Less than 24 hours: X H YM
 * - Less than 1 hour: X M
 * - No seconds, no negative values.
 */
export function getCountdown(deadlineIso: string, currentTimestamp: number = Date.now()): CountdownInfo {
  const target = new Date(deadlineIso).getTime();
  const diff = target - currentTimestamp;

  if (diff <= 0) {
    return {
      label: 'OVERDUE',
      isOverdue: true,
    };
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutesAfterDays = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const minutes = remainingMinutesAfterDays % 60;

  if (days >= 1) {
    return {
      label: `${days} D ${hours}H ${minutes}M`,
      isOverdue: false,
    };
  }

  if (hours >= 1) {
    return {
      label: `${hours} H ${minutes}M`,
      isOverdue: false,
    };
  }

  const displayMinutes = Math.max(1, minutes);
  return {
    label: `${displayMinutes} M`,
    isOverdue: false,
  };
}

/**
 * Determines whether a deadline belongs to 'overdue', 'today', or 'upcoming'.
 */
export function getLogSection(deadlineIso: string, currentTimestamp: number = Date.now()): 'overdue' | 'today' | 'upcoming' {
  const targetDate = new Date(deadlineIso);
  const targetTime = targetDate.getTime();

  if (targetTime <= currentTimestamp) {
    return 'overdue';
  }

  const nowDate = new Date(currentTimestamp);
  const isSameCalendarDay =
    targetDate.getFullYear() === nowDate.getFullYear() &&
    targetDate.getMonth() === nowDate.getMonth() &&
    targetDate.getDate() === nowDate.getDate();

  if (isSameCalendarDay) {
    return 'today';
  }

  return 'upcoming';
}

/**
 * Returns default date and time values for creating a new log:
 * Defaults to today, 2 hours from now rounded to the next hour.
 */
export function getDefaultNewLogDateTime(): { date: string; time: string } {
  const now = new Date();
  now.setHours(now.getHours() + 2);
  now.setMinutes(0);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = '00';
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}
