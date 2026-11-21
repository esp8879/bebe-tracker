import { useEffect, useState } from 'react';
import { isNightAt } from './lib/timers';
import { useNow } from './hooks';

/**
 * Settings that belong to this screen, not the household: an iPad on the nightstand can stay awake and dim
 * at night without changing anything on the phones. Kept in localStorage.
 */
export interface DeviceSettings {
  keepAwake: boolean;
  dim: { enabled: boolean; start: string; end: string; level: 'dim' | 'dimmer' };
}
const KEY = 'bebe.device';
const DEFAULTS: DeviceSettings = { keepAwake: false, dim: { enabled: false, start: '21:00', end: '07:00', level: 'dim' } };

function read(): DeviceSettings {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return { ...DEFAULTS, ...v, dim: { ...DEFAULTS.dim, ...(v.dim ?? {}) } }; } catch { return DEFAULTS; }
}
export function saveDevice(patch: Partial<DeviceSettings>) {
  const next = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  window.dispatchEvent(new Event('bebe:device'));
}
export function useDevice(): DeviceSettings {
  const [s, setS] = useState(read);
  useEffect(() => { const on = () => setS(read()); window.addEventListener('bebe:device', on); return () => window.removeEventListener('bebe:device', on); }, []);
  return s;
}

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/** Holds a screen wake lock while the app is visible; the browser drops it when hidden, so take it again on return. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !wakeLockSupported()) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const take = async () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      try { lock = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen'); } catch { /* denied or unsupported */ }
    };
    void take();
    document.addEventListener('visibilitychange', take);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', take); void lock?.release().catch(() => {}); };
  }, [on]);
}

/** The sky behind the app follows this device's clock. */
export function skyAt(ms: number): 'dawn' | 'day' | 'golden' | 'dusk' | 'night' {
  const h = new Date(ms).getHours();
  return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'golden' : h >= 19 && h < 21 ? 'dusk' : 'night';
}

/** Mounted once at the app root: keeps the screen awake, sets the sky for the time of day, and lays the night dimmer over everything when it's time. */
export function DeviceEffects() {
  const d = useDevice();
  const now = useNow(30_000);
  useWakeLock(d.keepAwake);
  const dimNow = d.dim.enabled && isNightAt(now, d.dim);
  useEffect(() => { document.documentElement.classList.toggle('dimmed', dimNow); }, [dimNow]);
  const sky = skyAt(now);
  useEffect(() => { document.documentElement.dataset.sky = sky; }, [sky]);
  return (
    <>
      <div className="sky" aria-hidden="true" />
      {dimNow && <div className={`night-dim ${d.dim.level}`} aria-hidden="true" />}
    </>
  );
}
