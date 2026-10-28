import type { Entry, Sleep } from '../types';
import { isActive } from './summary';
import { dayOf, fromLocal, localParts } from './time';
import { isNightAt } from './timers';

const H = 3_600_000;
export const DEFAULT_NIGHT_SLEEP = { start: '19:00', end: '07:00' };

/** Active sleeps, oldest first. */
export const sleepsOf = (entries: Entry[]): Sleep[] =>
  (entries.filter((e) => e.type === 'sleep' && isActive(e)) as Sleep[]).sort((a, b) => a.at - b.at);

/** The sleep still running (no end time), if any. */
export function openSleep(entries: Entry[]): Sleep | null {
  const open = sleepsOf(entries).filter((s) => s.end_at == null);
  return open.length ? open[open.length - 1] : null;
}

/** When she last woke up, or null. */
export function lastWake(entries: Entry[]): number | null {
  let t: number | null = null;
  for (const s of sleepsOf(entries)) if (s.end_at != null && (t === null || s.end_at > t)) t = s.end_at;
  return t;
}

/** Whether a sleep starting at `ms` counts as night sleep under the household's window. */
export const isNightSleepAt = (ms: number, window = DEFAULT_NIGHT_SLEEP) => isNightAt(ms, window);

/** The night a sleep belongs to, named by the day of its evening: 2 AM on the 27th belongs to the night of the 26th. */
export function nightKey(ms: number): string {
  return localParts(ms).hh < 12 ? dayOf(ms - 12 * H) : dayOf(ms);
}

function dayBounds(day: string): [number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [fromLocal(y, m, d, 0, 0), fromLocal(y, m, d + 1, 0, 0)];
}

export const sleepMs = (s: Sleep, now: number) => Math.max(0, (s.end_at ?? now) - s.at);

/** Total sleep that fell within a calendar day, splitting sleeps that cross midnight. A running sleep counts up to now. */
export function sleepMsOnDay(entries: Entry[], day: string, now: number): number {
  const [d0, d1] = dayBounds(day);
  let total = 0;
  for (const s of sleepsOf(entries)) {
    const a = Math.max(s.at, d0), b = Math.min(s.end_at ?? now, d1);
    if (b > a) total += b - a;
  }
  return total;
}

/** Naps that started on this calendar day. */
export const napsOnDay = (entries: Entry[], day: string) => sleepsOf(entries).filter((s) => !s.night && dayOf(s.at) === day).length;

export interface NightStats {
  key: string;
  /** When the first night sleep started. */
  bedtime: number | null;
  /** Length of that first night sleep: the "first stretch". */
  firstStretchMs: number;
  longestMs: number;
  totalMs: number;
  count: number;
}

/** Stats for one night (see nightKey). Running sleeps count up to now. */
export function nightStats(entries: Entry[], key: string, now: number): NightStats {
  const list = sleepsOf(entries).filter((s) => s.night && nightKey(s.at) === key);
  const lens = list.map((s) => sleepMs(s, now));
  return {
    key,
    bedtime: list.length ? list[0].at : null,
    firstStretchMs: lens[0] ?? 0,
    longestMs: lens.length ? Math.max(...lens) : 0,
    totalMs: lens.reduce((a, b) => a + b, 0),
    count: list.length,
  };
}

/** The night of the most recent night sleep, or null. */
export function latestNightKey(entries: Entry[]): string | null {
  const nights = sleepsOf(entries).filter((s) => s.night);
  return nights.length ? nightKey(nights[nights.length - 1].at) : null;
}

/** True if a night sleep starting at `at` would be the first of its night (bedtime). */
export function isBedtime(entries: Entry[], at: number, ignoreId?: string): boolean {
  const key = nightKey(at);
  return !sleepsOf(entries).some((s) => s.id !== ignoreId && s.night && nightKey(s.at) === key && s.at < at);
}

/**
 * The night Today's "longest" tile should show: tonight while the night window is on and she has slept tonight,
 * otherwise the most recent night that has ended.
 */
export function nightForToday(entries: Entry[], now: number, window = DEFAULT_NIGHT_SLEEP): { key: string; tonight: boolean } {
  const key0 = nightKey(now);
  const has = (k: string) => sleepsOf(entries).some((s) => s.night && nightKey(s.at) === k);
  if (has(key0)) return { key: key0, tonight: isNightAt(now, window) };
  const [y, m, d] = key0.split('-').map(Number);
  return { key: dayOf(fromLocal(y, m, d - 1, 12, 0)), tonight: false };
}
