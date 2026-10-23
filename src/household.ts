import type { Who } from './types';
import { DEMO_HID, DEMO_PATH } from './data/demo';

const HID_KEY = 'bebe.hid';
const WHO_KEY = 'bebe.who';
const HID_CHARS = '[A-Za-z0-9_-]{24,}';
const PATH_RE = new RegExp(`^/h/(${HID_CHARS})`);
const HASH_RE = new RegExp(`[#&?]h=(${HID_CHARS})`);

export function generateHid(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode etc. */ }
}

/** Extract a household id from any share link, path or legacy hash form. */
export function hidFromUrl(url: string): string | null {
  try {
    const u = new URL(url, location.origin);
    return PATH_RE.exec(u.pathname)?.[1] ?? HASH_RE.exec(u.hash)?.[1] ?? null;
  } catch { return null; }
}

export const householdPath = (hid: string) => `/h/${hid}`;
export const shareUrl = (hid: string) => `${location.origin}${householdPath(hid)}`;

/**
 * The household id is the shared secret and lives in the URL PATH (/h/<id>) so that
 * "Add to Home Screen" on iOS, which keeps the page URL, always launches into the
 * right household even though a home-screen app has its own separate storage.
 * Priority: URL, then this device's saved id. Returns null if neither exists —
 * the app then asks rather than silently creating an empty household.
 */
export function resolveHid(): string | null {
  // The demo never replaces this device's saved household.
  if (location.pathname === DEMO_PATH) return DEMO_HID;
  const fromUrl = hidFromUrl(location.href);
  const hid = fromUrl ?? safeGet(HID_KEY);
  if (!hid || hid.length < 24) return null;
  safeSet(HID_KEY, hid);
  if (location.pathname !== householdPath(hid)) history.replaceState(null, '', householdPath(hid));
  return hid;
}

export function createHousehold(): string {
  const hid = generateHid();
  safeSet(HID_KEY, hid);
  history.replaceState(null, '', householdPath(hid));
  return hid;
}

/** Switch this device to another household's link and reload so all listeners restart. */
export function joinHousehold(link: string): boolean {
  const hid = hidFromUrl(link.trim());
  if (!hid) return false;
  safeSet(HID_KEY, hid);
  location.href = householdPath(hid);
  return true;
}

export function getWho(): Who | null {
  const w = safeGet(WHO_KEY);
  return w === 'dad' || w === 'mom' || w === 'other' ? w : null;
}
export const setWhoLocal = (w: Who) => safeSet(WHO_KEY, w);
