import { useStore } from '../data/store';
import { useNow } from '../hooks';
import { isActive } from '../lib/summary';
import { dayOf, fmtDur, fromLocal } from '../lib/time';
import {
  DEFAULT_NIGHT_SLEEP, sleepMsOnDay, placeSegments, currentNight, lastCompletedNight, nightsBack, nightKey, sleepsOf, weekSummary, fmtEveningMinutes, loggedNights,
} from '../lib/sleep';
import { SLEEP_HOW_LABEL } from '../types';

const SPAN_START_H = 18, SPAN_H = 14; // each row runs 6 PM to 8 AM
const TICKS = [{ h: 0, label: '6p' }, { h: 3, label: '9p' }, { h: 6, label: '12a' }, { h: 9, label: '3a' }, { h: 12, label: '6a' }];

function rowSpan(key: string): [number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [fromLocal(y, m, d, SPAN_START_H, 0), fromLocal(y, m, d + 1, SPAN_START_H + SPAN_H - 24, 0)];
}

function rowLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${wd} ${m}/${d}`;
}

/**
 * The sleep diary: one row per night, 6 PM to 8 AM, sleep as bars and feeds as dots, newest night on top.
 * Under it, the last seven finished nights against the seven before.
 */
export function SleepDiary() {
  const { entries, settings } = useStore();
  const now = useNow(60_000);
  const win = settings.night_sleep ?? DEFAULT_NIGHT_SLEEP;
  const last = lastCompletedNight(now, win);
  const tonight = currentNight(now, win);
  const keys = nightsBack(tonight ?? last, 14);
  const sleeps = sleepsOf(entries);
  const feeds = entries.filter((e) => e.type === 'feed' && isActive(e));

  if (loggedNights(entries, now, 15) === 0) {
    return (
      <div className="card">
        <h3>Sleep diary</h3>
        <div className="muted">Log a few nights and they line up here: one row per night from 6 PM to 8 AM, sleep as bars and feeds as dots.</div>
      </div>
    );
  }

  const recent = nightsBack(last, 14);
  const thisWeek = weekSummary(entries, recent.slice(0, 7), now, win);
  const before = weekSummary(entries, recent.slice(7), now, win);
  const pct = (t: number, [a, b]: [number, number]) => Math.min(100, Math.max(0, ((t - a) / (b - a)) * 100));

  return (
    <>
      <div className="card diary">
        <h3>Sleep diary</h3>
        <div className="diary-axis">{TICKS.map((t) => <span key={t.label} style={{ left: `${(t.h / SPAN_H) * 100}%` }}>{t.label}</span>)}</div>
        {keys.map((key) => {
          const span = rowSpan(key);
          const inRow = sleeps.filter((s) => s.at < span[1] && (s.end_at ?? now) > span[0]);
          const dots = feeds.filter((f) => f.at >= span[0] && f.at <= span[1] && f.at <= now);
          const first = sleeps.find((s) => s.night && nightKey(s.at) === key);
          const how = first?.how?.map((h) => SLEEP_HOW_LABEL[h] ?? h).join(' + ');
          return (
            <div key={key} className="diary-row">
              <div className="diary-label">
                <span>{key === tonight ? 'Tonight' : rowLabel(key)}</span>
                {how && <span className="muted">{how}</span>}
              </div>
              <div className="diary-track">
                {TICKS.slice(1).map((t) => <i key={t.label} className="diary-grid" style={{ left: `${(t.h / SPAN_H) * 100}%` }} />)}
                {inRow.flatMap((s) => placeSegments(s, now).map(([from, to, place], i) => {
                  if (to < span[0] || from > span[1]) return null;
                  const a = pct(Math.max(from, span[0]), span), b = pct(Math.min(to, span[1]), span);
                  return <b key={`${s.id}-${i}`} className={`diary-bar${place ? ` p-${place}` : ''}${s.night ? '' : ' nap'}${s.end_at == null ? ' open' : ''}`} style={{ left: `${a}%`, width: `${Math.max(0.8, b - a)}%` }} />;
                }))}
                {dots.map((f) => <em key={f.id} className="diary-dot" style={{ left: `${pct(f.at, span)}%` }} />)}
              </div>
            </div>
          );
        })}
        <div className="diary-key muted small"><b className="diary-bar" /> sleep <b className="diary-bar nap" /> nap <em className="diary-dot" /> feed</div>
      </div>

      {thisWeek.nights > 0 && (
        <div className="card">
          <h3>Week over week</h3>
          <table className="compare">
            <thead><tr><th /><th>Last 7 nights</th><th>7 before</th></tr></thead>
            <tbody>
              <tr><td>First stretch</td><td>{thisWeek.firstStretchMs != null ? fmtDur(thisWeek.firstStretchMs) : '—'}</td><td>{before.firstStretchMs != null ? fmtDur(before.firstStretchMs) : '—'}</td></tr>
              <tr><td>Longest stretch</td><td>{thisWeek.longestMs != null ? fmtDur(thisWeek.longestMs) : '—'}</td><td>{before.longestMs != null ? fmtDur(before.longestMs) : '—'}</td></tr>
              <tr><td>Bedtime</td><td>{thisWeek.bedtimeMin != null ? fmtEveningMinutes(thisWeek.bedtimeMin) : '—'}</td><td>{before.bedtimeMin != null ? fmtEveningMinutes(before.bedtimeMin) : '—'}</td></tr>
              <tr><td>Night feeds</td><td>{thisWeek.nightFeeds != null ? thisWeek.nightFeeds.toFixed(1) : '—'}</td><td>{before.nightFeeds != null ? before.nightFeeds.toFixed(1) : '—'}</td></tr>
            </tbody>
          </table>
          <div className="muted small">Averages over nights with a bedtime logged: {thisWeek.nights} of the last 7{before.nights ? `, ${before.nights} of the 7 before` : ''}. Night feeds are feeds after bedtime inside the night window.</div>
        </div>
      )}
    </>
  );
}

/** Today's sleep stats: total sleep yesterday, the daily average over the last 7 days, and the average bedtime. */
export function NightsCard({ onOpen }: { onOpen: () => void }) {
  const { entries, settings } = useStore();
  const now = useNow(60_000);
  const win = settings.night_sleep ?? DEFAULT_NIGHT_SLEEP;
  const days = nightsBack(dayOf(now), 8).slice(1); // yesterday and the six days before
  const totals = days.map((d) => sleepMsOnDay(entries, d, now));
  const logged = totals.filter((t) => t > 0);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
  const bed = weekSummary(entries, nightsBack(lastCompletedNight(now, win), 7), now, win).bedtimeMin;
  return (
    <div className="card compact pressable nights" onClick={onOpen}>
      <h3>Sleep stats</h3>
      <div className="kv"><span>Yesterday</span><b>{totals[0] ? fmtDur(totals[0]) : '—'}</b></div>
      <div className="kv"><span>7-day avg</span><b>{avg ? fmtDur(avg) : '—'}</b></div>
      <div className="kv"><span>Avg bedtime</span><b>{bed != null ? fmtEveningMinutes(bed) : '—'}</b></div>
    </div>
  );
}
