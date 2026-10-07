const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Parse an ISO 8601 timestamp. Timestamps without a zone are treated as UTC (the backend emits naive UTC). */
export function parseIsoUtc(iso?: string | null): Date | null {
  if (!iso) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = new Date(hasZone || isDateOnly ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format an ISO 8601 flight timestamp as UTC time and date, e.g. { time: '15:30', date: '15 Sep' }. */
export function formatFlightTime(iso?: string | null): { time: string; date: string } | null {
  const d = parseIsoUtc(iso);
  if (!d) return null;
  return {
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
  };
}

/** Format a timestamp as '5 Oct 2026, 15:55 UTC'. */
export function formatDateTimeUtc(iso?: string | null): string | null {
  const d = parseIsoUtc(iso);
  if (!d) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** Format a YYYY-MM-DD travel date as '15 Sep 2026'. Returns null for anything else. */
export function formatTravelDate(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = parseIsoUtc(value);
  if (!d) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Format a signed minute count, e.g. 90 -> '1h 30m', -40 -> '-40m'. */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return `${sign}${h}h${m ? ` ${m}m` : ''}`;
}

/**
 * Format a timestamp in an airport's local time, e.g. { time: '01:50', date: '20 Oct', zone: 'GMT+5:30' }.
 * Falls back to UTC when the timezone is missing or unknown.
 */
export function formatLocalTime(iso?: string | null, timeZone?: string | null): { time: string; date: string; zone: string } | null {
  const d = parseIsoUtc(iso);
  if (!d) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      day: 'numeric', month: 'short', timeZoneName: 'short',
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return { time: `${get('hour')}:${get('minute')}`, date: `${get('day')} ${get('month')}`, zone: timeZone ? get('timeZoneName') : 'UTC' };
  } catch {
    const utc = formatFlightTime(iso);
    return utc ? { ...utc, zone: 'UTC' } : null;
  }
}
