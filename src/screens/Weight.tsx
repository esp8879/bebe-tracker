import { useStore } from '../data/store';
import { useUI } from '../ui';
import { WeightChart } from '../components/WeightChart';
import { fmtDateTime, ageDaysOnDay, parseNYLocal } from '../lib/time';
import { fmtWeight, fmtWeightAlt, fmtPct, pctChange, fmtSignedG } from '../lib/units';
import { WEIGHT_SOURCES } from '../types';
import { Icon } from '../components/Icon';

export function Weight() {
  const { weights, settings } = useStore();
  const { openWeightEditor } = useUI();
  const birth = weights[0];
  const dob = parseNYLocal(settings.dob);
  const list = [...weights].reverse();

  return (
    <div className="screen">
      <div className="row">
        <h1>Weight</h1>
        <button className="btn primary" onClick={() => openWeightEditor()}>{weights.length ? '+ Add' : '+ Birth weight'}</button>
      </div>
      {weights.length === 0 ? (
        <div className="card muted">Start with the birth weight from the hospital paperwork. Later weigh-ins show their change from it.</div>
      ) : (
        <>
          <div className="card" style={{ padding: '12px 8px 8px' }}>
            <WeightChart weights={weights} width={360} height={200} />
          </div>
          <div className="card list" style={{ gap: 0, padding: '0 8px' }}>
            {list.map((w, i) => {
              const prev = list[i + 1];
              const isBirth = w.id === birth!.id;
              return (
                <button key={w.id} className="entry" onClick={() => openWeightEditor(w)}>
                  <span className="ico"><Icon name="weight" /></span>
                  <span className="desc">
                    <div><b>{fmtWeight(w.grams)}</b> <span className="muted">· {fmtWeightAlt(w.grams)}</span></div>
                    <div className="muted small">{fmtDateTime(w.at)} · day {ageDaysOnDay(dob, w.day)} · {WEIGHT_SOURCES.find((s) => s.value === w.source)?.label ?? w.source}</div>
                    {w.notes && <div className="notes">{w.notes}</div>}
                  </span>
                  <span className="mono small" style={{ textAlign: 'right' }}>
                    {isBirth ? <span className="muted">birth</span> : (
                      <>
                        <div className={pctChange(w.grams, birth!.grams) < 0 ? 'amber' : 'green'}>{fmtPct(pctChange(w.grams, birth!.grams))}</div>
                        {prev && <div className="muted">{fmtSignedG(w.grams - prev.grams)}</div>}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="muted small">Percent is versus birth weight. The smaller number is the change from the previous weigh-in.</div>
        </>
      )}
    </div>
  );
}
