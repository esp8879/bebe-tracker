import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Entry, EntryType, Med, FeedKind, Appointment, Weight } from './types';
import { useStore } from './data/store';

export interface EditorPreset { med?: Med; kind?: FeedKind }
export interface EditorState { type: EntryType; entry?: Entry; preset?: EditorPreset }

interface UI {
  editor: EditorState | null;
  apptEditor: { appt?: Appointment } | null;
  weightEditor: { weight?: Weight } | null;
  openWeightEditor: (weight?: Weight) => void;
  closeWeightEditor: () => void;
  openApptEditor: (appt?: Appointment) => void;
  closeApptEditor: () => void;
  openEditor: (type: EntryType, opts?: { entry?: Entry; preset?: EditorPreset }) => void;
  closeEditor: () => void;
  toast: (msg: string, undo?: () => void) => void;
  /** Soft-delete with a 10 s undo toast. */
  deleteWithUndo: (entry: Entry) => void;
}

const Ctx = createContext<UI | null>(null);
export const useUI = () => {
  const u = useContext(Ctx);
  if (!u) throw new Error('UIProvider missing');
  return u;
};

interface ToastState { msg: string; undo?: () => void; key: number }

export function UIProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [apptEditor, setApptEditor] = useState<{ appt?: Appointment } | null>(null);
  const [weightEditor, setWeightEditor] = useState<{ weight?: Weight } | null>(null);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);

  const toast = useCallback((msg: string, undo?: () => void) => {
    if (timer.current) window.clearTimeout(timer.current);
    setToastState({ msg, undo, key: Date.now() });
    // Undo toasts stay long enough to change your mind; plain notices get out of the way.
    timer.current = window.setTimeout(() => setToastState(null), undo ? 10_000 : 2_500);
  }, []);

  const openEditor = useCallback((type: EntryType, opts?: { entry?: Entry; preset?: EditorPreset }) => setEditor({ type, ...opts }), []);
  const closeEditor = useCallback(() => setEditor(null), []);
  const openApptEditor = useCallback((appt?: Appointment) => setApptEditor({ appt }), []);
  const closeApptEditor = useCallback(() => setApptEditor(null), []);
  const openWeightEditor = useCallback((weight?: Weight) => setWeightEditor({ weight }), []);
  const closeWeightEditor = useCallback(() => setWeightEditor(null), []);

  const deleteWithUndo = useCallback((entry: Entry) => {
    void store.remove(entry.id);
    toast('Entry deleted', () => { void store.restore(entry.id); });
  }, [store, toast]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <Ctx.Provider value={{ editor, apptEditor, openApptEditor, closeApptEditor, weightEditor, openWeightEditor, closeWeightEditor, openEditor, closeEditor, toast, deleteWithUndo }}>
      {children}
      {toastState && (
        <div className="toast" key={toastState.key} role="status" onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) setToastState(null); }}>
          <span className="grow">{toastState.msg}</span>
          {toastState.undo && <button onClick={() => { toastState.undo?.(); setToastState(null); }}>Undo</button>}
        </div>
      )}
    </Ctx.Provider>
  );
}
