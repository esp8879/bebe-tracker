import { useEffect, useState, type ReactNode } from 'react';
import { fmtTime, dayOf, toDatetimeLocal, parseNYLocal, fmtDayRelative } from '../lib/time';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="handle" />
        <div className="row"><h2>{title}</h2><button className="btn ghost" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </>
  );
}

export interface ChipOption<T extends string> { value: T; label: string; swatch?: string }
export function Chips<T extends string>({ options, value, onChange, big, fill }: { options: ChipOption<T>[]; value?: T | null; onChange: (v: T) => void; big?: boolean; fill?: boolean }) {
  return (
    <div className={`chips${fill ? ' fill' : ''}`}>
      {options.map((o) => (
        <button key={o.value} type="button" className={`chip${big ? ' big' : ''}${value === o.value ? ' on' : ''}`} onClick={() => onChange(o.value)}>
          {o.swatch && <span className="swatch" style={{ background: o.swatch }} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => <button key={o.value} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

/** Number with quick-pick chips and a ±step stepper. */
export function NumberPick({ label, value, onChange, presets, step, unit, min = 0 }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; presets: number[]; step: number; unit: string; min?: number;
}) {
  return (
    <Field label={label}>
      <div className="chips-center"><Chips options={presets.map((p) => ({ value: String(p), label: `${p} ${unit}` }))} value={value != null ? String(value) : null} onChange={(v) => onChange(+v)} /></div>
      <div className="stepper">
        <button type="button" className="btn" onClick={() => onChange(Math.max(min, Math.round(((value ?? 0) - step) * 10) / 10))}>−</button>
        <input type="number" inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'} step={step} value={value ?? ''} placeholder={unit} onChange={(e) => onChange(e.target.value === '' ? undefined : +e.target.value)} />
        <button type="button" className="btn" onClick={() => onChange(Math.round(((value ?? 0) + step) * 10) / 10)}>+</button>
      </div>
    </Field>
  );
}

/** Time picker that defaults to now, with ±5 min nudges and a full picker. */
export function TimeField({ value, onChange, label = 'Time' }: { value: number; onChange: (ms: number) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const now = Date.now();
  const isNow = Math.abs(now - value) < 60_000;
  const today = dayOf(now);
  const day = dayOf(value);
  const text = isNow ? 'Now' : `${fmtTime(value)}${day !== today ? ` · ${fmtDayRelative(day, today)}` : ''}`;
  return (
    <Field label={label}>
      <div className="stepper">
        <button type="button" className="btn" onClick={() => onChange(value - 5 * 60_000)}>−5</button>
        <button type="button" className="btn grow" onClick={() => setOpen((o) => !o)}>{text}</button>
        <button type="button" className="btn" onClick={() => onChange(Math.min(now, value + 5 * 60_000))}>+5</button>
      </div>
      {open && (
        <div className="inline">
          <input type="datetime-local" value={toDatetimeLocal(value)} max={toDatetimeLocal(now)} onChange={(e) => { const ms = parseNYLocal(e.target.value); if (!isNaN(ms)) onChange(ms); }} />
          <button type="button" className="btn" onClick={() => { onChange(Date.now()); setOpen(false); }}>Now</button>
        </div>
      )}
    </Field>
  );
}

export function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Field label="Notes (optional)"><input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Anything worth remembering" /></Field>;
}
