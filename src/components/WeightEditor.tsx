import { useState } from 'react';
import { useStore } from '../data/store';
import { useUI } from '../ui';
import { WEIGHT_SOURCES, type Weight, type WeightSource } from '../types';
import { Sheet, Chips, Field } from './common';
import { toDatetimeLocal, parseNYLocal } from '../lib/time';
import { gramsToLbOz, lbOzToGrams, weightUnit } from '../lib/units';

export function WeightEditor({ weight }: { weight?: Weight }) {
  const { addWeight, updateWeight, removeWeight, restoreWeight, weights } = useStore();
  const { closeWeightEditor, toast } = useUI();
  const isFirst = !weight && weights.length === 0;
  const init = weight ? gramsToLbOz(weight.grams) : null;
  const [lb, setLb] = useState(init ? String(init.lb) : '');
  const [oz, setOz] = useState(init ? String(init.oz) : '');
  const [grams, setGrams] = useState<number | undefined>(weight?.grams);
  const [source, setSource] = useState<WeightSource>(weight?.source ?? (isFirst ? 'hospital' : 'pediatrician'));
  const [at, setAt] = useState<number>(weight?.at ?? Date.now());
  const [notes, setNotes] = useState(weight?.notes ?? '');

  const fromLbOz = (l: string, o: string) => { setLb(l); setOz(o); setGrams(l === '' && o === '' ? undefined : lbOzToGrams(+l || 0, +o || 0)); };
  const fromGrams = (v: string) => {
    if (v === '') { setGrams(undefined); setLb(''); setOz(''); return; }
    const g = +v; setGrams(g); const x = gramsToLbOz(g); setLb(String(x.lb)); setOz(String(x.oz));
  };
  const canSave = grams != null && grams > 0;
  const save = () => {
    if (!canSave) return;
    const data = { grams: grams!, source, at, notes: notes.trim() || undefined };
    if (weight) void updateWeight(weight.id, data); else void addWeight(data);
    closeWeightEditor();
  };
  const del = () => {
    if (!weight) return;
    void removeWeight(weight.id);
    toast('Weight deleted', () => { void restoreWeight(weight.id); });
    closeWeightEditor();
  };

  return (
    <Sheet title={weight ? 'Edit weight' : isFirst ? 'Birth weight' : 'Add weight'} onClose={closeWeightEditor}>
      {isFirst && <div className="muted small">The first weight is the birth weight. Every later weigh-in is compared against it.</div>}
      {weightUnit() === 'g' ? (
        <>
          <Field label="Grams"><input type="number" inputMode="numeric" placeholder="e.g. 3290" value={grams ?? ''} onChange={(e) => fromGrams(e.target.value)} autoFocus /></Field>
          <Field label="or pounds and ounces">
            <div className="inline">
              <input type="number" inputMode="numeric" placeholder="lb" value={lb} onChange={(e) => fromLbOz(e.target.value, oz)} />
              <input type="number" inputMode="decimal" step="0.1" placeholder="oz" value={oz} onChange={(e) => fromLbOz(lb, e.target.value)} />
            </div>
          </Field>
        </>
      ) : (
        <>
          <Field label="Pounds and ounces">
            <div className="inline">
              <input type="number" inputMode="numeric" placeholder="lb" value={lb} onChange={(e) => fromLbOz(e.target.value, oz)} autoFocus />
              <input type="number" inputMode="decimal" step="0.1" placeholder="oz" value={oz} onChange={(e) => fromLbOz(lb, e.target.value)} />
            </div>
          </Field>
          <Field label="or grams"><input type="number" inputMode="numeric" placeholder="e.g. 3290" value={grams ?? ''} onChange={(e) => fromGrams(e.target.value)} /></Field>
        </>
      )}
      <Field label="Measured by"><Chips options={WEIGHT_SOURCES} value={source} onChange={setSource} /></Field>
      <Field label="When">
        <input type="datetime-local" value={toDatetimeLocal(at)} max={toDatetimeLocal(Date.now())} onChange={(e) => { const ms = parseNYLocal(e.target.value); if (!isNaN(ms)) setAt(ms); }} />
      </Field>
      <Field label="Notes (optional)"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. with clothes on" /></Field>
      <div className="actions">
        {weight && <button type="button" className="btn danger" onClick={del}>Delete</button>}
        <button type="button" className="btn primary" disabled={!canSave} onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}
