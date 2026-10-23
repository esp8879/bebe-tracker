import type { Entry, StoolColor } from '../types';

export interface DaySummary {
  day: string;
  feeds: number;
  /** Bottle feeds (formula, breast milk, mixed): feeds minus breastfeeds. */
  bottles: number;
  breast: number;
  breast_min: number;
  formula_ml: number;
  breastmilk_bottle_ml: number;
  bottle_ml: number;
  pumped_ml: number;
  pumps: number;
  /** Physical diapers changed: one per diaper entry, even if both wet and dirty. */
  diapers: number;
  wet: number;
  dirty: number;
  last_stool?: StoolColor;
  entries: Entry[];
}

export const isActive = (e: Entry) => !e.deleted_at;
export const activeEntries = (entries: Entry[]) => entries.filter(isActive);

export function emptyDay(day: string): DaySummary {
  return {
    day, feeds: 0, bottles: 0, breast: 0, breast_min: 0, formula_ml: 0, breastmilk_bottle_ml: 0, bottle_ml: 0,
    pumped_ml: 0, pumps: 0, diapers: 0, wet: 0, dirty: 0, entries: [],
  };
}

/** Group active entries by New York day and aggregate. Returned newest day first, entries newest first. */
export function summarize(entries: Entry[]): DaySummary[] {
  const byDay = new Map<string, DaySummary>();
  const sorted = [...activeEntries(entries)].sort((a, b) => a.at - b.at);
  for (const e of sorted) {
    let s = byDay.get(e.day);
    if (!s) { s = emptyDay(e.day); byDay.set(e.day, s); }
    s.entries.push(e);
    switch (e.type) {
      case 'feed':
        s.feeds++;
        if (e.kind === 'breast') { s.breast++; s.breast_min += e.duration_min ?? 0; }
        else {
          s.bottles++;
          const v = e.volume_ml ?? 0;
          s.bottle_ml += v;
          if (e.kind === 'bottle_breastmilk') s.breastmilk_bottle_ml += v;
          else s.formula_ml += v; // formula and mixed both count toward formula mL
        }
        break;
      case 'diaper':
        s.diapers++;
        if (e.wet) s.wet++;
        if (e.dirty) { s.dirty++; if (e.stool_color) s.last_stool = e.stool_color; }
        break;
      case 'pump':
        s.pumps++;
        s.pumped_ml += e.volume_ml ?? ((e.left_ml ?? 0) + (e.right_ml ?? 0));
        break;
      case 'mom_med':
        break;
    }
  }
  for (const s of byDay.values()) s.entries.reverse();
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export function summaryForDay(entries: Entry[], day: string): DaySummary {
  return summarize(entries.filter((e) => e.day === day))[0] ?? emptyDay(day);
}
