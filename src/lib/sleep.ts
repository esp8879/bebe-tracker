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

const prevKey = (key: string, n = 1) => { const [y, m, d] = key.split('-').map(Number); return dayOf(fromLocal(y, m, d - n, 12, 0)); };

/** The most recent night that has finished: last night in the morning and afternoon, the night before once tonight's window opens. */
export function lastCompletedNight(now: number, window = DEFAULT_NIGHT_SLEEP): string {
  const k0 = nightKey(now);
  return isNightAt(now, window) || localParts(now).hh >= 12 ? prevKey(k0) : k0;
}

/** The night in progress (inside the night window), if any. */
export const currentNight = (now: number, window = DEFAULT_NIGHT_SLEEP): string | null => (isNightAt(now, window) ? nightKey(now) : null);

/** `n` night keys ending at `last`, newest first. */
export const nightsBack = (last: string, n: number): string[] => Array.from({ length: n }, (_, i) => prevKey(last, i));

/** Feeds after bedtime that started inside the night window: the night feeds. */
export function nightFeeds(entries: Entry[], key: string, now: number, window = DEFAULT_NIGHT_SLEEP): number[] {
  const bed = nightStats(entries, key, now).bedtime;
  if (bed === null) return [];
  return entries.filter((e) => e.type === 'feed' && isActive(e) && e.at > bed && nightKey(e.at) === key && isNightAt(e.at, window)).map((e) => e.at);
}

/** Average clock time of a set of instants, treating times after midnight as late evening (bedtimes wrap). Returns minutes after noon. */
export function avgEveningMinutes(times: number[]): number | null {
  if (!times.length) return null;
  const mins = times.map((t) => { const { hh, mm } = localParts(t); return ((hh * 60 + mm) - 720 + 1440) % 1440; });
  return mins.reduce((a, b) => a + b, 0) / mins.length;
}

/** "7:24 PM" from minutes after noon. */
export function fmtEveningMinutes(m: number): string {
  const t = (Math.round(m) + 720) % 1440;
  const hh = Math.floor(t / 60), mm = t % 60;
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

export interface WeekSummary { nights: number; firstStretchMs: number | null; bedtimeMin: number | null; nightFeeds: number | null }

/** Averages over the given nights, counting only nights that have a logged bedtime. */
export function weekSummary(entries: Entry[], keys: string[], now: number, window = DEFAULT_NIGHT_SLEEP): WeekSummary {
  const stats = keys.map((k) => nightStats(entries, k, now)).filter((s) => s.bedtime !== null);
  if (!stats.length) return { nights: 0, firstStretchMs: null, bedtimeMin: null, nightFeeds: null };
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    nights: stats.length,
    firstStretchMs: avg(stats.map((s) => s.firstStretchMs)),
    bedtimeMin: avgEveningMinutes(stats.map((s) => s.bedtime!)),
    nightFeeds: avg(stats.map((s) => nightFeeds(entries, s.key, now, window).length)),
  };
}

/** Nights (within the last `days`) that have at least one night sleep logged. */
export function loggedNights(entries: Entry[], now: number, days = 14): number {
  const keys = new Set(sleepsOf(entries).filter((s) => s.night && s.at > now - days * 86_400_000).map((s) => nightKey(s.at)));
  return keys.size;
}
