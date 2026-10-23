import { useMemo, useRef, useState } from 'react';
import type { Weight } from '../types';
import { fmtShortDay, fmtDateTime, dayOf } from '../lib/time';
import { fmtWeight, fmtWeightAlt, fmtPct, pctChange, G_PER_OZ, weightUnit } from '../lib/units';

interface Props { weights: Weight[]; width: number; height: number; compact?: boolean }

const tickLabel = (g: number) => { if (weightUnit() === 'g') return `${Math.round(g).toLocaleString()} g`; const oz = Math.round(g / G_PER_OZ); return `${Math.floor(oz / 16)} lb ${oz % 16} oz`; };

/** Single-series line of weight over time with the birth weight as a reference line. */
export function WeightChart({ weights, width, height, compact }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pad = compact ? { l: 5, r: 5, t: 6, b: 5 } : { l: 66, r: 18, t: 16, b: 26 };
  const birth = weights[0];

  const m = useMemo(() => {
    if (weights.length === 0) return null;
    const xs = weights.map((w) => w.at);
    const ys = weights.map((w) => w.grams);
    const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 86_400_000);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const span = Math.max(yMax - yMin, 200);
    const y0 = yMin - span * 0.25, y1 = yMax + span * 0.25;
    const sx = (t: number) => pad.l + ((t - x0) / (x1 - x0)) * (width - pad.l - pad.r);
    const sy = (g: number) => pad.t + (1 - (g - y0) / (y1 - y0)) * (height - pad.t - pad.b);
    const pts = weights.map((w) => ({ w, x: sx(w.at), y: sy(w.grams) }));
    // y ticks: clean quarter-pound steps
    // ~4 gridlines at clean ounce steps (1, 2, 4, 8 or 16 oz)
    const stepG = weightUnit() === 'g'
      ? ([50, 100, 200, 250, 500].find((s) => (y1 - y0) / s <= 4.5) ?? 500)
      : (([1, 2, 4, 8, 16].find((s) => (y1 - y0) / G_PER_OZ / s <= 4.5) ?? 16) * G_PER_OZ);
    const ticks: number[] = [];
    for (let g = Math.ceil(y0 / stepG) * stepG; g <= y1; g += stepG) ticks.push(g);
    // x ticks: first, last, and up to two in between by day
    const xt = [x0, x1];
    if (x1 - x0 > 3 * 86_400_000) { xt.splice(1, 0, x0 + (x1 - x0) / 2); }
    return { pts, sx, sy, ticks, xt, x0, x1 };
  }, [weights, width, height, pad.l, pad.r, pad.t, pad.b]);

  if (!m || !birth) return null;
  const path = m.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = m.pts[m.pts.length - 1];
  const hp = hover != null ? m.pts[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (compact) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < m.pts.length; i++) if (Math.abs(m.pts[i].x - x) < Math.abs(m.pts[best].x - x)) best = i;
    setHover(best);
  };

  return (
    <div className="wchart" style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block', maxWidth: '100%', touchAction: 'pan-y' }}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Weight over time">
        {!compact && m.ticks.map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={width - pad.r} y1={m.sy(g)} y2={m.sy(g)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 8} y={m.sy(g)} dy="0.35em" textAnchor="end" fontSize={11} fill="var(--muted)">{tickLabel(g)}</text>
          </g>
        ))}
        {/* birth weight reference */}
        <line x1={pad.l} x2={width - pad.r} y1={m.sy(birth.grams)} y2={m.sy(birth.grams)} stroke="var(--muted)" strokeWidth={1} strokeOpacity={0.6} />
        {!compact && <text x={width - pad.r} y={m.sy(birth.grams) - 5} textAnchor="end" fontSize={11} fill="var(--muted)">birth {fmtWeight(birth.grams)}</text>}
        {!compact && m.xt.map((t, i) => (
          <text key={i} x={m.sx(t)} y={height - 8} textAnchor={i === 0 ? 'start' : i === m.xt.length - 1 ? 'end' : 'middle'} fontSize={11} fill="var(--muted)">{fmtShortDay(dayOf(t))}</text>
        ))}
        <path d={path} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {m.pts.map((p, i) => (
          <circle key={p.w.id} cx={p.x} cy={p.y} r={compact ? (i === m.pts.length - 1 ? 3.5 : 2.5) : 4.5} fill="var(--chart)" stroke="var(--card)" strokeWidth={2} />
        ))}
        {hp && !compact && (
          <>
            <line x1={hp.x} x2={hp.x} y1={pad.t} y2={height - pad.b} stroke="var(--muted)" strokeWidth={1} strokeOpacity={0.5} />
            <circle cx={hp.x} cy={hp.y} r={6} fill="var(--chart)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
        {!compact && !hp && (
          <text x={last.x} y={last.y - 12} textAnchor={last.x > width * 0.7 ? 'end' : 'middle'} fontSize={12} fontWeight={700} fill="var(--text)">{fmtWeight(last.w.grams)}</text>
        )}
      </svg>
      {hp && !compact && (
        <div className="wtip" style={{ left: `${Math.min(Math.max((hp.x / width) * 100, 18), 82)}%` }}>
          <div><b>{fmtWeight(hp.w.grams)}</b> · {fmtWeightAlt(hp.w.grams)}</div>
          <div className="muted small">{fmtDateTime(hp.w.at)}{hp.w !== birth ? ` · ${fmtPct(pctChange(hp.w.grams, birth.grams))} vs birth` : ' · birth'}</div>
        </div>
      )}
    </div>
  );
}
