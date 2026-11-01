import type { Log, RecurrenceRule } from "../types";
import { getLocalDateKey } from "./calendar";
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const priorityOrder = { high: 0, normal: 1, low: 2 };
export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && getLocalDateKey(date) === value;
}
export function validRecurrence(value: unknown): value is RecurrenceRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as RecurrenceRule;
  return (
    ["daily", "weekly", "monthly"].includes(rule.frequency) &&
    Number.isInteger(rule.interval) &&
    rule.interval >= 1 &&
    rule.interval <= 365 &&
    (rule.anchorDay === undefined ||
      (Number.isInteger(rule.anchorDay) &&
        rule.anchorDay >= 1 &&
        rule.anchorDay <= 31))
  );
}
export function recurrenceLabel(rule: RecurrenceRule): string {
  if (rule.interval === 1)
    return { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[
      rule.frequency
    ];
  return `Every ${rule.interval} ${{ daily: "days", weekly: "weeks", monthly: "months" }[rule.frequency]}`;
}
/** Keep local wall-clock time, clamp short months, and skip missed occurrences without a backlog. */
export function nextRecurringDeadline(
  deadline: string,
  rule: RecurrenceRule,
  now = new Date(),
): string {
  if (
    !validRecurrence(rule) ||
    !Number.isFinite(Date.parse(deadline)) ||
    !Number.isFinite(now.getTime())
  )
    throw new Error("Invalid repeat schedule");
  const base = new Date(deadline);
  const months =
    (now.getFullYear() - base.getFullYear()) * 12 +
    now.getMonth() -
    base.getMonth();
  const days =
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())) /
    86400000;
  const period = rule.interval * (rule.frequency === "weekly" ? 7 : 1);
  let step = Math.max(
    1,
    Math.floor((rule.frequency === "monthly" ? months : days) / period),
  );
  while (true) {
    const next = new Date(base);
    if (rule.frequency === "monthly") {
      next.setDate(1);
      next.setMonth(base.getMonth() + rule.interval * step);
      const last = new Date(
        next.getFullYear(),
        next.getMonth() + 1,
        0,
      ).getDate();
      next.setDate(Math.min(rule.anchorDay ?? base.getDate(), last));
    } else next.setDate(base.getDate() + period * step);
    if (!Number.isFinite(next.getTime()))
      throw new Error(
        "The next occurrence is outside the supported date range.",
      );
    if (next > now) return next.toISOString();
    step++;
  }
}
export function sortByPriority(logs: Log[]): Log[] {
  return [...logs].sort(
    (a, b) =>
      priorityOrder[a.priority ?? "normal"] -
        priorityOrder[b.priority ?? "normal"] ||
      (a.deadline ? Date.parse(a.deadline) : Infinity) -
        (b.deadline ? Date.parse(b.deadline) : Infinity) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}
