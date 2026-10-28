// Seeds (or re-seeds) the demo household used for release-notes screenshots. Idempotent: fixed doc ids.
// Run from this folder: node seed-demo.mjs   (uses the Firebase CLI's login token)
import { readFileSync } from 'node:fs';
const tok = JSON.parse(readFileSync(process.env.HOME + '/.config/configstore/firebase-tools.json', 'utf8')).tokens.access_token;
const HID = 'demo-release-notes-Xk29Qp7Lm3RtVw';
const BASE = `https://firestore.googleapis.com/v1/projects/bebe-tracker-1cf656/databases/(default)/documents/households/${HID}`;
const fv = (v) => v === null || v === undefined ? { nullValue: null }
  : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(fv) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fv(x)])) } };
const put = async (path, id, data) => {
  const r = await fetch(`${BASE}/${path}/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, x]) => [k, fv(x)])) }) });
  if (!r.ok) throw new Error(`${path}/${id}: ${r.status} ${await r.text()}`);
};
const TZ = 'America/New_York';
const dayOf = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
// New York wall time -> ms (EDT, UTC-4 in September)
const ny = (y, m, d, hh, mm) => Date.UTC(y, m - 1, d, hh + 4, mm);
const now = Date.now();
const H = 3_600_000, M = 60_000;
let n = 0;
const base = (at, who) => ({ at, day: dayOf(at), created_at: at, updated_at: at, logged_by: who, deleted_at: null });
const E = [];
const feed = (at, kind, extra, who = 'mom') => E.push({ type: 'feed', kind, ...extra, ...base(at, who) });
const diaper = (at, wet, dirty, color, who = 'dad') => E.push({ type: 'diaper', wet, dirty, ...(color ? { stool_color: color } : {}), ...base(at, who) });
const pump = (at, volume_ml, duration_min) => E.push({ type: 'pump', volume_ml, duration_min, ...base(at, 'mom') });
const med = (at, m, dose_text) => E.push({ type: 'mom_med', med: m, ...(dose_text ? { dose_text } : {}), ...base(at, 'mom') });

// Two full prior days (yesterday and the day before) for Summary
const todayNY = dayOf(now); const dayBack = (n) => { const d = new Date(now - n * 86_400_000); const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value])); return [+p.year, +p.month, +p.day]; };
const [y1, m1, d1] = dayBack(1), [y2, m2, d2] = dayBack(2);
for (const [ymd, wetN] of [[[y2, m2, d2], 6], [[y1, m1, d1], 7]]) {
  const [yy, mm, d] = ymd;
  const times = [7, 0, 10, 0, 13, 0, 16, 0];
  for (let i = 0; i < times.length; i += 2) {
    const at = ny(yy, mm, d, times[i], times[i + 1]);
    if (i % 4 === 0) feed(at, 'breast', { side: i % 8 === 0 ? 'left' : 'right', duration_min: 15 + (i % 3) * 5, latch_quality: 'good' });
    feed(at + 25 * M, 'bottle_formula', { volume_ml: 45 + (i % 3) * 15 }, i % 4 === 0 ? 'dad' : 'mom');
  }
  for (let i = 0; i < wetN; i++) diaper(ny(yy, mm, d, 1 + i * 3, 10 + i * 5), true, i % 2 === 0, i % 2 === 0 ? (wetN === 6 ? 'green' : 'yellow') : undefined, i % 2 ? 'mom' : 'dad');
  for (const [hh, ml] of [[2, 25], [7, 40], [12, 45], [16, 40], [21, 50]]) pump(ny(yy, mm, d, hh, 40), ml, 15);
  med(ny(yy, mm, d, 1, 0), 'tylenol', '650 mg'); med(ny(yy, mm, d, 4, 0), 'motrin', '600 mg'); med(ny(yy, mm, d, 7, 0), 'tylenol', '650 mg');
  med(ny(yy, mm, d, 10, 0), 'motrin', '600 mg'); med(ny(yy, mm, d, 13, 0), 'tylenol', '650 mg'); med(ny(yy, mm, d, 16, 0), 'motrin', '600 mg');
  med(ny(yy, mm, d, 9, 0), 'lovenox', '40 mg'); med(ny(yy, mm, d, 9, 5), 'stool_softener');
}
// Sleep: fourteen nights where bedtime drifts earlier, the first stretch lengthens and night feeds thin out.
const sleepAt = (back, hh, mm) => { const [y, m, d] = dayBack(back); return ny(y, m, d, hh, mm); };
const S = [];
for (let back = 14; back >= 1; back--) {
  const t = (14 - back) / 13;
  const bed = sleepAt(back, 19, 45) - Math.round(35 * t) * M;
  const first = bed + (135 + Math.round(85 * t)) * M;
  const nf = [bed - 20 * M];
  S.push([bed, first, true, back % 3 === 0 ? ['feeding', 'rocking'] : back % 3 === 1 ? ['feeding'] : ['rocking', 'pacifier']]);
  let t0 = first + 30 * M;
  nf.push(first + 5 * M);
  for (const len of back > 7 ? [125, 115, 120] : [240, 150]) {
    const end = t0 + len * M;
    if (end > sleepAt(back - 1, 6, 50)) break;
    S.push([t0, end, true]);
    nf.push(end + 5 * M);
    t0 = end + 30 * M;
  }
  if (back <= 2) for (const [h1, m1, h2, m2] of [[9, 0, 10, 15], [12, 30, 14, 0], [16, 0, 17, 0]]) S.push([sleepAt(back, h1, m1), sleepAt(back, h2, m2), false]);
  for (const f of nf) if (f < now) feed(f, 'bottle_formula', { volume_ml: 90 }, f % 2 ? 'dad' : 'mom');
}
let lastEnd = 0;
for (const [start, end, night, how] of S.sort((a, b) => a[0] - b[0])) {
  if (end > now - 10 * M) continue;
  E.push({ type: 'sleep', end_at: end, night, ...(how ? { how } : {}), ...base(start, night ? 'mom' : 'dad') });
  lastEnd = Math.max(lastEnd, end);
}
if (lastEnd < now - 2 * H - 10 * M) E.push({ type: 'sleep', end_at: now - 50 * M, night: false, ...base(now - 2 * H, 'dad') });

// Today: anchored to "now" so timers look live whenever the screenshot is taken
feed(now - 6 * H - 20 * M, 'bottle_formula', { volume_ml: 60 }, 'dad');
diaper(now - 6 * H - 10 * M, true, false);
feed(now - 3 * H - 10 * M, 'breast', { side: 'left', duration_min: 15, latch_quality: 'ok' });
feed(now - 2 * H - 45 * M, 'bottle_formula', { volume_ml: 45 });
diaper(now - 2 * H - 40 * M, true, true, 'yellow', 'mom');
pump(now - 2 * H - 15 * M, 40, 15);
feed(now - 1 * H - 25 * M, 'bottle_formula', { volume_ml: 60 }, 'dad');
diaper(now - 1 * H - 20 * M, true, false);
diaper(now - 20 * M, false, true, 'light_brown');
med(now - 4 * H, 'tylenol', '650 mg');
med(now - 1 * H, 'motrin', '600 mg');
med(now - 20 * H, 'lovenox', '40 mg');

await put('settings', 'main', {
  baby_name: 'Baby Girl', dob: `${dayOf(now - 18 * 86_400_000)}T14:32`, feed_interval_min: 180,
  med_intervals: { tylenol: 360, motrin: 360, lovenox: 1440 }, rotation: { enabled: true, stagger_min: 180 },
  users: { dad: 'Dad', mom: 'Mom' },
});
for (const e of E) await put('entries', `demo-${String(n++).padStart(3, '0')}`, e);
const [ya, ma, da] = (() => { const d = new Date(now + 86_400_000); const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value])); return [+p.year, +p.month, +p.day]; })();
const apptAt = ny(ya, ma, da, 10, 30);
void todayNY;
await put('appointments', 'demo-appt-1', { kind: 'pediatrician', title: 'Weight check', at: apptAt, day: dayOf(apptAt), location: 'Dr. Patel · Riverside Pediatrics', notes: 'Bring the feeding log', created_at: now, updated_at: now, deleted_at: null });
const apptAt2 = apptAt + 3 * 86_400_000 + 3.5 * 3_600_000;
await put('appointments', 'demo-appt-2', { kind: 'ob', title: 'Incision check', at: apptAt2, day: dayOf(apptAt2), location: 'Women\'s Health Associates', created_at: now, updated_at: now, deleted_at: null });
// Made-up weigh-ins relative to the made-up birth date above.
for (const [i, [daysAfterBirth, grams, source]] of [[0, 3289, 'hospital'], [2, 3130, 'hospital'], [5, 3075, 'pediatrician'], [9, 3210, 'pediatrician'], [14, 3460, 'pediatrician']].entries()) {
  const at = now - (18 - daysAfterBirth) * 86_400_000 - 3 * 3_600_000;
  await put('weights', `w${i}`, { at, day: dayOf(at), grams, source, created_at: at, updated_at: at, deleted_at: null });
}
console.log(`seeded ${E.length} entries into ${HID}`);
