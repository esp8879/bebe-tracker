import { describe, it, expect } from 'vitest';
import type { Entry, Sleep } from '../types';
import { fromNYLocal, setTimezone } from './time';
import { openSleep, lastWake, nightKey, sleepMsOnDay, napsOnDay, nightStats, latestNightKey, isBedtime, isNightSleepAt, nightForToday, lastCompletedNight, currentNight, nightsBack, nightFeeds, avgEveningMinutes, fmtEveningMinutes, weekSummary, loggedNights, placeNow, placeTrail, defaultPlace, placeSegments } from './sleep';

setTimezone('America/New_York');
const H = 3_600_000, M = 60_000;
const at = (d: number, hh: number, mm = 0) => fromNYLocal(2026, 10, d, hh, mm);
let n = 0;
const sleep = (start: number, end: number | null, night: boolean, extra: Partial<Sleep> = {}): Entry =>
  ({ id: `s${n++}`, type: 'sleep', at: start, end_at: end, night, day: 'x', created_at: start, updated_at: start, logged_by: 'mom', ...extra }) as Sleep;

describe('sleep', () => {
  it('classifies night by the 7 PM to 7 AM window', () => {
    expect(isNightSleepAt(at(20, 18, 59))).toBe(false);
    expect(isNightSleepAt(at(20, 19, 0))).toBe(true);
    expect(isNightSleepAt(at(21, 6, 59))).toBe(true);
    expect(isNightSleepAt(at(21, 7, 0))).toBe(false);
  });
  it('names a night by its evening', () => {
    expect(nightKey(at(20, 19, 30))).toBe('2026-10-20');
    expect(nightKey(at(21, 2, 0))).toBe('2026-10-20');
    expect(nightKey(at(21, 13, 0))).toBe('2026-10-21');
  });
  it('splits sleep across midnight and counts a running sleep to now', () => {
    const list = [sleep(at(20, 22), at(21, 2), true), sleep(at(21, 9), at(21, 10, 30), false), sleep(at(21, 23), null, true)];
    expect(sleepMsOnDay(list, '2026-10-20', at(21, 23, 30))).toBe(2 * H);
    expect(sleepMsOnDay(list, '2026-10-21', at(21, 23, 30))).toBe(2 * H + 90 * M + 30 * M);
    expect(napsOnDay(list, '2026-10-21')).toBe(1);
    expect(openSleep(list)!.at).toBe(at(21, 23));
    expect(lastWake(list)).toBe(at(21, 10, 30));
  });
  it('finds bedtime, first stretch and longest stretch for a night', () => {
    const list = [
      sleep(at(20, 19, 10), at(20, 22, 5), true),
      sleep(at(20, 22, 40), at(21, 3, 0), true),
      sleep(at(21, 3, 30), at(21, 6, 15), true),
      sleep(at(21, 10), at(21, 11), false),
      sleep(at(20, 20), at(20, 21), true, { deleted_at: 1 }),
    ];
    const s = nightStats(list, '2026-10-20', at(21, 12));
    expect(s.bedtime).toBe(at(20, 19, 10));
    expect(s.firstStretchMs).toBe(2 * H + 55 * M);
    expect(s.longestMs).toBe(4 * H + 20 * M);
    expect(s.count).toBe(3);
    expect(latestNightKey(list)).toBe('2026-10-20');
    expect(isBedtime(list, at(20, 19, 0))).toBe(true);
    expect(isBedtime(list, at(20, 23, 0))).toBe(false);
  });
});

describe('nightForToday', () => {
  const list = [sleep(at(20, 19, 10), at(20, 22, 0), true), sleep(at(20, 23, 0), at(21, 4, 0), true), sleep(at(21, 19, 30), null, true)];
  it('shows last night in the morning and afternoon', () => {
    expect(nightForToday(list.slice(0, 2), at(21, 9))).toEqual({ key: '2026-10-20', tonight: false });
    expect(nightForToday(list.slice(0, 2), at(21, 15))).toEqual({ key: '2026-10-20', tonight: false });
  });
  it('switches to tonight once she has slept tonight', () => {
    expect(nightForToday(list.slice(0, 2), at(21, 20))).toEqual({ key: '2026-10-20', tonight: false });
    expect(nightForToday(list, at(21, 20))).toEqual({ key: '2026-10-21', tonight: true });
  });
});

describe('weekly sleep', () => {
  const feedAt = (t: number): Entry => ({ id: `f${t}`, type: 'feed', kind: 'bottle_formula', volume_ml: 90, at: t, day: 'x', created_at: t, updated_at: t, logged_by: 'mom' }) as Entry;
  it('knows which night has finished', () => {
    expect(lastCompletedNight(at(21, 9))).toBe('2026-10-20');
    expect(lastCompletedNight(at(21, 15))).toBe('2026-10-20');
    expect(lastCompletedNight(at(21, 21))).toBe('2026-10-20');
    expect(lastCompletedNight(at(22, 2))).toBe('2026-10-20');
    expect(currentNight(at(21, 21))).toBe('2026-10-21');
    expect(currentNight(at(21, 15))).toBeNull();
    expect(nightsBack('2026-10-20', 3)).toEqual(['2026-10-20', '2026-10-19', '2026-10-18']);
  });
  it('averages bedtime across midnight and counts night feeds after bedtime', () => {
    expect(fmtEveningMinutes(avgEveningMinutes([at(20, 23, 30), at(21, 0, 30)])!)).toBe('12:00 AM');
    const list = [
      sleep(at(20, 19, 0), at(20, 22, 0), true), feedAt(at(20, 18, 40)), feedAt(at(20, 22, 5)), feedAt(at(21, 2, 0)), feedAt(at(21, 7, 30)),
      sleep(at(19, 20, 0), at(19, 23, 0), true), feedAt(at(19, 23, 5)),
    ];
    expect(nightFeeds(list, '2026-10-20', at(21, 12)).length).toBe(2);
    const w = weekSummary(list, ['2026-10-20', '2026-10-19', '2026-10-18'], at(21, 12));
    expect(w.nights).toBe(2);
    expect(w.firstStretchMs).toBe(3 * H);
    expect(fmtEveningMinutes(w.bedtimeMin!)).toBe('7:30 PM');
    expect(w.nightFeeds).toBe(1.5);
    expect(loggedNights(list, at(21, 12))).toBe(2);
  });
});

describe('sleep places', () => {
  it('tracks moves, the default, and segments', () => {
    const moved = sleep(at(20, 13, 0), at(20, 15, 0), false, { places: [{ at: at(20, 13, 0), place: 'bassinet' }, { at: at(20, 14, 0), place: 'contact' }] });
    const plain = sleep(at(20, 20, 0), at(20, 23, 0), true);
    const night = sleep(at(21, 20, 0), at(21, 23, 0), true, { places: [{ at: at(21, 20, 0), place: 'bassinet' }] });
    expect(placeTrail(moved as Sleep)).toBe('bassinet → contact');
    expect(placeNow(moved as Sleep)).toBe('contact');
    expect(placeTrail(plain as Sleep)).toBe('');
    expect(defaultPlace([moved, plain, night], false)).toBe('bassinet');
    expect(defaultPlace([moved, plain, night], true)).toBe('bassinet');
    expect(defaultPlace([plain], true)).toBeNull();
    expect(placeSegments(moved as Sleep, at(21, 0))).toEqual([[at(20, 13, 0), at(20, 14, 0), 'bassinet'], [at(20, 14, 0), at(20, 15, 0), 'contact']]);
    expect(placeSegments(plain as Sleep, at(21, 0))).toEqual([[at(20, 20, 0), at(20, 23, 0), null]]);
  });
});
