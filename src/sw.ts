import { registerSW } from 'virtual:pwa-register';

/** True once a new build is installed and waiting, in case it happened before the UI mounted. */
export let updateReady = false;

// Last touch, key or scroll anywhere: an untouched screen (an iPad on the nightstand) updates itself.
let lastTouch = Date.now();
for (const e of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) window.addEventListener(e, () => { lastTouch = Date.now(); }, { capture: true, passive: true });
const IDLE_MS = 2 * 60_000;

/** Reload into the waiting build if nobody is using the screen: no touches for two minutes and no sheet open. */
function updateIfIdle() {
  if (!updateReady) return;
  const busy = document.querySelector('.sheet, .overlay, .docviewer') && !document.querySelector('.clock-mode');
  if (!busy && Date.now() - lastTouch >= IDLE_MS) void applyUpdate(true);
}

/** Registers the service worker and announces new builds via a window event; call applyUpdate(true) to reload into it. */
export const applyUpdate = registerSW({
  onNeedRefresh() { updateReady = true; window.dispatchEvent(new CustomEvent('bebe:update')); updateIfIdle(); },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    // Check for a new build every 15 minutes and whenever the app comes back to the foreground.
    setInterval(() => void reg.update(), 15 * 60 * 1000);
    setInterval(updateIfIdle, 30_000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update(); });
  },
});
