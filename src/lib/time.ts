/** All display and day-bucketing is done in the household's timezone (settable; defaults to New York). */
let TZ = 'America/New_York';
export const getTimezone = () => TZ;
export const deviceTimezone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } };
export function setTimezone(tz: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); TZ = tz; } catch { /* invalid tz: keep current */ }
}

interface Fmts { parts: Intl.DateTimeFormat; time: Intl.DateTimeFormat; day: Intl.DateTimeFormat; shortDay: Intl.DateTimeFormat; dateTime: Intl.DateTimeFormat; weekdayTime: Intl.DateTimeFormat; monthDayTime: Intl.DateTimeFormat }
const cache = new Map<string, Fmts>();
function F(): Fmts {
  let f = cache.get(TZ);
  if (!f) {
    f = {
      parts: new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
      time: new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }),
      day: new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }),
      shortDay: new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'numeric', day: 'numeric' }),
      dateTime: new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      weekdayTime: new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' }),
      monthDayTime: new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    };
    cache.set(TZ, f);
  }
  return f;
}

export interface LocalParts { y: number; m: number; d: number; hh: number; mm: number; ss: number }
/** @deprecated name kept for older imports; parts in the household timezone. */
export function nyParts(ms: number): LocalParts { return localParts(ms); }
export function localParts(ms: number): LocalParts {
  const p: Record<string, string> = {};
  for (const part of F().parts.formatToParts(new Date(ms))) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour % 24, mm: +p.minute, ss: +p.second };
}
const pad = (n: number) => String(n).padStart(2, '0');

/** Calendar day in the household timezone as YYYY-MM-DD. */
export function dayOf(ms: number): string { const { y, m, d } = localParts(ms); return `${y}-${pad(m)}-${pad(d)}`; }

/** Offset (ms) of the household timezone from UTC at the given instant. */
export function nyOffsetMs(ms: number): number {
  const p = localParts(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(ms / 1000) * 1000;
}
/** Convert a wall-clock time in the household timezone to an epoch ms instant. Handles DST transitions. */
export function fromNYLocal(y: number, m: number, d: number, hh = 0, mm = 0): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = nyOffsetMs(guess);
  let ms = guess - off1;
  const off2 = nyOffsetMs(ms);
  if (off2 !== off1) ms = guess - off2;
  return ms;
}
export const fromLocal = fromNYLocal;
/** Parse 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' as household wall time. */
export function parseNYLocal(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s);
  if (!m) return NaN;
  return fromNYLocal(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}
export const parseLocal = parseNYLocal;
/** Format for <input type="datetime-local"> in household wall time. */
export function toDatetimeLocal(ms: number): string { const p = localParts(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`; }
export const dayStartMs = (day: string) => parseNYLocal(day);
export function addDays(day: string, n: number): string { return dayOf(dayStartMs(day) + n * 86_400_000 + 12 * 3_600_000); }

export const fmtTime = (ms: number) => F().time.format(new Date(ms));
export const fmtDay = (day: string) => F().day.format(new Date(dayStartMs(day) + 12 * 3_600_000));
export const fmtShortDay = (day: string) => F().shortDay.format(new Date(dayStartMs(day) + 12 * 3_600_000));
export const fmtDateTime = (ms: number) => F().dateTime.format(new Date(ms));

export function fmtDayRelative(day: string, today: string): string {
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return fmtDay(day);
}
/** "H:MM" for a non-negative duration in ms. */
export function fmtHM(ms: number): string { const total = Math.max(0, Math.round(ms / 60_000)); return `${Math.floor(total / 60)}:${pad(total % 60)}`; }
/** "2h 15m", "47m", "2h" — for countdowns and elapsed time. */
export function fmtDur(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min}m`;
  return min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h ${min % 60}m`;
}
export const fmtAgo = fmtDur;
export function ageAt(dobMs: number, nowMs: number): { days: number; hours: number } {
  const diff = Math.max(0, nowMs - dobMs);
  const days = Math.floor(diff / 86_400_000);
  return { days, hours: Math.floor((diff - days * 86_400_000) / 3_600_000) };
}
/** Age in whole days for a given calendar day (day 0 = day of birth). */
export function ageDaysOnDay(dobMs: number, day: string): number { return Math.round((dayStartMs(day) - dayStartMs(dayOf(dobMs))) / 86_400_000); }
/** "in 2h 15m", "in 3 days", "now", "2h ago" — for appointments. */
export function fmtRelative(ms: number, now: number): string {
  const diff = ms - now, abs = Math.abs(diff), min = Math.round(abs / 60_000);
  if (min < 1) return 'now';
  let s: string;
  if (min < 24 * 60) s = fmtDur(abs);
  else { const days = Math.abs(Math.round((dayStartMs(dayOf(ms)) - dayStartMs(dayOf(now))) / 86_400_000)); s = `${days} day${days === 1 ? '' : 's'}`; }
  return diff > 0 ? `in ${s}` : `${s} ago`;
}
/** "Today 2:00 PM" · "Tomorrow 10:30 AM" · "Thu 10:30 AM" (within 6 days) · "Sep 24, 10:30 AM" */
export function fmtWhen(ms: number, now: number): string {
  const day = dayOf(ms), today = dayOf(now);
  if (day === today) return `Today ${fmtTime(ms)}`;
  if (day === addDays(today, 1)) return `Tomorrow ${fmtTime(ms)}`;
  const diffDays = Math.round((dayStartMs(day) - dayStartMs(today)) / 86_400_000);
  // Built from parts, not the engine's pattern: Safari says "Nov 9 at 9:15 AM", Chrome "Nov 9, 9:15 AM".
  const part = (fmt: Intl.DateTimeFormat, type: string) => fmt.formatToParts(new Date(ms)).find((p) => p.type === type)?.value ?? '';
  if (diffDays > 1 && diffDays <= 6) return `${part(F().weekdayTime, 'weekday')} ${fmtTime(ms)}`;
  return `${part(F().monthDayTime, 'month')} ${part(F().monthDayTime, 'day')}, ${fmtTime(ms)}`;
}
