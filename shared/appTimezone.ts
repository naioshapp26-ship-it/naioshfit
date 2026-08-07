/** Fixed app timezone: Asia/Riyadh (UTC+3, no DST). */
export const APP_TZ_OFFSET_MIN = 3 * 60;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

/** Interpret datetime-local (YYYY-MM-DDTHH:mm) as wall clock in UTC+3 → UTC ISO. */
export function datetimeLocalToUtcIso(datetimeLocal: string): string {
  const [datePart, timePart] = datetimeLocal.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes) - APP_TZ_OFFSET_MIN * 60000;
  return new Date(utcMs).toISOString();
}

/** Render a stored UTC instant for datetime-local input in UTC+3. */
export function utcIsoToDatetimeLocal(iso: string | Date): string {
  const shifted = addMinutes(new Date(iso), APP_TZ_OFFSET_MIN);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const hours = String(shifted.getUTCHours()).padStart(2, '0');
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** yyyy-MM-dd calendar day start in UTC+3, as UTC instant. */
export function startOfAppDay(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - APP_TZ_OFFSET_MIN * 60000);
}

/** yyyy-MM-dd calendar day end in UTC+3, as UTC instant. */
export function endOfAppDay(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - APP_TZ_OFFSET_MIN * 60000);
}

export function dateStringForTodayInAppTz(now: Date = new Date()): string {
  const shifted = addMinutes(now, APP_TZ_OFFSET_MIN);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateStringInAppTz(dateStr: string): Date {
  return startOfAppDay(dateStr);
}

/** Normalize meal date values from API/forms to UTC ISO without double-shifting. */
export function normalizeMealDateForStorage(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return new Date().toISOString();
  }

  // datetime-local from browser (no timezone suffix)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return datetimeLocalToUtcIso(trimmed);
  }

  // yyyy-MM-dd only → keep current wall-clock time in app TZ on that day
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const nowLocal = utcIsoToDatetimeLocal(new Date().toISOString());
    const timePart = nowLocal.split('T')[1] || '12:00';
    return datetimeLocalToUtcIso(`${trimmed}T${timePart}`);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

/** Format UTC instant as HH:mm in app TZ (for simple displays). */
export function formatTimeInAppTz(iso: string | Date): string {
  const shifted = addMinutes(new Date(iso), APP_TZ_OFFSET_MIN);
  const hours = shifted.getUTCHours();
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${minutes} ${ampm}`;
}

/** Map a UTC instant to yyyy-MM-dd in app TZ. */
export function utcInstantToAppDateString(iso: string | Date): string {
  const shifted = addMinutes(new Date(iso), APP_TZ_OFFSET_MIN);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mealDayRange(dateInput: string | Date): { start: Date; end: Date } {
  const dateStr = typeof dateInput === 'string'
    ? dateInput.slice(0, 10)
    : utcInstantToAppDateString(dateInput);
  return { start: startOfAppDay(dateStr), end: endOfAppDay(dateStr) };
}
