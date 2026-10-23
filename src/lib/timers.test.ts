import { describe, it, expect } from 'vitest';
import { nextFeedDue, medTimer, rotationNext, pumpTimer, recentDoses } from './timers';
import type { Entry } from '../types';

const feed = (at: number, deleted = false): Entry =>
  ({ id: String(at), type: 'feed', kind: 'breast', at, day: 'x', created_at: at, updated_at: at, logged_by: 'mom', deleted_at: deleted ? at : null });
const dose = (at: number, med: 'tylenol' | 'motrin' = 'tylenol'): Entry =>
  ({ id: String(at), type: 'mom_med', med, at, day: 'x', created_at: at, updated_at: at, logged_by: 'mom' });
const H = 3_600_000, M = 60_000;

describe('nextFeedDue', () => {
  it('returns null with no feeds', () => expect(nextFeedDue([], 180, 0)).toBeNull());
  it('counts from the latest non-deleted feed', () => {
    const t = nextFeedDue([feed(0), feed(2 * H, true), feed(1 * H)], 180, 2 * H);
    expect(t?.lastAt).toBe(1 * H);
    expect(t?.remainingMs).toBe(2 * H);
    expect(t?.status).toBe('ok');
  });
  it('is amber at 0 and red after 30 min', () => {
    expect(nextFeedDue([feed(0)], 180, 3 * H)!.status).toBe('due');
    expect(nextFeedDue([feed(0)], 180, 3 * H + 29 * M)!.status).toBe('due');
    expect(nextFeedDue([feed(0)], 180, 3 * H + 31 * M)!.status).toBe('late');
  });
});

describe('medTimer', () => {
  it('is ok when never dosed', () => expect(medTimer([], 'tylenol', 360, 0).ok).toBe(true));
  it('counts down per med independently', () => {
    const e = [dose(0, 'tylenol'), dose(2 * H, 'motrin')];
    const t = medTimer(e, 'tylenol', 360, 4 * H);
    expect(t.ok).toBe(false);
    expect(t.remainingMs).toBe(2 * H);
    expect(medTimer(e, 'motrin', 360, 4 * H).remainingMs).toBe(4 * H);
    expect(medTimer(e, 'tylenol', 360, 7 * H).ok).toBe(true);
  });
});

describe('rotationNext (staggered Tylenol/Motrin)', () => {
  const iv = { tylenol: 360, motrin: 360 };
  it('starts with Tylenol when nothing is logged', () => {
    const r = rotationNext([], iv, 180, 0);
    expect(r.med).toBe('tylenol');
    expect(r.ok).toBe(true);
    expect(r.okAt).toBeNull();
  });
  it('after Tylenol, Motrin is next once the stagger gap passes', () => {
    const r = rotationNext([dose(0, 'tylenol')], iv, 180, 1 * H);
    expect(r.med).toBe('motrin');
    expect(r.remainingMs).toBe(2 * H);
    expect(rotationNext([dose(0, 'tylenol')], iv, 180, 3 * H).ok).toBe(true);
  });
  it('alternates and respects each med\'s own interval', () => {
    const e = [dose(0, 'tylenol'), dose(3 * H, 'motrin')];
    const r = rotationNext(e, iv, 180, 4 * H);
    expect(r.med).toBe('tylenol');
    expect(r.okAt).toBe(6 * H); // max(tylenol 0+6h, motrin 3h+3h)
  });
  it('picks the other med if the alternate is blocked by its own interval', () => {
    // Motrin taken twice in a row; Tylenol never. Tylenol is only bound by the stagger gap.
    const e = [dose(0, 'motrin'), dose(3 * H, 'motrin')];
    const r = rotationNext(e, iv, 180, 4 * H);
    expect(r.med).toBe('tylenol');
    expect(r.okAt).toBe(6 * H);
  });
  it('ignores the stagger for other meds and deleted doses', () => {
    const del: Entry = { ...dose(2 * H, 'motrin'), deleted_at: 1 };
    const r = rotationNext([dose(0, 'tylenol'), del], iv, 180, 3 * H);
    expect(r.med).toBe('motrin');
    expect(r.ok).toBe(true);
  });
});

describe('pumpTimer', () => {
  const pump = (at: number, deleted = false): Entry =>
    ({ id: `p${at}`, type: 'pump', at, day: 'x', created_at: at, updated_at: at, logged_by: 'mom', deleted_at: deleted ? at : null });
  it('is null with no pumps', () => expect(pumpTimer([], 180, 0)).toBeNull());
  it('shows only the last pump when no interval is set', () => {
    expect(pumpTimer([pump(0), pump(2 * H)], undefined, 3 * H)).toEqual({ lastAt: 2 * H, okAt: null, remainingMs: 0, ok: false });
  });
  it('counts down from the last active pump', () => {
    const t = pumpTimer([pump(0), pump(2 * H), pump(3 * H, true)], 180, 3 * H)!;
    expect(t.lastAt).toBe(2 * H); expect(t.okAt).toBe(5 * H); expect(t.remainingMs).toBe(2 * H); expect(t.ok).toBe(false);
    expect(pumpTimer([pump(0)], 60, 2 * H)!.ok).toBe(true);
  });
});

describe('recentDoses', () => {
  const D = 24 * H;
  it('keeps the latest dose per med within the window, in the given order', () => {
    const now = 10 * D;
    const r = recentDoses([dose(now - 8 * D, 'motrin'), dose(now - 2 * D, 'motrin'), dose(now - 1 * D, 'tylenol'), dose(now - 3 * H, 'motrin')], now, 7, ['tylenol', 'motrin']);
    expect(r).toEqual([{ med: 'tylenol', lastAt: now - 1 * D }, { med: 'motrin', lastAt: now - 3 * H }]);
  });
  it('drops meds whose last dose is older than the window and ignores deleted doses', () => {
    const now = 10 * D;
    const old: Entry = { ...dose(now - 8 * D, 'tylenol') };
    const del: Entry = { ...dose(now - 1 * H, 'motrin'), deleted_at: now };
    expect(recentDoses([old, del], now, 7)).toEqual([]);
  });
});
