import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { summarize, activeEntries } from '../lib/summary';
import { ageDaysOnDay, parseNYLocal, fmtShortDay, dayOf, fmtDayRelative } from '../lib/time';
import { STOOL_COLORS, type EntryType } from '../types';
import { EntryRow } from '../components/EntryRow';
import { Chips, Seg } from '../components/common';
import { volValue, volLabel } from '../lib/units';

const FILTERS: { value: EntryType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'feed', label: 'Feeds' }, { value: 'diaper', label: 'Diapers' },
  { value: 'pump', label: 'Pumps' }, { value: 'mom_med', label: 'Meds' },
];

function DaysView() {
  const { entries, settings, olderLoaded, loadOlder } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const days = useMemo(() => summarize(entries), [entries]);
  const dob = parseNYLocal(settings.dob);
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-wrap" style={{ margin: 0, padding: 0 }}>
        <table className="summary">
          <thead>
            <tr>
              <th>Day</th><th>Age</th><th>Feeds</th><th>Breast</th><th>Bottle {volLabel()}</th><th>Formula {volLabel()}</th><th>BM {volLabel()}</th><th>Pumps</th><th>Pumped {volLabel()}</th><th>Diapers</th><th>Wet</th><th>Dirty</th><th>Stool</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && <tr><td colSpan={12} className="muted">Nothing logged yet.</td></tr>}
            {days.map((d) => {
              const stool = d.last_stool ? STOOL_COLORS.find((c) => c.value === d.last_stool) : undefined;
              return [
                <tr key={d.day} className="day" onClick={() => setOpen(open === d.day ? null : d.day)}>
                  <td>{fmtShortDay(d.day)}</td>
                  <td>{ageDaysOnDay(dob, d.day)}d</td>
                  <td>{d.bottles}</td>
                  <td>{d.breast || ""}</td>
                  <td>{d.bottle_ml ? volValue(d.bottle_ml) : '—'}</td>
                  <td>{d.formula_ml ? volValue(d.formula_ml) : '—'}</td>
                  <td>{d.breastmilk_bottle_ml ? volValue(d.breastmilk_bottle_ml) : '—'}</td>
                  <td>{d.pumps || '—'}</td>
                  <td>{d.pumped_ml ? volValue(d.pumped_ml) : '—'}</td>
                  <td>{d.diapers}</td>
                  <td>{d.wet}</td>
                  <td>{d.dirty}</td>
                  <td>{stool ? <span className="swatch" title={stool.label} style={{ background: stool.swatch }} /> : '—'}</td>
                </tr>,
                open === d.day && (
                  <tr key={`${d.day}-x`}><td className="expand" colSpan={12}>
                    <div className="list" style={{ padding: '0 8px', background: 'var(--bg)' }}>{d.entries.map((e) => <EntryRow key={e.id} e={e} />)}</div>
                  </td></tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      {!olderLoaded && <button className="btn ghost block" onClick={() => void loadOlder()}>Show days older than 30 days</button>}
    </div>
  );
}

function EntriesView() {
  const { entries } = useStore();
  const [filter, setFilter] = useState<EntryType | 'all'>('all');
  const today = dayOf(Date.now());
  const days = useMemo(() => {
    const list = activeEntries(entries).filter((e) => filter === 'all' || e.type === filter);
    const map = new Map<string, typeof list>();
    for (const e of list) { const arr = map.get(e.day) ?? []; arr.push(e); map.set(e.day, arr); }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries, filter]);
  return (
    <>
      <Chips options={FILTERS} value={filter} onChange={setFilter} fill />
      {days.length === 0 && <div className="card muted">Nothing logged yet.</div>}
      {days.map(([day, list]) => (
        <div key={day}>
          <div className="day-head"><h2>{fmtDayRelative(day, today)}</h2><span className="muted small">{list.length} entries</span></div>
          <div className="card list" style={{ gap: 0, padding: '0 8px' }}>
            {list.map((e) => <EntryRow key={e.id} e={e} />)}
          </div>
        </div>
      ))}
    </>
  );
}

export function Summary() {
  const [mode, setMode] = useState<'days' | 'entries'>('days');
  return (
    <div className="screen">
      <h1>Summary</h1>
      <Seg options={[{ value: 'days', label: 'By day' }, { value: 'entries', label: 'All entries' }]} value={mode} onChange={setMode} />
      {mode === 'days' ? <DaysView /> : <EntriesView />}
    </div>
  );
}
