import { describe, it, expect } from 'vitest';
import { dayOf, fromNYLocal, parseNYLocal, toDatetimeLocal, addDays, ageAt, ageDaysOnDay, fmtHM, fmtDur, fmtWhen, fmtRelative, setTimezone, getTimezone } from './time';

describe('New York day bucketing', () => {
  it('buckets 23:50 and 00:10 into different days', () => {
    const a = fromNYLocal(2026, 9, 12, 23, 50);
    const b = fromNYLocal(2026, 9, 13, 0, 10);
    expect(dayOf(a)).toBe('2026-09-12');
    expect(dayOf(b)).toBe('2026-09-13');
    expect(b - a).toBe(20 * 60_000);
  });
  it('uses New York midnight, not UTC midnight', () => {
    // 2026-09-13T02:00Z is still 2026-09-12 22:00 in New York (EDT, UTC-4)
    expect(dayOf(Date.UTC(2026, 8, 13, 2, 0))).toBe('2026-09-12');
  });
  it('round-trips datetime-local strings', () => {
    const ms = fromNYLocal(2026, 9, 12, 3, 5);
    expect(toDatetimeLocal(ms)).toBe('2026-09-12T03:05');
    expect(parseNYLocal('2026-09-12T03:05')).toBe(ms);
  });
  it('handles the fall-back DST transition (Nov 1 2026)', () => {
    const before = fromNYLocal(2026, 11, 1, 0, 30);
    const after = fromNYLocal(2026, 11, 1, 3, 30);
    expect(dayOf(before)).toBe('2026-11-01');
    expect(dayOf(after)).toBe('2026-11-01');
    // 25-hour day: 3 wall-clock hours later is 4 real hours later
    expect(after - before).toBe(4 * 3_600_000);
  });
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
});

describe('age', () => {
  it('computes days and hours', () => {
    const dob = fromNYLocal(2026, 1, 15, 14, 0);
    expect(ageAt(dob, fromNYLocal(2026, 1, 18, 20, 30))).toEqual({ days: 3, hours: 6 });
  });
  it('day-of-life is calendar based', () => {
    const dob = fromNYLocal(2026, 1, 15, 23, 0);
    expect(ageDaysOnDay(dob, '2026-01-15')).toBe(0);
    expect(ageDaysOnDay(dob, '2026-01-16')).toBe(1);
  });
});

describe('fmtHM', () => {
  it('formats and clamps', () => {
    expect(fmtHM(95 * 60_000)).toBe('1:35');
    expect(fmtHM(-5 * 60_000)).toBe('0:00');
  });
});

describe('fmtDur and fmtWhen', () => {
  it('formats durations in h and m', () => {
    expect(fmtDur(107 * 60_000)).toBe('1h 47m');
    expect(fmtDur(47 * 60_000)).toBe('47m');
    expect(fmtDur(3 * 3_600_000 + 5 * 60_000)).toBe('3h 5m');
    expect(fmtDur(2 * 3_600_000)).toBe('2h');
  });
  it('names appointment days relative to now', () => {
    const now = fromNYLocal(2026, 9, 15, 9, 0);
    expect(fmtWhen(fromNYLocal(2026, 9, 15, 14, 0), now)).toBe('Today 2:00 PM');
    expect(fmtWhen(fromNYLocal(2026, 9, 16, 10, 30), now)).toBe('Tomorrow 10:30 AM');
    expect(fmtWhen(fromNYLocal(2026, 9, 17, 10, 30), now)).toBe('Thu 10:30 AM');
    expect(fmtWhen(fromNYLocal(2026, 9, 24, 10, 30), now)).toBe('Sep 24, 10:30 AM');
  });
});

describe('fmtRelative', () => {
  it('handles past and future days without a stray sign', () => {
    const now = fromNYLocal(2026, 9, 19, 20, 0);
    expect(fmtRelative(fromNYLocal(2026, 9, 18, 14, 0), now)).toBe('1 day ago');
    expect(fmtRelative(fromNYLocal(2026, 9, 15, 10, 30), now)).toBe('4 days ago');
    expect(fmtRelative(fromNYLocal(2026, 9, 21, 10, 30), now)).toBe('in 2 days');
    expect(fmtRelative(now + 95 * 60_000, now)).toBe('in 1h 35m');
  });
});

describe('household timezone', () => {
  it('buckets days in the selected zone and restores', () => {
    const ms = Date.UTC(2026, 8, 13, 2, 0); // 22:00 Sep 12 in New York, 20:00 Sep 12 in Denver, 03:00 Sep 13 in London
    expect(dayOf(ms)).toBe('2026-09-12');
    setTimezone('Europe/London');
    expect(getTimezone()).toBe('Europe/London');
    expect(dayOf(ms)).toBe('2026-09-13');
    setTimezone('America/Denver');
    expect(dayOf(ms)).toBe('2026-09-12');
    setTimezone('Not/AZone');
    expect(getTimezone()).toBe('America/Denver');
    setTimezone('America/New_York');
  });
});
