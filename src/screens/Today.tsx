import { useStore } from '../data/store';
import { useUI } from '../ui';
import { useNav } from '../App';
import { useNow } from '../hooks';
import { dayOf, parseNYLocal, ageAt, ageDaysOnDay, fmtTime, fmtDur, fmtWhen, fmtShortDay } from '../lib/time';
import { nextFeedDue, medTimer, rotationNext, pumpTimer, recentDoses, ROTATION_MEDS } from '../lib/timers';
import { summaryForDay } from '../lib/summary';
import { MEDS, STOOL_COLORS, medLabel, allMeds, type Med } from '../types';
import { volValue, volLabel, fmtMl, fmtWeight, fmtPct, pctChange } from '../lib/units';
import { WeightChart } from '../components/WeightChart';
import { openSleep, lastWake, sleepMsOnDay, napsOnDay, nightStats, latestNightKey } from '../lib/sleep';
import { Icon } from '../components/Icon';

export function Today() {
  const { entries, settings, pending, stuck, online, appointments, weights, demo } = useStore();
  const { openEditor, openWeightEditor } = useUI();
  const { setTab } = useNav();
  const now = useNow(15_000);
  const today = dayOf(now);
  const dob = parseNYLocal(settings.dob);
  const age = ageAt(dob, now);
  const feed = nextFeedDue(entries, settings.feed_interval_min, now, settings.night_feeds);
  const nightOn = !!(settings.night_feeds?.enabled && settings.night_feeds.interval_min);
  const medsOn = settings.meds_enabled !== false;
  const lastMode = settings.today_mode === 'last';
  const rotationOn = !lastMode && settings.rotation.enabled && !!settings.rotation.stagger_min;
  const rot = rotationOn ? rotationNext(entries, settings.med_intervals, settings.rotation.stagger_min!, now) : null;
  const meds = lastMode ? [] : (Object.entries(settings.med_intervals) as [Med, number | undefined][])
    .filter(([med, min]) => min && min > 0 && !(rotationOn && ROTATION_MEDS.includes(med)))
    .map(([med, min]) => medTimer(entries, med, min!, now))
    .sort((a, b) => MEDS.findIndex((m) => m.value === a.med) - MEDS.findIndex((m) => m.value === b.med));
  const recent = lastMode ? recentDoses(entries, now, 1, allMeds(settings.custom_meds).map((m) => m.value)) : [];
  const pump = pumpTimer(entries, lastMode ? undefined : settings.pump_interval_min, now);
  const s = summaryForDay(entries, today);
  const sleepOn = settings.sleep_enabled !== false;
  const asleep = sleepOn ? openSleep(entries) : null;
  const woke = sleepOn && !asleep ? lastWake(entries) : null;
  const naps = sleepOn ? napsOnDay(entries, today) : 0;
  const sleptToday = sleepOn ? sleepMsOnDay(entries, today, now) : 0;
  const lastNight = sleepOn ? latestNightKey(entries) : null;
  const night = lastNight ? nightStats(entries, lastNight, now) : null;
  const stale = !!asleep && now - asleep.at > 12 * 3_600_000;
  const stool = s.last_stool ? STOOL_COLORS.find((c) => c.value === s.last_stool) : undefined;
  const lastW = weights[weights.length - 1];
  const birthW = weights[0];
  const nextAppt = appointments.filter((a) => !a.deleted_at && a.at >= now - 2 * 3_600_000).sort((a, b) => a.at - b.at)[0];

  // "ago" strings: whole hours once it's been a while, so a row like "Lovenox 20h ago" stays on one line
  const ago = (ms: number) => ms >= 6 * 3_600_000 ? `${Math.round(ms / 3_600_000)}h` : fmtDur(ms);
  // Feed + pump + med rows. Three or fewer get roomy spacing on an iPhone 15; four or five need the tight spacing.
  const medRows = !medsOn ? 0 : lastMode ? Math.max(1, recent.length) : Math.max(1, (rot ? 1 : 0) + meds.length);
  // With sleep on, more than one med row folds into a single row (see the meds card) so Today stays at four rows at most.
  const compactMeds = sleepOn && medRows > 1;
  const timerRows = 2 + (sleepOn ? 1 : 0) + (compactMeds ? 1 : medRows);
  const roomy = timerRows <= 3 && !(sleepOn && settings.diapers_enabled !== false);
  const feedLine = !feed ? 'No feeds logged yet'
    : feed.status === 'ok' ? `Feed in ${fmtDur(feed.remainingMs)}`
    : feed.status === 'due' ? `Feed due · ${fmtDur(-feed.remainingMs)} ago`
    : `Feed overdue · ${fmtDur(-feed.remainingMs)}`;
  const feedClass = !feed || feed.status === 'ok' ? '' : feed.status === 'due' ? 'amber' : 'red';

  return (
    <div className={`screen today${roomy ? ' roomy' : ''}`}>
      <div className="row">
        <h1 style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>{settings.baby_name} <span className="muted small" style={{ fontWeight: 500 }}>Day {ageDaysOnDay(dob, today)} · {age.days}d {age.hours}h old</span></h1>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 2 }}>
          {demo ? <span className="badge demo">Demo</span> : <div className="mono muted">{fmtTime(now)}</div>}
          {!online ? <span className="badge warn">offline</span> : stuck ? <span className="badge warn">still syncing…</span> : pending ? <span className="badge">syncing…</span> : null}
        </div>
      </div>

      <div className="card timers hero">
        <button className="timer" onClick={() => openEditor('feed')}>
          <span className="ico t-feed"><Icon name="feed" /></span>
          <span className="grow">
            <span className={feedClass}>{feedLine}</span>
            <span className="sub">{feed ? `Last feed ${fmtTime(feed.lastAt)}${nightOn ? ` · ${feed.night ? 'night' : 'day'}, ${fmtDur(feed.intervalMin * 60_000)}` : ''}` : 'Tap to log the first feed'}</span>
          </span>
          {feed?.status === 'ok' && <span className="due">{fmtTime(feed.dueAt)}</span>}
        </button>
      </div>

      {sleepOn && (
        <div className="card timers hero">
          <button className="timer" onClick={() => openEditor('sleep', asleep ? { entry: asleep } : undefined)}>
            <span className="ico t-sleep"><Icon name="sleep" /></span>
            <span className="grow">
              {asleep ? <span className={stale ? 'amber' : ''}>{stale ? `Still asleep? ${ago(now - asleep.at)}` : `Asleep ${fmtDur(now - asleep.at)}`}</span>
                : woke ? <span>Awake {fmtDur(now - woke)}</span>
                : <span className="muted">No sleep logged yet</span>}
              <span className="sub">{asleep ? (stale ? 'Tap to fix the times' : `since ${fmtTime(asleep.at)} · ${asleep.night ? 'night' : 'nap'}`)
                : woke ? `woke ${fmtTime(woke)} · ${naps} ${naps === 1 ? 'nap' : 'naps'} today`
                : 'Tap Sleep when she falls asleep'}</span>
            </span>
          </button>
        </div>
      )}

      <div className="card timers hero">
        <button className="timer" onClick={() => openEditor('pump')}>
          <span className="ico t-pump"><Icon name="pump" /></span>
          <span className="grow">
            {!pump ? <span className="muted">No pumps logged yet</span>
              : pump.okAt === null ? <span>Pumped {ago(now - pump.lastAt)} ago</span>
              : <span className={pump.ok ? 'green' : ''}>{pump.ok ? 'Pump OK now' : `Pump in ${fmtDur(pump.remainingMs)}`}</span>}
            <span className="sub">{!pump ? 'Tap to log a pump' : `${pump.okAt === null ? fmtTime(pump.lastAt) : `Last pump ${fmtTime(pump.lastAt)}`} · ${s.pumps} today${s.pumped_ml ? ` · ${fmtMl(s.pumped_ml, false)}` : ''}`}</span>
          </span>
          {pump && pump.okAt !== null && !pump.ok && <span className="due">{fmtTime(pump.okAt)}</span>}
        </button>
      </div>

      {medsOn && compactMeds && (() => {
        // With sleep on, several med rows fold into one so Today keeps fitting: the next one up leads, the rest follow.
        const items = lastMode
          ? [...recent].sort((a, b) => b.lastAt - a.lastAt).map((d) => ({ med: d.med, head: `${medLabel(d.med)} ${ago(now - d.lastAt)} ago`, ok: false, pill: null as number | null, tail: `${medLabel(d.med)} ${fmtTime(d.lastAt)}` }))
          : [...(rot ? [{ med: rot.med, ok: rot.ok, okAt: rot.okAt, rem: rot.remainingMs }] : []), ...meds.map((m) => ({ med: m.med, ok: m.ok, okAt: m.okAt, rem: m.remainingMs }))]
            .sort((a, b) => (a.ok ? -1 : a.okAt ?? 0) - (b.ok ? -1 : b.okAt ?? 0))
            .map((m) => ({ med: m.med, head: m.ok ? `${medLabel(m.med)} OK now` : `${medLabel(m.med)} in ${fmtDur(m.rem)}`, ok: m.ok, pill: !m.ok && m.okAt ? m.okAt : null, tail: `${medLabel(m.med)} ${m.ok ? 'OK now' : m.okAt ? fmtTime(m.okAt) : ''}` }));
        const [first, ...rest] = items;
        return (
          <div className="card timers">
            <button className="timer" onClick={() => openEditor('mom_med', { preset: { med: first.med } })}>
              <span className="ico t-mom_med"><Icon name="mom_med" /></span>
              <span className="grow">
                <span className={first.ok ? 'green' : ''}>{first.head}</span>
                <span className="sub">{rest.map((r) => r.tail).join(' · ')}</span>
              </span>
              {first.pill && <span className="due">{fmtTime(first.pill)}</span>}
            </button>
          </div>
        );
      })()}
      {medsOn && !compactMeds && (
      <div className="card timers">
        {recent.map((d) => (
          <button key={d.med} className="timer" onClick={() => openEditor('mom_med', { preset: { med: d.med } })}>
            <span className="ico t-mom_med"><Icon name="mom_med" /></span>
            <span className="grow">
              <span>{medLabel(d.med)} {ago(now - d.lastAt)} ago</span>
              <span className="sub">{fmtTime(d.lastAt)}{d.dose ? ` · ${d.dose}` : ''}</span>
            </span>
          </button>
        ))}
        {lastMode && recent.length === 0 && (
          <button className="timer" onClick={() => openEditor('mom_med')}>
            <span className="ico t-mom_med"><Icon name="mom_med" /></span>
            <span className="grow">
              <span className="muted">No doses in the last 24 hours</span>
              <span className="sub">Tap to log one</span>
            </span>
          </button>
        )}
        {rot && (
          <button className="timer" onClick={() => openEditor('mom_med', { preset: { med: rot.med } })}>
            <span className="ico t-mom_med"><Icon name="mom_med" /></span>
            <span className="grow">
              <span className={rot.ok ? 'green' : ''}>{rot.ok ? `${medLabel(rot.med)} OK now` : `${medLabel(rot.med)} in ${fmtDur(rot.remainingMs)}`}</span>
              <span className="sub">Tylenol {rot.last.tylenol ? fmtTime(rot.last.tylenol) : '—'} · Ibuprofen {rot.last.motrin ? fmtTime(rot.last.motrin) : '—'}</span>
            </span>
            {!rot.ok && rot.okAt && <span className="due">{fmtTime(rot.okAt)}</span>}
          </button>
        )}
        {meds.map((m) => (
          <button key={m.med} className="timer" onClick={() => openEditor('mom_med', { preset: { med: m.med } })}>
            <span className="ico t-mom_med"><Icon name="mom_med" /></span>
            <span className="grow">
              <span className={m.ok ? 'green' : ''}>{m.ok ? `${medLabel(m.med)} OK now` : `${medLabel(m.med)} in ${fmtDur(m.remainingMs)}`}</span>
              <span className="sub">{m.lastAt ? `Last dose ${fmtTime(m.lastAt)}` : 'No dose logged yet'}</span>
            </span>
            {!m.ok && m.okAt && <span className="due">{fmtTime(m.okAt)}</span>}
          </button>
        ))}
        {!lastMode && !rot && meds.length === 0 && (
          <button className="timer" onClick={() => setTab('settings')}>
            <span className="ico t-mom_med"><Icon name="mom_med" /></span>
            <span className="grow">
              <span className="muted">Med countdowns off</span>
              <span className="sub">Enter dose intervals in Settings</span>
            </span>
            <span className="accent small">Set up ›</span>
          </button>
        )}
      </div>
      )}

      <div className="card compact">
        <h3>Today so far</h3>
        <div className="stats">
          <div className="stat"><span className="v">{s.bottles}</span><span className="k">bottle feeds</span></div>
          <div className="stat"><span className="v">{volValue(s.bottle_ml)}</span><span className="k">bottle {volLabel()}</span></div>
          <div className="stat"><span className="v">{volValue(s.pumped_ml)}</span><span className="k">pumped {volLabel()}</span></div>
          {sleepOn && (<>
            <div className="stat"><span className="v">{fmtDur(sleptToday)}</span><span className="k">sleep today</span></div>
            <div className="stat"><span className="v">{naps}</span><span className="k">{naps === 1 ? 'nap' : 'naps'}</span></div>
            <div className="stat"><span className="v">{night && night.longestMs ? fmtDur(night.longestMs) : '—'}</span><span className="k">longest night</span></div>
          </>)}
          {settings.diapers_enabled !== false && !sleepOn && (<>
            <div className="stat"><span className="v">{s.diapers}</span><span className="k">diapers</span></div>
            <div className="stat"><span className="v">{s.wet}</span><span className="k">wet</span></div>
            <div className="stat"><span className="v">{s.dirty}</span><span className="k">dirty{stool ? ' · ' : ''}{stool && <span className="swatch" style={{ background: stool.swatch, verticalAlign: 'middle' }} />}</span></div>
          </>)}
        </div>
        <div className="muted small ellipsis">Bottles: {s.bottle_ml > 0
          ? [s.formula_ml > 0 && `${fmtMl(s.formula_ml, false)} formula`, s.breastmilk_bottle_ml > 0 && `${fmtMl(s.breastmilk_bottle_ml, false)} breast milk`].filter(Boolean).join(' · ')
          : 'none today'}</div>
        <div className="muted small ellipsis">Breastfeeding: {s.breast > 0 ? `${s.breast} session${s.breast === 1 ? '' : 's'}${s.breast_min ? `, ${s.breast_min} min` : ''}` : 'none today'}</div>
        {settings.diapers_enabled !== false && sleepOn && <div className="muted small ellipsis">Diapers: {s.diapers ? <>{s.diapers} · {s.wet} wet · {s.dirty} dirty{stool && <> <span className="swatch" style={{ background: stool.swatch, verticalAlign: 'middle' }} /></>}</> : 'none today'}</div>}
      </div>

      <div className="duo">
        <div className="card compact pressable" onClick={() => (weights.length ? setTab('weight') : openWeightEditor())}>
          <h3>Weight</h3>
          {lastW ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{fmtWeight(lastW.grams)} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>{fmtShortDay(lastW.day)}</span></div>
              <div className="muted small">{lastW !== birthW ? `${fmtPct(pctChange(lastW.grams, birthW.grams))} from birth` : 'birth weight'}</div>
              {weights.length > 1 && <WeightChart weights={weights} width={150} height={30} compact />}
            </>
          ) : (
            <div className="muted small">Add the birth weight to start ›</div>
          )}
        </div>
        <div className="card compact pressable" onClick={() => setTab('appointments')}>
          <h3>Next appt</h3>
          {nextAppt ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.15, textWrap: 'balance' }}>{fmtWhen(nextAppt.at, now)}</div>
              <div className="ellipsis" style={{ fontSize: 16, fontWeight: 600 }}>{nextAppt.location || nextAppt.title}</div>
              {nextAppt.location && <div className="small ellipsis" style={{ fontWeight: 600 }}>{nextAppt.title}</div>}
              {timerRows <= 2 && nextAppt.at - now < 24 * 3_600_000 && <div className="muted small ellipsis">{nextAppt.at > now ? `in ${fmtDur(nextAppt.at - now)}` : `started ${fmtDur(now - nextAppt.at)} ago`}</div>}
            </>
          ) : (
            <div className="muted small">None scheduled ›</div>
          )}
        </div>
      </div>
    </div>
  );
}
