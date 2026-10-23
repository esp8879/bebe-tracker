import { useState } from 'react';
import { useStore } from '../data/store';
import { useUI } from '../ui';
import type { Appointment } from '../types';
import { Sheet, Field } from './common';
import { toDatetimeLocal, parseNYLocal } from '../lib/time';

function defaultAt(): number {
  // Next whole hour, at least an hour from now.
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

export function ApptEditor({ appt }: { appt?: Appointment }) {
  const { addAppt, updateAppt, removeAppt, restoreAppt } = useStore();
  const { closeApptEditor, toast } = useUI();
  const [title, setTitle] = useState(appt?.title ?? '');
  const [at, setAt] = useState<number>(appt?.at ?? defaultAt());
  const [location, setLocation] = useState(appt?.location ?? '');
  const [notes, setNotes] = useState(appt?.notes ?? '');

  const save = () => {
    const data = { kind: appt?.kind ?? ('other' as const), title: title.trim() || 'Appointment', at, location: location.trim() || undefined, notes: notes.trim() || undefined };
    if (appt) void updateAppt(appt.id, data); else void addAppt(data);
    closeApptEditor();
  };
  const del = () => {
    if (!appt) return;
    void removeAppt(appt.id);
    toast('Appointment deleted', () => { void restoreAppt(appt.id); });
    closeApptEditor();
  };

  return (
    <Sheet title={appt ? 'Edit appointment' : 'New appointment'} onClose={closeApptEditor}>
      <Field label="What"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weight check, Follow up, 2-week visit" /></Field>
      <Field label="Doctor or place"><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dr. Patel · Heights Pediatrics" /></Field>
      <Field label="When">
        <input type="datetime-local" value={toDatetimeLocal(at)} onChange={(e) => { const ms = parseNYLocal(e.target.value); if (!isNaN(ms)) setAt(ms); }} />
      </Field>
      <Field label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Questions to ask, what to bring…" /></Field>
      <div className="actions">
        {appt && <button type="button" className="btn danger" onClick={del}>Delete</button>}
        <button type="button" className="btn primary" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}
