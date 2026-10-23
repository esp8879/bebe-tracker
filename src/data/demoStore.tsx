import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StoreCtx, type Store, type NewAppointment, type NewWeight } from './store';
import { demoData, DEMO_HID } from './demo';
import type { Entry, Settings, Who, Appointment, Weight } from '../types';
import { dayOf, setTimezone } from '../lib/time';
import { setUnits } from '../lib/units';

const id = () => `demo-${Math.random().toString(36).slice(2)}`;

/** Same Store as the real one, held in React state for this visit only. Never touches Firestore or localStorage. */
export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const seed = useMemo(() => demoData(), []);
  const [who, setWho] = useState<Who | null>('dad');
  const [entries, setEntries] = useState<Entry[]>(seed.entries);
  const [settings, setSettings] = useState<Settings>(() => { setUnits(seed.settings.units); return seed.settings; });
  const [appointments, setAppointments] = useState<Appointment[]>(seed.appointments);
  const [allWeights, setAllWeights] = useState<Weight[]>(seed.weights);
  const weights = useMemo(() => allWeights.filter((w) => !w.deleted_at).sort((a, b) => a.at - b.at), [allWeights]);

  const patchIn = <T extends { id: string; at: number }>(set: React.Dispatch<React.SetStateAction<T[]>>) =>
    (pid: string, patch: Partial<T>) => set((list) => list.map((x) => (x.id === pid ? { ...x, ...patch, ...(typeof patch.at === 'number' ? { day: dayOf(patch.at) } : {}), updated_at: Date.now() } : x)));

  const add = useCallback(async (e: Parameters<Store['add']>[0]) => {
    const nid = id(), now = Date.now();
    setEntries((l) => [...l, { ...e, id: nid, day: dayOf(e.at), created_at: now, updated_at: now, logged_by: who ?? 'other', deleted_at: null } as Entry]);
    return nid;
  }, [who]);
  const update = useCallback(async (pid: string, patch: Partial<Entry>) => patchIn<Entry>(setEntries)(pid, patch), []);
  const remove = useCallback(async (pid: string) => patchIn<Entry>(setEntries)(pid, { deleted_at: Date.now() }), []);
  const restore = useCallback(async (pid: string) => patchIn<Entry>(setEntries)(pid, { deleted_at: null }), []);

  const addAppt = useCallback(async (a: NewAppointment) => {
    const nid = id(), now = Date.now();
    setAppointments((l) => [...l, { ...a, id: nid, day: dayOf(a.at), created_at: now, updated_at: now, deleted_at: null }]);
    return nid;
  }, []);
  const updateAppt = useCallback(async (pid: string, patch: Partial<Appointment>) => patchIn<Appointment>(setAppointments)(pid, patch), []);
  const removeAppt = useCallback(async (pid: string) => patchIn<Appointment>(setAppointments)(pid, { deleted_at: Date.now() }), []);
  const restoreAppt = useCallback(async (pid: string) => patchIn<Appointment>(setAppointments)(pid, { deleted_at: null }), []);

  const addWeight = useCallback(async (w: NewWeight) => {
    const nid = id(), now = Date.now();
    setAllWeights((l) => [...l, { ...w, id: nid, day: dayOf(w.at), created_at: now, updated_at: now, deleted_at: null }]);
    return nid;
  }, []);
  const updateWeight = useCallback(async (pid: string, patch: Partial<Weight>) => patchIn<Weight>(setAllWeights)(pid, patch), []);
  const removeWeight = useCallback(async (pid: string) => patchIn<Weight>(setAllWeights)(pid, { deleted_at: Date.now() }), []);
  const restoreWeight = useCallback(async (pid: string) => patchIn<Weight>(setAllWeights)(pid, { deleted_at: null }), []);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.tz) setTimezone(patch.tz);
      if (patch.units) setUnits(patch.units);
      return next;
    });
  }, []);

  const day = useMemo(() => entries.map((e) => ({ ...e, day: dayOf(e.at) })), [entries, settings.tz]);

  const value = useMemo<Store>(() => ({
    hid: DEMO_HID, demo: true, who, setWho, entries: day, settings, settingsLoaded: true, pending: false, stuck: false, online: true,
    add, update, remove, restore, saveSettings,
    appointments, addAppt, updateAppt, removeAppt, restoreAppt,
    weights, addWeight, updateWeight, removeWeight, restoreWeight,
    olderLoaded: true, loadOlder: async () => [], deleteHousehold: async () => { location.href = '/'; },
  }), [who, day, settings, add, update, remove, restore, saveSettings, appointments, addAppt, updateAppt, removeAppt, restoreAppt, weights, addWeight, updateWeight, removeWeight, restoreWeight]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
