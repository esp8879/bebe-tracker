import { useState } from 'react';
import { useStore } from '../data/store';
import { useUI, type EditorState } from '../ui';
import {
  FEED_KINDS, STOOL_COLORS, STOOL_AMOUNTS, label,
  type Feed, type Diaper, type Pump, type MomMed, type Entry,
  type FeedKind, type Side, type Latch, type StoolColor, type StoolAmount, type Med, type Sleep, type SleepHow, SLEEP_HOW,
} from '../types';
import { isNightSleepAt, DEFAULT_NIGHT_SLEEP } from '../lib/sleep';
import { fmtDur } from '../lib/time';
import { Sheet, Chips, Seg, Field, NumberPick, TimeField, NotesField } from './common';
import { volumeUnit, mlToOz, ozToMl } from '../lib/units';
import { allMeds } from '../types';

const LAST_KIND = 'bebe.lastFeedKind';

function useEditorBase<T extends Entry>(entry: T | undefined) {
  const store = useStore();
  const ui = useUI();
  const [at, setAt] = useState<number>(entry?.at ?? Date.now());
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const save = (data: Omit<T, keyof Entry> & { type: T['type'] }) => {
    const payload = { ...data, at, notes: notes.trim() || undefined } as unknown as Omit<T, 'id' | 'day' | 'created_at' | 'updated_at' | 'logged_by' | 'deleted_at'>;
    if (entry) void store.update(entry.id, payload as Partial<Entry>);
    else void store.add(payload as Parameters<typeof store.add>[0]);
    ui.closeEditor();
  };
  const del = () => { if (entry) { ui.deleteWithUndo(entry); ui.closeEditor(); } };
  return { at, setAt, notes, setNotes, save, del, editing: !!entry, close: ui.closeEditor };
}

/** Volume picker that stores mL but shows the household's preferred unit. */
function VolumePick({ label, value, onChange, presetsMl }: { label: string; value: number | undefined; onChange: (ml: number | undefined) => void; presetsMl: number[] }) {
  if (volumeUnit() === 'oz') {
    const shown = value == null ? undefined : Math.round(mlToOz(value) * 10) / 10;
    return <NumberPick label={label} value={shown} onChange={(oz) => onChange(oz == null ? undefined : Math.round(ozToMl(oz)))} presets={[0.5, 1, 1.5, 2, 2.5, 3]} step={0.5} unit="oz" />;
  }
  return <NumberPick label={label} value={value} onChange={onChange} presets={presetsMl} step={5} unit="mL" />;
}

function Actions({ onSave, onDelete, saveLabel = 'Save', disabled }: { onSave: () => void; onDelete?: () => void; saveLabel?: string; disabled?: boolean }) {
  return (
    <div className="actions">
      {onDelete && <button type="button" className="btn danger" onClick={onDelete}>Delete</button>}
      <button type="button" className="btn primary" disabled={disabled} onClick={onSave}>{saveLabel}</button>
    </div>
  );
}

export function FeedEditor({ entry, preset }: { entry?: Feed; preset?: { kind?: FeedKind } }) {
  const b = useEditorBase(entry);
  const [kind, setKind] = useState<FeedKind>(entry?.kind ?? preset?.kind ?? ((localStorage.getItem(LAST_KIND) as FeedKind | null) || 'bottle_formula'));
  const [side, setSide] = useState<Side | undefined>(entry?.side);
  const [duration, setDuration] = useState<number | undefined>(entry?.duration_min);
  const [volume, setVolume] = useState<number | undefined>(entry?.volume_ml);
  const [latch, setLatch] = useState<Latch | undefined>(entry?.latch_quality);
  const breast = kind === 'breast';
  const canSave = breast ? true : volume != null && volume > 0;
  const save = () => {
    try { localStorage.setItem(LAST_KIND, kind); } catch { /* ignore */ }
    b.save(breast
      ? { type: 'feed', kind, side, duration_min: duration, latch_quality: latch, volume_ml: undefined }
      : { type: 'feed', kind, volume_ml: volume, side: undefined, duration_min: undefined, latch_quality: undefined });
  };
  return (
    <Sheet title={b.editing ? 'Edit feed' : 'Feed'} onClose={b.close}>
      <Seg options={FEED_KINDS.map((k) => ({ value: k.value, label: k.short }))} value={kind} onChange={setKind} />
      {breast ? (
        <>
          <Field label="Side"><Chips big options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }]} value={side} onChange={setSide} /></Field>
          <NumberPick label="Duration" value={duration} onChange={setDuration} presets={[5, 10, 15, 20, 30]} step={5} unit="min" />
          <Field label="Latch (optional)"><Chips options={[{ value: 'good', label: 'Good' }, { value: 'ok', label: 'OK' }, { value: 'poor', label: 'Poor' }]} value={latch} onChange={setLatch} /></Field>
        </>
      ) : (
        <VolumePick label="Volume" value={volume} onChange={setVolume} presetsMl={[60, 75, 90, 100]} />
      )}
      <TimeField value={b.at} onChange={b.setAt} label="Started at" />
      <NotesField value={b.notes} onChange={b.setNotes} />
      <Actions onSave={save} onDelete={b.editing ? b.del : undefined} disabled={!canSave} />
    </Sheet>
  );
}

export function DiaperEditor({ entry }: { entry?: Diaper }) {
  const b = useEditorBase(entry);
  const [wet, setWet] = useState(entry?.wet ?? false);
  const [dirty, setDirty] = useState(entry?.dirty ?? false);
  const [color, setColor] = useState<StoolColor | undefined>(entry?.stool_color);
  const [amount, setAmount] = useState<StoolAmount | undefined>(entry?.stool_amount);
  const [step, setStep] = useState<'pick' | 'color'>(b.editing ? 'color' : 'pick');

  const commit = (w: boolean, d: boolean, c?: StoolColor, a?: StoolAmount) =>
    b.save({ type: 'diaper', wet: w, dirty: d, stool_color: d ? c : undefined, stool_amount: d ? a : undefined });

  // Create mode: Wet saves on tap (2 taps total). Dirty/Both asks for a color, and the color tap saves.
  const pick = (w: boolean, d: boolean) => {
    setWet(w); setDirty(d);
    if (!d) commit(w, d);
    else setStep('color');
  };

  return (
    <Sheet title={b.editing ? 'Edit diaper' : 'Diaper'} onClose={b.close}>
      <TimeField value={b.at} onChange={b.setAt} />
      {step === 'pick' ? (
        <div className="quick-grid">
          <button type="button" className="btn xl" onClick={() => pick(true, false)}>Wet</button>
          <button type="button" className="btn xl" onClick={() => pick(false, true)}>Dirty</button>
          <button type="button" className="btn xl" style={{ gridColumn: '1 / -1' }} onClick={() => pick(true, true)}>Both</button>
        </div>
      ) : (
        <>
          <Field label="What">
            <div className="chips">
              <button type="button" className={`chip big${wet ? ' on' : ''}`} onClick={() => setWet(!wet)}>Wet</button>
              <button type="button" className={`chip big${dirty ? ' on' : ''}`} onClick={() => setDirty(!dirty)}>Dirty</button>
            </div>
          </Field>
          {dirty && (
            <>
              <Field label={b.editing ? 'Stool color' : 'Stool color — tap to save'}>
                <Chips big options={STOOL_COLORS} value={color} onChange={(c) => { setColor(c); if (!b.editing) commit(wet, dirty, c, amount); }} />
              </Field>
              <Field label="Amount (optional)"><Chips options={STOOL_AMOUNTS.map((a) => ({ value: a, label: label(a) }))} value={amount} onChange={setAmount} /></Field>
            </>
          )}
        </>
      )}
      {(b.editing || step === 'color') && <NotesField value={b.notes} onChange={b.setNotes} />}
      {(b.editing || step === 'color') && (
        <Actions onSave={() => commit(wet, dirty, color, amount)} onDelete={b.editing ? b.del : undefined} disabled={!wet && !dirty} saveLabel={b.editing ? 'Save' : 'Save without color'} />
      )}
    </Sheet>
  );
}

export function PumpEditor({ entry }: { entry?: Pump }) {
  const b = useEditorBase(entry);
  const [duration, setDuration] = useState<number | undefined>(entry?.duration_min);
  const [volume, setVolume] = useState<number | undefined>(entry?.volume_ml);
  return (
    <Sheet title={b.editing ? 'Edit pump' : 'Pump'} onClose={b.close}>
      <VolumePick label="Total volume" value={volume} onChange={setVolume} presetsMl={[5, 10, 20, 30, 45, 60]} />
      <NumberPick label="Duration" value={duration} onChange={setDuration} presets={[10, 15, 20, 30]} step={5} unit="min" />
      <TimeField value={b.at} onChange={b.setAt} label="Started at" />
      <NotesField value={b.notes} onChange={b.setNotes} />
      <Actions onSave={() => b.save({ type: 'pump', duration_min: duration, volume_ml: volume })} onDelete={b.editing ? b.del : undefined} disabled={volume == null && duration == null} />
    </Sheet>
  );
}

export function MedEditor({ entry, preset }: { entry?: MomMed; preset?: { med?: Med } }) {
  const b = useEditorBase(entry);
  const { settings } = useStore();
  const [med, setMed] = useState<Med | undefined>(entry?.med ?? preset?.med);
  const [dose, setDose] = useState(entry?.dose_text ?? '');
  return (
    <Sheet title={b.editing ? 'Edit dose' : 'Meds'} onClose={b.close}>
      <Field label="Medication"><Chips big options={allMeds(settings.custom_meds)} value={med} onChange={setMed} /></Field>
      <Field label="Dose as written on the bottle (optional)"><input type="text" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 650 mg" /></Field>
      <TimeField value={b.at} onChange={b.setAt} label="Taken at" />
      <NotesField value={b.notes} onChange={b.setNotes} />
      <Actions onSave={() => med && b.save({ type: 'mom_med', med, dose_text: dose.trim() || undefined })} onDelete={b.editing ? b.del : undefined} disabled={!med} saveLabel="Log dose" />
    </Sheet>
  );
}

export function SleepEditor({ entry }: { entry?: Sleep }) {
  const b = useEditorBase(entry);
  const { settings } = useStore();
  const window = settings.night_sleep ?? DEFAULT_NIGHT_SLEEP;
  const [nightTouched, setNightTouched] = useState(!!entry);
  const [nightPick, setNight] = useState<boolean>(entry?.night ?? isNightSleepAt(b.at, window));
  const night = nightTouched ? nightPick : isNightSleepAt(b.at, window);
  const [how, setHow] = useState<SleepHow[]>(entry?.how ?? []);
  const [endAt, setEndAt] = useState<number | null>(entry?.end_at ?? null);
  const toggleHow = (h: SleepHow) => setHow((cur) => (cur.includes(h) ? cur.filter((x) => x !== h) : [...cur.filter((x) => x !== 'own'), h]));
  const bad = endAt != null && endAt <= b.at;
  const save = (end = endAt) => b.save({ type: 'sleep', night, how: how.length ? how : undefined, end_at: end });
  return (
    <Sheet title={b.editing ? (entry?.end_at == null ? 'Asleep' : 'Edit sleep') : 'Sleep'} onClose={b.close}>
      <TimeField value={b.at} onChange={b.setAt} label="Fell asleep" />
      <Seg options={[{ value: 'nap', label: 'Nap' }, { value: 'night', label: 'Night' }]} value={night ? 'night' : 'nap'} onChange={(v) => { setNightTouched(true); setNight(v === 'night'); }} />
      <Field label="Help falling asleep — none means on her own">
        <div className="chips">
          {SLEEP_HOW.map((o) => <button key={o.value} type="button" className={`chip${how.includes(o.value) ? ' on' : ''}`} aria-pressed={how.includes(o.value)} onClick={() => toggleHow(o.value)}>{o.label}</button>)}
        </div>
      </Field>
      {endAt != null ? (
        <>
          <TimeField value={endAt} onChange={setEndAt} label="Woke up" />
          {bad ? <div className="red small">Woke up has to be after she fell asleep.</div> : <div className="muted small">Slept {fmtDur(endAt - b.at)}</div>}
        </>
      ) : b.editing ? (
        <button type="button" className="btn block" onClick={() => save(Date.now())}>Woke up now</button>
      ) : (
        <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start', minHeight: 0, padding: 0 }} onClick={() => setEndAt(Date.now())}>Already awake? Add when she woke</button>
      )}
      {b.editing && <NotesField value={b.notes} onChange={b.setNotes} />}
      <Actions onSave={() => save()} onDelete={b.editing ? b.del : undefined} disabled={bad} saveLabel={b.editing ? 'Save' : endAt != null ? 'Save sleep' : 'Start sleep'} />
    </Sheet>
  );
}

export function Editor({ state }: { state: EditorState }) {
  const { type, entry, preset } = state;
  switch (type) {
    case 'feed': return <FeedEditor entry={entry as Feed | undefined} preset={preset} />;
    case 'diaper': return <DiaperEditor entry={entry as Diaper | undefined} />;
    case 'pump': return <PumpEditor entry={entry as Pump | undefined} />;
    case 'mom_med': return <MedEditor entry={entry as MomMed | undefined} preset={preset} />;
    case 'sleep': return <SleepEditor entry={entry as Sleep | undefined} />;
  }
}
