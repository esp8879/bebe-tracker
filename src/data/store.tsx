import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  collection, doc, onSnapshot, orderBy, query, limit, where, getDocs, setDoc, updateDoc, writeBatch, runTransaction, disableNetwork, enableNetwork, type DocumentData,
} from 'firebase/firestore';
import { db, PROJECT_ID } from '../firebase';
import { getWho, setWhoLocal, SEED_KEY } from '../household';
import { DEFAULT_SETTINGS, ENTRY_TYPES, type Entry, type Settings, type Who, type Appointment, type Weight } from '../types';
import { dayOf, setTimezone, deviceTimezone } from '../lib/time';
import { setUnits } from '../lib/units';

type NewEntry = Omit<Entry, 'id' | 'day' | 'created_at' | 'updated_at' | 'logged_by' | 'deleted_at'>;
export type NewAppointment = Omit<Appointment, 'id' | 'day' | 'created_at' | 'updated_at' | 'deleted_at'>;
export type NewWeight = Omit<Weight, 'id' | 'day' | 'created_at' | 'updated_at' | 'deleted_at'>;

export interface Store {
  hid: string;
  /** The /demo household: in memory only, nothing is saved. */
  demo: boolean;
  who: Who | null;
  setWho: (w: Who) => void;
  entries: Entry[];
  settings: Settings;
  settingsLoaded: boolean;
  /** A local write has waited more than ~2 s for the server. */
  pending: boolean;
  /** …and more than ~15 s: probably a stale connection or no signal. */
  stuck: boolean;
  online: boolean;
  /**
   * 'checking': opened after 20+ minutes away and the server hasn't confirmed yet, so Today shimmers its numbers.
   * 'cached': the server didn't answer within 4 s, so Today shows the saved data with an "as of" badge.
   */
  freshness: 'fresh' | 'checking' | 'cached';
  /** When the server last confirmed the entries (persisted per device). */
  syncedAt: number | null;
  add: (e: NewEntry) => Promise<string>;
  update: (id: string, patch: Partial<Entry>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  appointments: Appointment[];
  addAppt: (a: NewAppointment) => Promise<string>;
  updateAppt: (id: string, patch: Partial<Appointment>) => Promise<void>;
  removeAppt: (id: string) => Promise<void>;
  restoreAppt: (id: string) => Promise<void>;
  /** Active weights, oldest first. */
  weights: Weight[];
  addWeight: (w: NewWeight) => Promise<string>;
  updateWeight: (id: string, patch: Partial<Weight>) => Promise<void>;
  removeWeight: (id: string) => Promise<void>;
  restoreWeight: (id: string) => Promise<void>;
  /** Entries older than the live window are fetched on demand. */
  olderLoaded: boolean;
  /** Fetches entries older than the live window (once) and resolves with them; `entries` includes them afterwards. */
  loadOlder: () => Promise<Entry[]>;
  /** Permanently deletes every document in this household and forgets it on this device. */
  deleteHousehold: () => Promise<void>;
}

export const StoreCtx = createContext<Store | null>(null);
const Ctx = StoreCtx;
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
};

const STALE_AFTER = 20 * 60_000;
const lsNum = (k: string) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const lsSet = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* ignore */ } };

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function StoreProvider({ hid, children }: { hid: string; children: ReactNode }) {
  const [who, setWhoState] = useState<Who | null>(getWho);
  const [recentEntries, setRecentEntries] = useState<Entry[]>([]);
  const [olderEntries, setOlderEntries] = useState<Entry[]>([]);
  const [olderLoaded, setOlderLoaded] = useState(false);
  const [tzVersion, setTzVersion] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allWeights, setAllWeights] = useState<Weight[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [pendingRaw, setPendingRaw] = useState(false);
  const [pending, setPending] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  // Freshness: after 20+ minutes away the saved copy may be hours old, so hold the numbers until the server confirms.
  const [checking, setChecking] = useState(() => Date.now() - lsNum('bebe.lastSeen') > STALE_AFTER);
  const [cachedOnly, setCachedOnly] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(() => lsNum('bebe.syncedAt') || null);
  useEffect(() => {
    if (!checking) return;
    const t = window.setTimeout(() => { setChecking(false); setCachedOnly(true); }, 4000);
    return () => window.clearTimeout(t);
  }, [checking]);
  useEffect(() => {
    const seen = () => { if (document.visibilityState === 'visible') lsSet('bebe.lastSeen', Date.now()); };
    seen();
    const id = window.setInterval(seen, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const seededRef = useRef(false);

  const entriesCol = useMemo(() => collection(db, 'households', hid, 'entries'), [hid]);
  const settingsDoc = useMemo(() => doc(db, 'households', hid, 'settings', 'main'), [hid]);
  const apptsCol = useMemo(() => collection(db, 'households', hid, 'appointments'), [hid]);
  const weightsCol = useMemo(() => collection(db, 'households', hid, 'weights'), [hid]);
  const historyCol = useMemo(() => collection(db, 'households', hid, 'settings_history'), [hid]);

  // Debounce the badge: ignore sub-2s round trips; flag anything past 15s.
  useEffect(() => {
    if (!pendingRaw) { setPending(false); setStuck(false); return; }
    const t1 = window.setTimeout(() => setPending(true), 2000);
    const t2 = window.setTimeout(() => setStuck(true), 15000);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [pendingRaw]);

  // iOS freezes home-screen apps in the background and the Firestore stream goes stale.
  // On return after a long hide, bounce the network so it reconnects immediately.
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = async () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); lsSet('bebe.lastSeen', hiddenAt); return; }
      if (hiddenAt && Date.now() - hiddenAt > STALE_AFTER) setChecking(true);
      lsSet('bebe.lastSeen', Date.now());
      if (hiddenAt && Date.now() - hiddenAt > 10_000) {
        try { await disableNetwork(db); await enableNetwork(db); } catch { /* ignore */ }
      }
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    // Back online: reconnect the stream right away rather than waiting for Firestore's own retry.
    const on = () => { setOnline(true); void disableNetwork(db).then(() => enableNetwork(db)).catch(() => {}); }, off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Bumping this tears down and re-creates every listener: used when a listener errors out (Firestore ends a
  // listener for good on some errors) and when the watchdog finds this screen behind the server.
  const [listenGen, setListenGen] = useState(0);
  const relisten = useCallback(() => { window.setTimeout(() => setListenGen((g) => g + 1), 5_000); }, []);
  // Live window: the last 30 days. Older days load on demand (Summary → Show older days).
  const windowStart = useMemo(() => Date.now() - 30 * 86_400_000, []);
  useEffect(() => {
    const q = query(entriesCol, where('at', '>=', windowStart), orderBy('at', 'desc'), limit(5000));
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setRecentEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Entry).filter((e) => ENTRY_TYPES.includes(e.type)));
      setPendingRaw(snap.metadata.hasPendingWrites);
      if (!snap.metadata.fromCache) { const t = Date.now(); setChecking(false); setCachedOnly(false); setSyncedAt(t); lsSet('bebe.syncedAt', t); }
    }, (err) => { console.error('entries listener', err); relisten(); });
  }, [entriesCol, windowStart, listenGen, relisten]);

  // Watchdog for screens that never leave the app (an iPad on the nightstand): the visibility bounce above never
  // runs there, and a live stream can die silently (Wi-Fi blip, router timeout). Every 90 s, ask the server for the
  // most recently changed entry; if this screen hasn't got that change yet, reconnect. One small read per check.
  const recentRef = useRef(recentEntries);
  recentRef.current = recentEntries;
  useEffect(() => {
    // Nothing here awaits the SDK: on 2026-11-22 the iPad stayed stale until killed, most likely because a
    // reconnect call hung and wedged the old await chain. Now each round is independent; behind on two rounds
    // in a row (about a minute apart) means reload, which is what fixes it by hand.
    let busy = false, behindSince = 0;
    const behind = (id: string, updatedAt: number) => {
      const mine = recentRef.current.find((e) => e.id === id);
      return !mine || (mine.updated_at ?? 0) < updatedAt;
    };
    const check = async () => {
      if (busy || document.visibilityState !== 'visible' || !navigator.onLine) return;
      busy = true;
      try {
        // Asked over plain HTTPS, not through the SDK: the SDK's own server reads ride the same stream we're checking.
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 15_000);
        const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/households/${hid}:runQuery`, {
          method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'entries' }], orderBy: [{ field: { fieldPath: 'updated_at' }, direction: 'DESCENDING' }], limit: 1 } }),
        }).finally(() => clearTimeout(timer));
        if (!res.ok) return;
        lsSet('bebe.watchdogAt', Date.now());
        const doc0 = ((await res.json()) as { document?: { name: string; fields?: Record<string, { integerValue?: string; doubleValue?: number }> } }[])[0]?.document;
        const num = (k: string) => Number(doc0?.fields?.[k]?.integerValue ?? doc0?.fields?.[k]?.doubleValue ?? 0);
        // An edit to an entry outside the live window doesn't count.
        if (!doc0 || num('at') < windowStart || !behind(doc0.name.split('/').pop()!, num('updated_at'))) { behindSince = 0; return; }
        if (!behindSince) {
          behindSince = Date.now();
          console.warn('entries stream looked stale; reconnecting');
          lsSet('bebe.watchdogFixedAt', Date.now());
          void disableNetwork(db).then(() => enableNetwork(db)).catch(() => {});
          setListenGen((g) => g + 1);
          window.setTimeout(() => void check(), 30_000);
          return;
        }
        if (Date.now() - behindSince < 25_000) return;
        if (document.querySelector('.sheet, .overlay') && !document.querySelector('.clock-mode')) return; // someone is mid-entry: next round
        console.warn('still stale after reconnecting; reloading');
        lsSet('bebe.watchdogReloadAt', Date.now());
        window.location.reload();
      } catch { /* offline or blocked: try again next round */ } finally { busy = false; }
    };
    const id = window.setInterval(() => void check(), 60_000);
    return () => window.clearInterval(id);
  }, [hid, windowStart]);

  const olderInFlight = useRef<Promise<Entry[]> | null>(null);
  const loadOlder = useCallback(async () => {
    if (olderLoaded) return olderEntries;
    if (!olderInFlight.current) {
      olderInFlight.current = getDocs(query(entriesCol, where('at', '<', windowStart), orderBy('at', 'desc'), limit(10000)))
        .then((snap) => {
          const older = snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Entry).filter((e) => ENTRY_TYPES.includes(e.type));
          setOlderEntries(older);
          setOlderLoaded(true);
          return older;
        })
        .finally(() => { olderInFlight.current = null; });
    }
    return olderInFlight.current;
  }, [entriesCol, windowStart, olderLoaded, olderEntries]);
  // Day is recomputed on read so a timezone change re-buckets history consistently.
  const entries = useMemo(() => { void tzVersion; return [...recentEntries, ...olderEntries].map((e) => ({ ...e, day: dayOf(e.at) })); }, [recentEntries, olderEntries, tzVersion]);

  useEffect(() => {
    const q = query(apptsCol, orderBy('at', 'asc'), limit(500));
    return onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Appointment));
    }, (err) => { console.error('appointments listener', err); relisten(); });
  }, [apptsCol, listenGen, relisten]);

  useEffect(() => {
    const q = query(weightsCol, orderBy('at', 'asc'), limit(500));
    return onSnapshot(q, (snap) => {
      setAllWeights(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as Weight));
    }, (err) => { console.error('weights listener', err); relisten(); });
  }, [weightsCol, listenGen, relisten]);
  const weights = useMemo(() => allWeights.filter((w) => !w.deleted_at), [allWeights]);

  useEffect(() => {
    return onSnapshot(settingsDoc, { includeMetadataChanges: true }, async (snap) => {
      if (snap.exists()) {
        const s = { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<Settings>) };
        setTimezone(s.tz ?? 'America/New_York');
        setUnits(s.units);
        setTzVersion((v) => v + 1);
        setSettings(s);
        setSettingsLoaded(true);
      } else if (!snap.metadata.fromCache && !seededRef.current) {
        // Default settings are written only by the device that just created this household, and only if the
        // document truly doesn't exist. On 2026-11-17 a phone got a "doesn't exist" snapshot for a household
        // with two months of settings and overwrote them with defaults; never again.
        let mine = false;
        try { mine = localStorage.getItem(SEED_KEY) === hid; } catch { /* ignore */ }
        if (!mine) return;
        seededRef.current = true;
        try {
          await runTransaction(db, async (tx) => {
            const cur = await tx.get(settingsDoc);
            if (!cur.exists()) tx.set(settingsDoc, { ...DEFAULT_SETTINGS, tz: deviceTimezone(), marked_awake: false });
          });
          try { localStorage.removeItem(SEED_KEY); } catch { /* ignore */ }
        } catch (e) { seededRef.current = false; console.error('seed settings', e); }
      }
    }, (err) => { console.error('settings listener', err); relisten(); });
  }, [settingsDoc, entriesCol, hid, listenGen, relisten]);

  const setWho = useCallback((w: Who) => { setWhoLocal(w); setWhoState(w); }, []);

  const add = useCallback(async (e: NewEntry) => {
    const id = newId();
    const now = Date.now();
    const data = { ...e, day: dayOf(e.at), created_at: now, updated_at: now, logged_by: who ?? 'other', deleted_at: null };
    void setDoc(doc(entriesCol, id), data); // not awaited: resolves only when the server acks, but the local cache applies instantly
    return id;
  }, [entriesCol, who]);

  const update = useCallback(async (id: string, patch: Partial<Entry>) => {
    const p: Record<string, unknown> = { ...patch, updated_at: Date.now() };
    if (typeof patch.at === 'number') p.day = dayOf(patch.at);
    void updateDoc(doc(entriesCol, id), p);
  }, [entriesCol]);

  const remove = useCallback(async (id: string) => { void updateDoc(doc(entriesCol, id), { deleted_at: Date.now(), updated_at: Date.now() }); }, [entriesCol]);
  const restore = useCallback(async (id: string) => { void updateDoc(doc(entriesCol, id), { deleted_at: null, updated_at: Date.now() }); }, [entriesCol]);

  const addAppt = useCallback(async (a: NewAppointment) => {
    const id = newId();
    const now = Date.now();
    void setDoc(doc(apptsCol, id), { ...a, day: dayOf(a.at), created_at: now, updated_at: now, deleted_at: null });
    return id;
  }, [apptsCol]);
  const updateAppt = useCallback(async (id: string, patch: Partial<Appointment>) => {
    const p: Record<string, unknown> = { ...patch, updated_at: Date.now() };
    if (typeof patch.at === 'number') p.day = dayOf(patch.at);
    void updateDoc(doc(apptsCol, id), p);
  }, [apptsCol]);
  const removeAppt = useCallback(async (id: string) => { void updateDoc(doc(apptsCol, id), { deleted_at: Date.now(), updated_at: Date.now() }); }, [apptsCol]);
  const restoreAppt = useCallback(async (id: string) => { void updateDoc(doc(apptsCol, id), { deleted_at: null, updated_at: Date.now() }); }, [apptsCol]);

  const addWeight = useCallback(async (w: NewWeight) => {
    const id = newId();
    const now = Date.now();
    void setDoc(doc(weightsCol, id), { ...w, day: dayOf(w.at), created_at: now, updated_at: now, deleted_at: null });
    return id;
  }, [weightsCol]);
  const updateWeight = useCallback(async (id: string, patch: Partial<Weight>) => {
    const p: Record<string, unknown> = { ...patch, updated_at: Date.now() };
    if (typeof patch.at === 'number') p.day = dayOf(patch.at);
    void updateDoc(doc(weightsCol, id), p);
  }, [weightsCol]);
  const removeWeight = useCallback(async (id: string) => { void updateDoc(doc(weightsCol, id), { deleted_at: Date.now(), updated_at: Date.now() }); }, [weightsCol]);
  const restoreWeight = useCallback(async (id: string) => { void updateDoc(doc(weightsCol, id), { deleted_at: null, updated_at: Date.now() }); }, [weightsCol]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const settingsLoadedRef = useRef(settingsLoaded);
  settingsLoadedRef.current = settingsLoaded;
  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    // Write the full document (no merge) so removed med intervals really disappear.
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    // Before the real settings have loaded, settingsRef is still the defaults: merge just the change,
    // never write a whole document of defaults over the household's settings.
    if (!settingsLoadedRef.current) { void setDoc(settingsDoc, patch, { merge: true }); return; }
    // Keep the version being replaced, so any settings change can be undone exactly (settings_history/{time}).
    const at = Date.now();
    void setDoc(doc(historyCol, String(at)), { saved_at: at, by: who ?? 'other', previous: settingsRef.current, changed: Object.keys(patch) });
    void setDoc(settingsDoc, next);
  }, [settingsDoc, historyCol, who]);

  const deleteHousehold = useCallback(async () => {
    const cols = [entriesCol, weightsCol, apptsCol, historyCol];
    for (const col of cols) {
      for (;;) {
        const snap = await getDocs(query(col, limit(400)));
        if (snap.empty) break;
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    const last = writeBatch(db);
    last.delete(settingsDoc);
    await last.commit();
    try { localStorage.removeItem('bebe.hid'); localStorage.removeItem('bebe.who'); } catch { /* ignore */ }
    location.href = '/';
  }, [entriesCol, weightsCol, apptsCol, historyCol, settingsDoc]);

  const value = useMemo<Store>(() => ({
    hid, demo: false, who, setWho, entries, settings, settingsLoaded, pending, stuck, online, freshness: checking ? 'checking' : cachedOnly ? 'cached' : 'fresh', syncedAt, add, update, remove, restore, saveSettings,
    appointments, addAppt, updateAppt, removeAppt, restoreAppt,
    weights, addWeight, updateWeight, removeWeight, restoreWeight, olderLoaded, loadOlder, deleteHousehold,
  }), [hid, who, setWho, entries, settings, settingsLoaded, pending, stuck, online, checking, cachedOnly, syncedAt, add, update, remove, restore, saveSettings, appointments, addAppt, updateAppt, removeAppt, restoreAppt, weights, addWeight, updateWeight, removeWeight, restoreWeight, olderLoaded, loadOlder, deleteHousehold]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
