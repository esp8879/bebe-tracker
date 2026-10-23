import { describe, it, expect } from 'vitest';
import { summarize } from './summary';
import { fromNYLocal, dayOf } from './time';
import type { Entry } from '../types';
import { mlToOz, gramsToLbOz, lbOzToGrams, pctChange, fmtPct, fmtLbOz } from './units';

let n = 0;
type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewEntry = DistOmit<Entry, 'id' | 'day' | 'created_at' | 'updated_at' | 'logged_by'>;
function mk(partial: NewEntry): Entry {
  const at = partial.at;
  return { id: `e${n++}`, day: dayOf(at), created_at: at, updated_at: at, logged_by: 'dad', ...partial } as Entry;
}

describe('summarize', () => {
  it('buckets a 23:50 feed and a 00:10 feed into separate days', () => {
    const entries: Entry[] = [
      mk({ type: 'feed', at: fromNYLocal(2026, 9, 12, 23, 50), kind: 'bottle_formula', volume_ml: 45 }),
      mk({ type: 'feed', at: fromNYLocal(2026, 9, 13, 0, 10), kind: 'breast', side: 'left', duration_min: 15 }),
      mk({ type: 'diaper', at: fromNYLocal(2026, 9, 12, 10, 0), wet: true, dirty: true, stool_color: 'green' }),
      mk({ type: 'diaper', at: fromNYLocal(2026, 9, 12, 16, 0), wet: true, dirty: true, stool_color: 'yellow' }),
      mk({ type: 'diaper', at: fromNYLocal(2026, 9, 12, 18, 0), wet: true, dirty: false }),
      mk({ type: 'pump', at: fromNYLocal(2026, 9, 12, 12, 0), volume_ml: 30 }),
    ];
    const days = summarize(entries);
    expect(days.map((d) => d.day)).toEqual(['2026-09-13', '2026-09-12']);
    const d12 = days[1];
    expect(d12.feeds).toBe(1);
    expect(d12.bottles).toBe(1);
    expect(d12.formula_ml).toBe(45);
    expect(d12.diapers).toBe(3);
    expect(d12.wet).toBe(3);
    expect(d12.dirty).toBe(2);
    expect(d12.last_stool).toBe('yellow');
    expect(d12.pumped_ml).toBe(30);
    const d13 = days[0];
    expect(d13.feeds).toBe(1);
    expect(d13.bottles).toBe(0);
    expect(d13.breast).toBe(1);
    expect(d13.breast_min).toBe(15);
  });
  it('ignores soft-deleted entries', () => {
    const at = fromNYLocal(2026, 9, 12, 8, 0);
    const entries: Entry[] = [
      mk({ type: 'feed', at, kind: 'bottle_formula', volume_ml: 60, deleted_at: at + 1 }),
      mk({ type: 'feed', at, kind: 'bottle_mixed', volume_ml: 20 }),
    ];
    const [d] = summarize(entries);
    expect(d.feeds).toBe(1);
    expect(d.formula_ml).toBe(20);
  });
});

describe('units', () => {
  it('converts mL to oz', () => {
    expect(mlToOz(30).toFixed(1)).toBe('1.0');
    expect(mlToOz(90).toFixed(1)).toBe('3.0');
  });
  it('weight: grams to lb/oz and back, percent vs birth', () => {
    expect(gramsToLbOz(3289)).toEqual({ lb: 7, oz: 4 });
    expect(lbOzToGrams(7, 4)).toBe(3289);
    expect(fmtLbOz(2865)).toBe('6 lb 5.1 oz');
    expect(pctChange(2960, 3289)).toBe(-10);
    expect(fmtPct(-10)).toBe('−10.0%');
    expect(fmtPct(1.25)).toBe('+1.3%');
  });
});
