import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { useUI } from '../ui';
import { shareUrl, joinHousehold } from '../household';
import { MEDS, allMeds, type Who } from '../types';
import { Field, Seg } from '../components/common';
import { getTimezone, deviceTimezone } from '../lib/time';
import { entriesToCsv, backupJson, deliverFile } from '../lib/export';
import { FEEDBACK_EMAIL, GUIDE_URL, NOTES_URL } from '../config';
import { DocViewer } from '../components/DocViewer';
import { DEFAULT_NIGHT_SLEEP } from '../lib/sleep';

function TextSetting({ label, value, onSave, type = 'text', inputMode }: { label: string; value: string; onSave: (v: string) => void; type?: string; inputMode?: 'numeric' | 'decimal' | 'text' }) {
  const [v, setV] = useState(value);
  return (
    <Field label={label}>
      <input type={type} inputMode={inputMode} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </Field>
  );
}

function MedInterval({ label, minutes, onSave }: { label: string; minutes: number | undefined; onSave: (hours: string) => void }) {
  const initial = minutes ? String(Math.round((minutes / 60) * 10) / 10) : '';
  const [v, setV] = useState(initial);
  return (
    <>
      {label && <div>{label}</div>}
      <div className="inline"><input type="number" inputMode="decimal" step="0.5" placeholder="hrs" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== initial && onSave(v)} /></div>
    </>
  );
}

/** "21:00" shifted by `deltaMin`, as "8:30 PM". */
function fmtClock(hhmm: string, deltaMin: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const t = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  const hh = Math.floor(t / 60), mm = t % 60;
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

const TIMEZONES: string[] = (() => {
  try { const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone'); if (all?.length) return all; } catch { /* ignore */ }
  return ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'];
})();

export function Settings() {
  const { settings, saveSettings, who, setWho, hid, pending, stuck, online, entries, weights, appointments, loadOlder, deleteHousehold, demo } = useStore();
  const { toast } = useUI();
  const [copied, setCopied] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [newMed, setNewMed] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ title: string; src: string } | null>(null);
  const url = shareUrl(hid);
  const tz = settings.tz ?? getTimezone();
  const night = settings.night_feeds ?? { enabled: false, start: '21:00', end: '06:00' };
  const sleepWin = settings.night_sleep ?? DEFAULT_NIGHT_SLEEP;
  const units = settings.units ?? { volume: 'ml', weight: 'lb' };
  const custom = settings.custom_meds ?? [];
  const meds = allMeds(custom).filter((m) => m.value !== 'other');

  const setInterval_ = (med: string, hours: string) => {
    const mi = { ...settings.med_intervals };
    const h = parseFloat(hours);
    if (!hours || isNaN(h) || h <= 0) delete mi[med]; else mi[med] = Math.round(h * 60);
    void saveSettings({ med_intervals: mi });
  };
  const addMed = () => {
    const name = newMed.trim();
    if (!name || custom.includes(name) || MEDS.some((m) => m.label.toLowerCase() === name.toLowerCase())) { setNewMed(''); return; }
    void saveSettings({ custom_meds: [...custom, name] });
    setNewMed('');
  };
  const removeMed = (name: string) => {
    const mi = { ...settings.med_intervals }; delete mi[name];
    void saveSettings({ custom_meds: custom.filter((c) => c !== name), med_intervals: mi });
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* show text instead */ } };
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: 'bébé tracker', url }); } catch { /* cancelled */ } } else void copy(); };

  // Fetch older entries as soon as Settings opens, so an export tap can open the share sheet
  // synchronously (iOS only allows it during the tap) with the full history already in hand.
  useEffect(() => { loadOlder().catch((e) => console.error('loadOlder', e)); }, [loadOlder]);
  const allEntries = async () => {
    const older = await loadOlder();
    const ids = new Set(entries.map((e) => e.id));
    return [...entries, ...older.filter((e) => !ids.has(e.id))];
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const said = (what: string, how: 'shared' | 'downloaded' | 'copied') => toast(how === 'shared' ? `${what} shared` : how === 'copied' ? `${what} copied to the clipboard. Paste it into Notes or an email.` : `${what} downloaded`);
  const exportCsv = async () => {
    setBusy('csv');
    try { said('CSV', await deliverFile(`bebe-entries-${stamp()}.csv`, entriesToCsv(await allEntries()), 'text/csv')); }
    catch (e) { if ((e as DOMException).name !== 'AbortError') { console.error(e); toast('Export failed. Check the connection and try again.'); } }
    finally { setBusy(null); }
  };
  const exportJson = async () => {
    setBusy('json');
    try { said('Backup', await deliverFile(`bebe-backup-${stamp()}.json`, backupJson({ settings, entries: await allEntries(), weights, appointments }), 'application/json')); }
    catch (e) { if ((e as DOMException).name !== 'AbortError') { console.error(e); toast('Backup failed. Check the connection and try again.'); } }
    finally { setBusy(null); }
  };
  const del = async () => {
    if (!window.confirm(`Delete this household and every entry, weight and appointment in it?\n\nThis cannot be undone. Export a backup first if you want to keep the data.`)) return;
    if (!window.confirm('Really delete everything? Both phones will lose the log.')) return;
    setBusy('delete');
    try { await deleteHousehold(); } catch { setBusy(null); toast('Delete failed. Check the connection and try again.'); }
  };

  return (
    <div className="screen">
      <h1>Settings</h1>

      {demo && (
        <div className="card">
          <h3>This is a demo</h3>
          <div className="muted small">Made-up entries for a pretend baby, held on this screen only. Log, edit and change settings as much as you like: nothing is saved, and reloading starts over.</div>
          <a className="btn primary block" href="/" style={{ textDecoration: 'none' }}>Start your own household</a>
        </div>
      )}

      <div className="card">
        <h3>This phone</h3>
        <Field label="Who is logging from this phone?">
          <Seg<Who> options={[{ value: 'dad', label: settings.users.dad }, { value: 'mom', label: settings.users.mom }, { value: 'other', label: settings.users.other || 'Other' }]} value={who ?? 'dad'} onChange={setWho} />
        </Field>
        <div className="muted small">Sync: {!online ? 'offline — entries are saved here and sent when back online' : stuck ? 'still sending — weak signal? Entries are safe on this phone and will go through.' : pending ? 'sending…' : 'up to date'}</div>
      </div>

      {!demo && (
      <div className="card">
        <h3>Share with the other phone</h3>
        <div className="muted small">This link <b>is</b> the key to your data. Send it only to each other. Open it on the other phone, then Share → Add to Home Screen from that page.</div>
        <div className="link-box">{url}</div>
        <div className="actions" style={{ display: 'flex', gap: 10 }}>
          <button className="btn primary grow" onClick={share}>Share link</button>
          <button className="btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>
      )}

      {!demo && (
      <div className="card">
        <h3>Wrong household on this device?</h3>
        <div className="muted small">If this device shows an empty log, paste the family link here to switch to it.</div>
        <div className="inline">
          <input type="text" inputMode="url" placeholder="Paste family link" value={joinLink} onChange={(e) => setJoinLink(e.target.value)} />
          <button className="btn" disabled={!joinLink.trim()} onClick={() => { if (!joinHousehold(joinLink)) alert('That does not look like a family link.'); }}>Switch</button>
        </div>
      </div>
      )}

      <div className="card">
        <h3>Baby</h3>
        <TextSetting label="Name" value={settings.baby_name} onSave={(v) => void saveSettings({ baby_name: v || 'Baby' })} />
        <TextSetting label="Date & time of birth" type="datetime-local" value={settings.dob} onSave={(v) => v && void saveSettings({ dob: v })} />
      </div>

      <div className="card">
        <h3>Feed timer</h3>
        <MedInterval key={`feed-${settings.feed_interval_min}`} label="Hours between feeds" minutes={settings.feed_interval_min} onSave={(h) => { const n = parseFloat(h); if (h && !isNaN(n) && n > 0) void saveSettings({ feed_interval_min: Math.round(n * 60) }); }} />
        <Seg<'same' | 'night'> options={[{ value: 'same', label: 'Same all day' }, { value: 'night', label: 'Different at night' }]} value={night.enabled ? 'night' : 'same'} onChange={(v) => void saveSettings({ night_feeds: { ...night, enabled: v === 'night' } })} />
        {night.enabled ? (
          <>
            <MedInterval key={`night-${night.interval_min ?? ''}`} label="Hours between feeds at night" minutes={night.interval_min} onSave={(h) => { const n = parseFloat(h); void saveSettings({ night_feeds: { ...night, interval_min: !h || isNaN(n) || n <= 0 ? undefined : Math.round(n * 60) } }); }} />
            <div className="night-times">
              <TextSetting key={`ns-${night.start}`} label="Night starts" type="time" value={night.start} onSave={(v) => v && void saveSettings({ night_feeds: { ...night, start: v } })} />
              <TextSetting key={`ne-${night.end}`} label="Night ends" type="time" value={night.end} onSave={(v) => v && void saveSettings({ night_feeds: { ...night, end: v } })} />
            </div>
            <div className="muted small">The interval follows when the last feed <b>started</b>: a feed at {fmtClock(night.start, -30)} counts down the day hours, one at {fmtClock(night.start, 0)} the night hours.{!night.interval_min && ' Enter night hours to turn it on.'}</div>
          </>
        ) : (
          <div className="muted small">Today counts down from the last feed. Switch to "Different at night" if nights run on a longer stretch.</div>
        )}
      </div>

      <div className="card">
        <h3>Time zone &amp; units</h3>
        <Field label="Time zone (days roll over at midnight here)">
          <select value={tz} onChange={(e) => void saveSettings({ tz: e.target.value })}>
            {!TIMEZONES.includes(tz) && <option value={tz}>{tz}</option>}
            {TIMEZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}{z === deviceTimezone() ? ' (this device)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Bottle and pump volumes">
          <Seg<'ml' | 'oz'> options={[{ value: 'ml', label: 'mL first' }, { value: 'oz', label: 'oz first' }]} value={units.volume} onChange={(v) => void saveSettings({ units: { ...units, volume: v } })} />
        </Field>
        <Field label="Weight">
          <Seg<'lb' | 'g'> options={[{ value: 'lb', label: 'lb & oz first' }, { value: 'g', label: 'grams first' }]} value={units.weight} onChange={(v) => void saveSettings({ units: { ...units, weight: v } })} />
        </Field>
        <div className="muted small">Both units are always stored; this only changes what's shown first.</div>
      </div>

      <div className="card">
        <h3>Meds</h3>
        <Seg<'on' | 'off'> options={[{ value: 'on', label: 'Tracking meds' }, { value: 'off', label: 'Off' }]} value={settings.meds_enabled === false ? 'off' : 'on'} onChange={(v) => void saveSettings({ meds_enabled: v === 'on' })} />
        <div className="muted small">{settings.meds_enabled === false
          ? 'Meds are hidden on Today and the Meds button is greyed out. Past doses stay in Summary and exports, and intervals are kept for when you turn it back on.'
          : 'Turn off when mom no longer needs meds tracked. Nothing is deleted.'}</div>
      </div>

      <div className="card">
        <h3>Sleep</h3>
        <Seg<'on' | 'off'> options={[{ value: 'on', label: 'Tracking sleep' }, { value: 'off', label: 'Off' }]} value={settings.sleep_enabled === false ? 'off' : 'on'} onChange={(v) => void saveSettings({ sleep_enabled: v === 'on' })} />
        {settings.sleep_enabled !== false ? (
          <>
            <div className="night-times">
              <TextSetting key={`ss-${sleepWin.start}`} label="Night sleep from" type="time" value={sleepWin.start} onSave={(v) => v && void saveSettings({ night_sleep: { ...sleepWin, start: v } })} />
              <TextSetting key={`se-${sleepWin.end}`} label="until" type="time" value={sleepWin.end} onSave={(v) => v && void saveSettings({ night_sleep: { ...sleepWin, end: v } })} />
            </div>
            <div className="muted small">A sleep that starts in this window is logged as night sleep, anything else as a nap, and you can flip it when you log. Bedtime is the first night sleep of each evening.</div>
          </>
        ) : (
          <div className="muted small">Sleep is hidden on Today, in the dock and in the Summary table. Past sleeps stay in All entries and the exports.</div>
        )}
      </div>

      <div className="card">
        <h3>Diapers</h3>
        <Seg<'on' | 'off'> options={[{ value: 'on', label: 'Tracking diapers' }, { value: 'off', label: 'Off' }]} value={settings.diapers_enabled === false ? 'off' : 'on'} onChange={(v) => void saveSettings({ diapers_enabled: v === 'on' })} />
        <div className="muted small">{settings.diapers_enabled === false
          ? 'Diaper counts are hidden on Today and in the Summary table, and the Diaper button is greyed out. Past changes stay in All entries and the exports.'
          : 'Turn off once you stop counting diapers. Nothing is deleted.'}</div>
      </div>

      <div className="card">
        <h3>Today screen</h3>
        <Field label={settings.meds_enabled === false ? 'Pumps' : 'Pumps and meds'}>
          <Seg<'countdown' | 'last'> options={[{ value: 'countdown', label: 'Countdown to next' }, { value: 'last', label: 'Last time only' }]} value={settings.today_mode ?? 'countdown'} onChange={(v) => void saveSettings({ today_mode: v })} />
        </Field>
        <div className="muted small">{settings.meds_enabled === false
          ? ((settings.today_mode ?? 'countdown') === 'last' ? 'Today shows when the last pump was.' : 'Today counts down to the next pump from the interval below, or shows the last pump if it is blank.')
          : (settings.today_mode ?? 'countdown') === 'last'
            ? 'Today shows the last pump and every med taken in the last 24 hours, and you decide the next one. Intervals below are kept but not shown.'
            : 'Today counts down to the next pump and dose from the intervals below.'}</div>
        <MedInterval key={`pump-${settings.pump_interval_min ?? ''}`} label="Pump interval (hours) — blank = show the last pump only" minutes={settings.pump_interval_min} onSave={(h) => { const n = parseFloat(h); void saveSettings({ pump_interval_min: !h || isNaN(n) || n <= 0 ? undefined : Math.round(n * 60) }); }} />
      </div>

      {settings.meds_enabled !== false && (<>
      <div className="card">
        <h3>Med intervals</h3>
        <div className="muted small">Hours between doses, <b>from your discharge instructions</b>. Blank = no countdown. The app never suggests an interval or a dose.</div>
        <div className="med-grid">
          {meds.map((m) => (
            <MedInterval key={m.value} label={m.label} minutes={settings.med_intervals[m.value]} onSave={(h) => setInterval_(m.value, h)} />
          ))}
        </div>
        {custom.length > 0 && (
          <div className="chips">{custom.map((c) => <button key={c} className="chip" onClick={() => removeMed(c)} title="Remove">{c} ✕</button>)}</div>
        )}
        <Field label="Add a med not in the list">
          <div className="inline">
            <input type="text" value={newMed} placeholder="e.g. Iron, Colace" onChange={(e) => setNewMed(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMed(); }} />
            <button className="btn" disabled={!newMed.trim()} onClick={addMed}>Add</button>
          </div>
        </Field>
      </div>

      <div className="card">
        <h3>Tylenol / Ibuprofen rotation</h3>
        <div className="muted small">Shows one "next up" countdown that alternates between the two. Enter the minimum gap between <b>any</b> two doses of the pair from your discharge sheet (often written as "alternate every N hours"). Each med's own interval above still applies.</div>
        <Seg<'on' | 'off'> options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]} value={settings.rotation.enabled ? 'on' : 'off'} onChange={(v) => void saveSettings({ rotation: { ...settings.rotation, enabled: v === 'on' } })} />
        {settings.rotation.enabled && (
          <div className="med-grid">
            <div>Gap between doses</div>
            <MedInterval key={`stagger-${settings.rotation.stagger_min ?? ''}`} label="" minutes={settings.rotation.stagger_min} onSave={(h) => { const n = parseFloat(h); void saveSettings({ rotation: { enabled: true, stagger_min: !h || isNaN(n) || n <= 0 ? undefined : Math.round(n * 60) } }); }} />
            {settings.rotation.enabled && !settings.rotation.stagger_min && <div className="muted small" style={{ gridColumn: '1 / -1' }}>Enter a gap in hours to turn the countdown on.</div>}
            {(!settings.med_intervals.tylenol || !settings.med_intervals.motrin) && <div className="muted small" style={{ gridColumn: '1 / -1' }}>Tip: also set Tylenol and Ibuprofen intervals above so each one's own limit is enforced.</div>}
          </div>
        )}
      </div>
      </>)}

      <div className="card">
        <h3>Names</h3>
        <TextSetting label="Dad" value={settings.users.dad} onSave={(v) => void saveSettings({ users: { ...settings.users, dad: v || 'Dad' } })} />
        <TextSetting label="Mom" value={settings.users.mom} onSave={(v) => void saveSettings({ users: { ...settings.users, mom: v || 'Mom' } })} />
        <TextSetting label="Someone else (grandparent, nanny…)" value={settings.users.other || ''} onSave={(v) => void saveSettings({ users: { ...settings.users, other: v || 'Caregiver' } })} />
      </div>

      <div className="card">
        <h3>Export &amp; backup</h3>
        <div className="muted small">Your data, in files you keep. On a phone these open the share sheet, so you can save to Files or send them anywhere.</div>
        <button className="btn block" disabled={!!busy} onClick={() => void exportCsv()}>{busy === 'csv' ? 'Preparing…' : 'Export all entries (CSV)'}</button>
        <button className="btn block" disabled={!!busy} onClick={() => void exportJson()}>{busy === 'json' ? 'Preparing…' : 'Backup everything (JSON)'}</button>
      </div>

      {!demo && (
      <div className="card">
        <h3>Delete</h3>
        <div className="muted small">Removes every entry, weight, appointment and setting in this household, for both phones. Take a backup first.</div>
        <button className="btn danger block" disabled={!!busy} onClick={() => void del()}>{busy === 'delete' ? 'Deleting…' : 'Delete this household'}</button>
      </div>
      )}

      <div className="muted small center" style={{ lineHeight: 1.8 }}>
        <button className="btn ghost" style={{ minHeight: 0, padding: 0, fontSize: 14 }} onClick={() => setDoc({ title: 'Guide', src: GUIDE_URL })}>Guide</button> · <button className="btn ghost" style={{ minHeight: 0, padding: 0, fontSize: 14 }} onClick={() => setDoc({ title: "What's new", src: NOTES_URL })}>What's new</button> · <a className="btn ghost" style={{ minHeight: 0, padding: 0, fontSize: 14, textDecoration: 'none' }} href={`mailto:${FEEDBACK_EMAIL}?subject=b%C3%A9b%C3%A9%20tracker%20feedback`}>Feedback</a>
        <br /><span className="wordmark small">bébé <span>tracker</span></span> · build {__BUILD__} · {demo ? 'demo, not saved' : `household ${hid.slice(0, 6)}…`}
      </div>
      {doc && <DocViewer title={doc.title} src={doc.src} onClose={() => setDoc(null)} />}
    </div>
  );
}
