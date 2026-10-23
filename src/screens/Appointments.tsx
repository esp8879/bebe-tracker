import { useMemo } from 'react';
import { useStore } from '../data/store';
import { useUI } from '../ui';
import { useNow } from '../hooks';
import { fmtDateTime, fmtRelative } from '../lib/time';
import type { Appointment } from '../types';
import { Icon } from '../components/Icon';

function ApptRow({ a, now }: { a: Appointment; now: number }) {
  const { openApptEditor } = useUI();
  return (
    <button className="entry" onClick={() => openApptEditor(a)}>
      <span className="ico"><Icon name="appointments" /></span>
      <span className="desc">
        <div><b>{a.location || a.title}</b></div>
        {a.location && <div className="small">{a.title}</div>}
        <div className="muted small">{fmtDateTime(a.at)} · {fmtRelative(a.at, now)}</div>
      </span>
    </button>
  );
}

export function Appointments() {
  const { appointments } = useStore();
  const { openApptEditor } = useUI();
  const now = useNow(60_000);
  const { upcoming, past } = useMemo(() => {
    const live = appointments.filter((a) => !a.deleted_at);
    const cutoff = now - 2 * 3_600_000; // keep an appointment "upcoming" for 2 h after it starts
    return {
      upcoming: live.filter((a) => a.at >= cutoff).sort((a, b) => a.at - b.at),
      past: live.filter((a) => a.at < cutoff).sort((a, b) => b.at - a.at),
    };
  }, [appointments, now]);

  return (
    <div className="screen">
      <div className="row">
        <h1>Appointments</h1>
        <button className="btn primary" onClick={() => openApptEditor()}>+ Add</button>
      </div>
      <div>
        <div className="day-head"><h2>Upcoming</h2><span className="muted small">{upcoming.length}</span></div>
        {upcoming.length === 0 ? (
          <div className="card muted">No upcoming appointments.</div>
        ) : (
          <div className="card list" style={{ gap: 0, padding: '0 8px' }}>{upcoming.map((a) => <ApptRow key={a.id} a={a} now={now} />)}</div>
        )}
      </div>
      {past.length > 0 && (
        <div>
          <div className="day-head"><h2 className="muted">Past</h2><span className="muted small">{past.length}</span></div>
          <div className="card list" style={{ gap: 0, padding: '0 8px', opacity: .7 }}>{past.map((a) => <ApptRow key={a.id} a={a} now={now} />)}</div>
        </div>
      )}
    </div>
  );
}
