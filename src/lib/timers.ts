import type { Entry, Med } from '../types';
import { isActive } from './summary';

export type FeedStatus = 'ok' | 'due' | 'late';

export interface FeedTimer { lastAt: number; dueAt: number; remainingMs: number; status: FeedStatus }

export function lastFeedAt(entries: Entry[]): number | null {
  let last: number | null = null;
  for (const e of entries) if (e.type === 'feed' && isActive(e) && (last === null || e.at > last)) last = e.at;
  return last;
}

/** Amber at 0, red at +30 min. */
export function nextFeedDue(entries: Entry[], intervalMin: number, now: number): FeedTimer | null {
  const lastAt = lastFeedAt(entries);
  if (lastAt === null) return null;
  const dueAt = lastAt + intervalMin * 60_000;
  const remainingMs = dueAt - now;
  const status: FeedStatus = remainingMs > 0 ? 'ok' : remainingMs > -30 * 60_000 ? 'due' : 'late';
  return { lastAt, dueAt, remainingMs, status };
}

export interface MedTimer { med: Med; lastAt: number | null; okAt: number | null; remainingMs: number; ok: boolean }

/** Only meaningful when an interval is configured. Returns ok=true immediately if never dosed. */
export function medTimer(entries: Entry[], med: Med, intervalMin: number, now: number): MedTimer {
  let lastAt: number | null = null;
  for (const e of entries) if (e.type === 'mom_med' && e.med === med && isActive(e) && (lastAt === null || e.at > lastAt)) lastAt = e.at;
  if (lastAt === null) return { med, lastAt: null, okAt: null, remainingMs: 0, ok: true };
  const okAt = lastAt + intervalMin * 60_000;
  const remainingMs = okAt - now;
  return { med, lastAt, okAt, remainingMs, ok: remainingMs <= 0 };
}

export const ROTATION_MEDS: [Med, Med] = ['tylenol', 'motrin'];

export interface RotationNext { med: Med; okAt: number | null; remainingMs: number; ok: boolean; last: Partial<Record<Med, number>> }

/**
 * Staggered Tylenol/Motrin: whichever of the pair can be taken soonest, respecting each
 * med's own interval and the stagger gap since the last dose of either. Ties go to the
 * one not taken most recently, so the pair alternates.
 */
export function rotationNext(entries: Entry[], intervals: Partial<Record<Med, number>>, staggerMin: number, now: number): RotationNext {
  const last: Partial<Record<Med, number>> = {};
  let lastAny: { med: Med; at: number } | null = null;
  for (const e of entries) {
    if (e.type !== 'mom_med' || !isActive(e) || !ROTATION_MEDS.includes(e.med)) continue;
    if ((last[e.med] ?? -Infinity) < e.at) last[e.med] = e.at;
    if (!lastAny || e.at > lastAny.at) lastAny = { med: e.med, at: e.at };
  }
  let best: { med: Med; okAt: number } | null = null;
  for (const med of ROTATION_MEDS) {
    const own = last[med] != null && intervals[med] ? last[med]! + intervals[med]! * 60_000 : -Infinity;
    const gap = lastAny ? lastAny.at + staggerMin * 60_000 : -Infinity;
    const okAt = Math.max(own, gap);
    const alternate = lastAny ? med !== lastAny.med : med === ROTATION_MEDS[0];
    if (!best || okAt < best.okAt || (okAt === best.okAt && alternate)) best = { med, okAt };
  }
  const okAt = best!.okAt === -Infinity ? null : best!.okAt;
  const remainingMs = okAt === null ? 0 : okAt - now;
  return { med: best!.med, okAt, remainingMs, ok: remainingMs <= 0, last };
}

export interface PumpTimer { lastAt: number; okAt: number | null; remainingMs: number; ok: boolean }

/** Last pump plus, when an interval is set, when the next one lands. Null if never pumped. */
export function pumpTimer(entries: Entry[], intervalMin: number | undefined, now: number): PumpTimer | null {
  let lastAt: number | null = null;
  for (const e of entries) if (e.type === 'pump' && isActive(e) && (lastAt === null || e.at > lastAt)) lastAt = e.at;
  if (lastAt === null) return null;
  if (!intervalMin || intervalMin <= 0) return { lastAt, okAt: null, remainingMs: 0, ok: false };
  const okAt = lastAt + intervalMin * 60_000;
  const remainingMs = okAt - now;
  return { lastAt, okAt, remainingMs, ok: remainingMs <= 0 };
}

export interface LastDose { med: Med; lastAt: number; dose?: string }

/** Most recent dose of every med taken in the last `days` days, in `order` (unknown meds last, then by recency). */
export function recentDoses(entries: Entry[], now: number, days = 7, order: Med[] = []): LastDose[] {
  const since = now - days * 86_400_000;
  const last = new Map<Med, LastDose>();
  for (const e of entries) {
    if (e.type !== 'mom_med' || !isActive(e) || e.at < since || e.at > now + 60_000) continue;
    if ((last.get(e.med)?.lastAt ?? -Infinity) < e.at) last.set(e.med, { med: e.med, lastAt: e.at, ...(e.dose_text ? { dose: e.dose_text } : {}) });
  }
  const rank = (m: Med) => { const i = order.indexOf(m); return i === -1 ? order.length : i; };
  return [...last.values()].sort((a, b) => rank(a.med) - rank(b.med) || b.lastAt - a.lastAt);
}
