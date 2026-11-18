#!/usr/bin/env node
// Saves a full copy of one household (settings, entries, weights, appointments) as a dated JSON file,
// in the same shape as the app's "Backup everything (JSON)". Reads with the household link only, like the app.
//
//   node scripts/backup.mjs <household link or id> <folder> [days to keep, default 90]
//
// Run it nightly with launchd (see docs/backups.md). The household link is a secret: keep it out of the repo.
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const [, , link, dir, keepArg] = process.argv;
const hid = (link ?? '').match(/([A-Za-z0-9_-]{24,})\/?$/)?.[1];
if (!hid || !dir) { console.error('usage: node scripts/backup.mjs <household link> <folder> [days to keep]'); process.exit(2); }
const keep = Number(keepArg) || 90;
const BASE = `https://firestore.googleapis.com/v1/projects/bebe-tracker-1cf656/databases/(default)/documents/households/${hid}`;

/** Firestore REST value -> plain JSON value. */
function plain(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(plain);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, plain(x)]));
  return null;
}
const docToObj = (d) => ({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, x]) => [k, plain(x)])) });

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      return await r.json();
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((res) => setTimeout(res, 5000 * attempt));
    }
  }
}
async function collection(name) {
  const out = [];
  let token = '';
  do {
    const page = await get(`${BASE}/${name}?pageSize=300${token ? `&pageToken=${token}` : ''}`);
    out.push(...(page?.documents ?? []).map(docToObj));
    token = page?.nextPageToken ?? '';
  } while (token);
  return out;
}

const settingsDoc = await get(`${BASE}/settings/main`);
const [entries, weights, appointments, settings_history] = await Promise.all([collection('entries'), collection('weights'), collection('appointments'), collection('settings_history')]);
if (!settingsDoc && !entries.length) { console.error(`nothing found for household ${hid.slice(0, 6)}…`); process.exit(1); }
const settings = settingsDoc ? docToObj(settingsDoc) : null;
if (settings) delete settings.id;

const now = new Date();
const stamp = now.toLocaleString('sv-SE', { timeZone: settings?.tz ?? 'America/New_York' }).slice(0, 16).replace(' ', '_').replace(':', '');
mkdirSync(dir, { recursive: true });
const file = join(dir, `bebe-backup-${stamp}.json`);
writeFileSync(file, JSON.stringify({ app: 'bébé tracker', format: 1, exported_at: now.toISOString(), source: 'nightly Mac backup', settings, entries, weights, appointments, settings_history }, null, 2));

// Keep the newest `keep` days of files.
const cutoff = Date.now() - keep * 86_400_000;
for (const f of readdirSync(dir)) {
  const m = f.match(/^bebe-backup-(\d{4}-\d{2}-\d{2})_\d{4}\.json$/);
  if (m && Date.parse(m[1]) < cutoff) unlinkSync(join(dir, f));
}
console.log(`${now.toISOString()} saved ${file}: ${entries.length} entries, ${weights.length} weights, ${appointments.length} appointments`);
