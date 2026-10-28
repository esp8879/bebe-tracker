import { DEFAULT_SETTINGS, type Appointment, type Entry, type Settings, type Weight } from '../types';
import { dayOf, deviceTimezone, fromLocal, setTimezone } from '../lib/time';

/** /demo opens a made-up household held in memory: nothing is read from or written to Firestore. */
export const DEMO_PATH = '/demo';
export const DEMO_HID = 'demo';

const H = 3_600_000, M = 60_000, D = 86_400_000;

/**
 * Two full days plus a live "today", all relative to now in this device's time zone,
 * so the timers and the Summary table look current whenever someone opens the demo.
 */
export function demoData(now = Date.now()): { settings: Settings; entries: Entry[]; weights: Weight[]; appointments: Appointment[] } {
  const tz = deviceTimezone();
  setTimezone(tz);
  const ymd = (ms: number) => dayOf(ms).split('-').map(Number) as [number, number, number];
  const at = (daysBack: number, hh: number, mm: number) => { const [y, m, d] = ymd(now - daysBack * D); return fromLocal(y, m, d, hh, mm); };

  let n = 0;
  const entries: Entry[] = [];
  const push = (e: Record<string, unknown>, when: number, who: 'dad' | 'mom' = 'mom') =>
    entries.push({ id: `demo-${n++}`, at: when, day: dayOf(when), created_at: when, updated_at: when, logged_by: who, deleted_at: null, ...e } as unknown as Entry);
  const feed = (when: number, kind: string, extra: Record<string, unknown>, who: 'dad' | 'mom' = 'mom') => push({ type: 'feed', kind, ...extra }, when, who);
  const diaper = (when: number, wet: boolean, dirty: boolean, color?: string, who: 'dad' | 'mom' = 'dad') => push({ type: 'diaper', wet, dirty, ...(color ? { stool_color: color } : {}) }, when, who);
  const pump = (when: number, volume_ml: number, duration_min = 15) => push({ type: 'pump', volume_ml, duration_min }, when);
  const med = (when: number, m: string, dose_text?: string) => push({ type: 'mom_med', med: m, ...(dose_text ? { dose_text } : {}) }, when);

  // Two full prior days for the Summary table.
  for (const [back, wetN, color] of [[2, 6, 'green'], [1, 7, 'yellow']] as const) {
    const slots = [[0, 30], [3, 15], [6, 0], [8, 45], [11, 30], [14, 15], [17, 0], [20, 30], [23, 0]];
    slots.forEach(([hh, mm], i) => {
      const t = at(back, hh, mm);
      if (i % 2 === 0) feed(t, 'breast', { side: i % 4 === 0 ? 'left' : 'right', duration_min: 15 + (i % 3) * 5, latch_quality: 'good' });
      feed(t + 25 * M, i % 3 === 0 ? 'bottle_breastmilk' : 'bottle_formula', { volume_ml: 60 + (i % 3) * 15 }, i % 2 === 0 ? 'dad' : 'mom');
    });
    for (let i = 0; i < wetN; i++) diaper(at(back, 1 + i * 3, 10 + i * 5), true, i % 2 === 0, i % 2 === 0 ? color : undefined, i % 2 ? 'mom' : 'dad');
    for (const [hh, ml] of [[2, 30], [7, 45], [12, 50], [16, 45], [21, 55]]) pump(at(back, hh, 40), ml);
    for (const [hh, m, dose] of [[1, 'tylenol', '650 mg'], [4, 'motrin', '600 mg'], [7, 'tylenol', '650 mg'], [10, 'motrin', '600 mg'], [13, 'tylenol', '650 mg'], [16, 'motrin', '600 mg']] as const) med(at(back, hh, 0), m, dose);
  }

  // Today, anchored to now so the countdowns are live.
  feed(now - 6 * H - 20 * M, 'bottle_formula', { volume_ml: 75 }, 'dad');
  diaper(now - 6 * H - 10 * M, true, false);
  feed(now - 3 * H - 10 * M, 'breast', { side: 'left', duration_min: 15, latch_quality: 'ok' });
  feed(now - 2 * H - 45 * M, 'bottle_breastmilk', { volume_ml: 60 });
  diaper(now - 2 * H - 40 * M, true, true, 'yellow', 'mom');
  pump(now - 2 * H - 15 * M, 50);
  feed(now - 1 * H - 25 * M, 'bottle_formula', { volume_ml: 90 }, 'dad');
  diaper(now - 1 * H - 20 * M, true, false);
  diaper(now - 20 * M, false, true, 'light_brown');
  med(now - 4 * H, 'tylenol', '650 mg');
  med(now - 1 * H, 'motrin', '600 mg');

  // Sleep: three nights where the first stretch slowly lengthens, plus naps. Nothing in the future.
  const sleeps: [number, number, boolean, string[]?][] = [];
  for (const [back, firstEnd] of [[3, [21, 50]], [2, [22, 5]], [1, [22, 30]]] as const) {
    sleeps.push([at(back, 19, 10), at(back, firstEnd[0], firstEnd[1]), true, back === 1 ? ['feeding', 'rocking'] : ['feeding']]);
    sleeps.push([at(back, 22, 55), at(back - 1, 3, 0), true]);
    sleeps.push([at(back - 1, 3, 35), at(back - 1, 6, 20), true]);
    if (back < 3) for (const [h1, m1, h2, m2] of [[9, 0, 10, 15], [12, 30, 14, 0], [16, 0, 17, 0]]) sleeps.push([at(back, h1, m1), at(back, h2, m2), false]);
  }
  let lastEnd = 0;
  for (const [start, end, night, how] of sleeps.sort((a, b) => a[0] - b[0])) {
    if (end > now - 10 * M) continue;
    push({ type: 'sleep', end_at: end, night, ...(how ? { how } : {}) }, start, night ? 'mom' : 'dad');
    lastEnd = Math.max(lastEnd, end);
  }
  if (lastEnd < now - 2 * H - 10 * M) push({ type: 'sleep', end_at: now - 50 * M, night: false }, now - 2 * H, 'dad');

  // Born 18 days ago; weigh-ins from the hospital and the pediatrician.
  const birth = now - 18 * D;
  const [by, bm, bd] = ymd(birth);
  const dob = `${by}-${String(bm).padStart(2, '0')}-${String(bd).padStart(2, '0')}T14:32`;
  const weight = (when: number, grams: number, source: Weight['source']): Weight =>
    ({ id: `demo-w-${when}`, at: when, day: dayOf(when), grams, source, created_at: when, updated_at: when, deleted_at: null });
  const weights = [
    weight(at(18, 14, 40), 3289, 'hospital'),
    weight(at(16, 9, 0), 3130, 'hospital'),
    weight(at(13, 10, 30), 3075, 'pediatrician'),
    weight(at(9, 11, 0), 3210, 'pediatrician'),
    weight(at(4, 10, 15), 3460, 'pediatrician'),
  ];

  const appt = (id: string, when: number, title: string, location: string, kind: Appointment['kind']): Appointment =>
    ({ id, kind, title, at: when, day: dayOf(when), location, created_at: now, updated_at: now, deleted_at: null });
  const appointments = [
    appt('demo-a-1', at(-1, 10, 30), 'Weight check', 'Dr. Patel · Riverside Pediatrics', 'pediatrician'),
    appt('demo-a-2', at(-6, 14, 0), 'Postpartum check', "Women's Health Associates", 'ob'),
  ];

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    baby_name: 'Baby June', dob, tz, feed_interval_min: 180,
    med_intervals: { tylenol: 360, motrin: 360 }, rotation: { enabled: true, stagger_min: 180 },
    users: { dad: 'Dad', mom: 'Mom', other: 'Grandma' },
  };
  return { settings, entries, weights, appointments };
}
