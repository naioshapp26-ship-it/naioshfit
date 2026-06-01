import { format } from 'date-fns';

// Lightweight UTC+3 helpers without additional deps (Riyadh time)
// We treat app time as UTC+3 by shifting dates by +3 hours for formatting and by -3 hours for parsing where needed.

const OFFSET_MIN = 3 * 60; // +180 minutes

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export function formatInAppTz(date: Date, pattern: string): string {
  // Shift to UTC+3 for display
  const shifted = addMinutes(date, OFFSET_MIN);
  return format(shifted, pattern);
}

// Same as formatInAppTz but allows passing date-fns options (e.g., locale)
export function formatInAppTzWithOptions(date: Date, pattern: string, options?: Parameters<typeof format>[2]): string {
  const shifted = addMinutes(date, OFFSET_MIN);
  // date-fns v3 format signature: format(date, formatStr, options?)
  // options may include { locale }
  // We guard-cast to any to avoid tight coupling on date-fns types across versions
  return (format as any)(shifted, pattern, options);
}

export function dateStringForToday(): string {
  return formatInAppTz(new Date(), 'yyyy-MM-dd');
}

export function parseDateStringInAppTz(dateStr: string): Date {
  // Interpret yyyy-MM-dd as midnight in UTC+3, then shift back to UTC for storage/comparison
  const base = new Date(`${dateStr}T00:00:00Z`);
  return addMinutes(base, -OFFSET_MIN);
}

export function nowInAppTz(): Date {
  return addMinutes(new Date(), OFFSET_MIN);
}
