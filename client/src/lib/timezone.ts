import { format } from 'date-fns';
import {
  APP_TZ_OFFSET_MIN,
  datetimeLocalToUtcIso,
  utcIsoToDatetimeLocal,
  dateStringForTodayInAppTz,
  parseDateStringInAppTz as parseDateStringInAppTzShared,
  normalizeMealDateForStorage,
  formatTimeInAppTz,
  startOfAppDay,
  endOfAppDay,
} from '@shared/appTimezone';

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/** Format a UTC instant as wall-clock time in the app timezone (UTC+3). */
function formatShiftedWallClock(date: Date, pattern: string, options?: Parameters<typeof format>[2]): string {
  const shifted = addMinutes(date, APP_TZ_OFFSET_MIN);
  // Use local Date constructor with app-TZ wall-clock parts so date-fns does not
  // apply the browser offset a second time (which caused 7:40 → 10:40 in UTC+3).
  const wallClock = new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
    shifted.getUTCMilliseconds(),
  );
  return (format as any)(wallClock, pattern, options);
}

export function formatInAppTz(date: Date, pattern: string): string {
  return formatShiftedWallClock(date, pattern);
}

export function formatInAppTzWithOptions(date: Date, pattern: string, options?: Parameters<typeof format>[2]): string {
  return formatShiftedWallClock(date, pattern, options);
}

export {
  datetimeLocalToUtcIso,
  utcIsoToDatetimeLocal,
  normalizeMealDateForStorage,
  formatTimeInAppTz,
  startOfAppDay,
  endOfAppDay,
};

export function dateStringForToday(): string {
  return dateStringForTodayInAppTz();
}

export function parseDateStringInAppTz(dateStr: string): Date {
  return parseDateStringInAppTzShared(dateStr);
}

export function nowInAppTz(): Date {
  return addMinutes(new Date(), APP_TZ_OFFSET_MIN);
}
