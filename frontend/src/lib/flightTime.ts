const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format an ISO 8601 flight timestamp as UTC time and date, e.g. { time: '15:30', date: '15 Sep' }. */
export function formatFlightTime(iso?: string | null): { time: string; date: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
  };
}

/** Format a signed minute count, e.g. 90 -> '1h 30m', -40 -> '-40m'. */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return `${sign}${h}h${m ? ` ${m}m` : ''}`;
}
