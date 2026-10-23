import { registerSW } from 'virtual:pwa-register';

/** True once a new build is installed and waiting, in case it happened before the UI mounted. */
export let updateReady = false;

/** Registers the service worker and announces new builds via a window event; call applyUpdate(true) to reload into it. */
export const applyUpdate = registerSW({
  onNeedRefresh() { updateReady = true; window.dispatchEvent(new CustomEvent('bebe:update')); },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    // Check for a new build hourly and whenever the app comes back to the foreground.
    setInterval(() => void reg.update(), 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update(); });
  },
});
