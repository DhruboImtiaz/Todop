import type { Log } from '../types';

export interface SearchResults {
  active: Log[];
  completed: Log[];
  totalMatches: number;
}

/**
 * Pure search utility for TODOP logs.
 *
 * Requirements:
 * - Match ONLY against log.title (case-insensitive, partial match).
 * - Trim leading/trailing whitespace from query.
 * - Empty query returns zero matches.
 * - Active results sorted by nearest deadline ascending.
 * - Completed results sorted by newest updatedAt descending.
 * - Pure function: does not modify input array or log objects.
 */
export function searchLogs(logs: Log[], query: string): SearchResults {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return {
      active: [],
      completed: [],
      totalMatches: 0,
    };
  }

  const matchingLogs = logs.filter((log) =>
    log.title.toLowerCase().includes(trimmed)
  );

  const active = matchingLogs
    .filter((log) => !log.completed)
    .sort(
      (a, b) =>
        new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    );

  const completed = matchingLogs
    .filter((log) => log.completed)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  return {
    active,
    completed,
    totalMatches: active.length + completed.length,
  };
}
