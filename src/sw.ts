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

// Nightly fresh start for screens that never close (an iPad on the nightstand): a page left open for days can slowly
// get sluggish or flaky. Between 3 and 5 AM on this device's clock, once the page has been open 6+ hours and nobody has
// touched it for 10 minutes, reload (into a waiting build if there is one). Never while someone is mid-entry.
const loadedAt = Date.now();
setInterval(() => {
  const h = new Date().getHours();
  if (h < 3 || h >= 5 || document.visibilityState !== 'visible') return;
  if (Date.now() - loadedAt < 6 * 3_600_000 || Date.now() - lastTouch < 10 * 60_000) return;
  if (document.querySelector('.sheet, .overlay, .docviewer') && !document.querySelector('.clock-mode')) return;
  if (updateReady) void applyUpdate(true); else window.location.reload();
}, 5 * 60_000);
