import type { ReactNode } from 'react';

/**
 * The app's icon family: 24px grid, 1.75px rounded stroke, no interior detail, drawn from the
 * bottle in the app mark. Tab icons take `filled` for their active state. Colour comes from
 * `currentColor`; wrap in a `.ico` span with a `t-<type>` class for the per-type tint.
 */
export type IconName = 'feed' | 'diaper' | 'pump' | 'mom_med' | 'today' | 'summary' | 'weight' | 'appointments' | 'settings';

const GLYPHS: Record<IconName, (filled: boolean) => ReactNode> = {
  feed: () => (
    <>
      <path d="M10.25 5.5V4.5a1.75 1.75 0 0 1 3.5 0v1" />
      <rect x="8.75" y="5.5" width="6.5" height="2.75" rx="1" />
      <path d="M8.25 8.25h7.5v9.5a3 3 0 0 1-3 3h-1.5a3 3 0 0 1-3-3z" />
      <path d="M8.25 12h2.25M8.25 15h2.25" />
    </>
  ),
  diaper: () => (
    <>
      <path d="M4.5 6.5h15v3.5c-3 0-5 3-5 6.5 0 1.5-1 3-2.5 3S9.5 18 9.5 16.5c0-3.5-2-6.5-5-6.5z" />
      <path d="M4.5 9.5h15" />
    </>
  ),
  pump: () => (
    <>
      <path d="M6 4h12l-3.5 7h-5z" />
      <path d="M9 11.5h6v6.25a2.75 2.75 0 0 1-2.75 2.75h-.5A2.75 2.75 0 0 1 9 17.75z" />
    </>
  ),
  mom_med: () => (
    <g transform="rotate(-40 12 12)">
      <path d="M12 8.5H7a3.5 3.5 0 0 0 0 7h5z" fill="currentColor" stroke="none" opacity=".35" />
      <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" />
      <path d="M12 8.5v7" />
    </g>
  ),
  today: (filled) => (
    <>
      <path d="M3.5 17.5h17" />
      {filled ? <path d="M6.75 17.5a5.25 5.25 0 0 1 10.5 0z" fill="currentColor" /> : <path d="M6.75 17.5a5.25 5.25 0 0 1 10.5 0" />}
      <path d="M12 6V3.75M5.4 9.9 3.8 8.3M18.6 9.9l1.6-1.6" />
    </>
  ),
  summary: (filled) => (
    <>
      <circle cx="5" cy="7" r={filled ? 1.4 : 1.1} fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r={filled ? 1.4 : 1.1} fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r={filled ? 1.4 : 1.1} fill="currentColor" stroke="none" />
      <path d="M9 7h11M9 12h8M9 17h10" strokeWidth={filled ? 2.25 : undefined} />
    </>
  ),
  weight: (filled) => (
    <>
      <path d="M3.5 7.5h17c0 3.2-3.8 5.25-8.5 5.25S3.5 10.7 3.5 7.5z" fill={filled ? 'currentColor' : undefined} />
      <path d="M12 12.75v2.75" />
      <path d="M6.5 15.5h11a1.5 1.5 0 0 1 1.5 1.5v3H5v-3a1.5 1.5 0 0 1 1.5-1.5z" fill={filled ? 'currentColor' : undefined} />
    </>
  ),
  appointments: (filled) => (
    <>
      {filled && <path d="M3.5 8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v2h-17z" fill="currentColor" />}
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d={filled ? 'M8 3v4M16 3v4' : 'M3.5 10h17M8 3v4M16 3v4'} />
      <circle cx="12" cy="15.25" r={filled ? 1.75 : 1.5} fill="currentColor" stroke="none" />
    </>
  ),
  settings: (filled) => (
    <>
      <path d="M4 7.5h2.5M11.5 7.5H20M4 16.5h8.5M17.5 16.5H20" />
      <circle cx="9" cy="7.5" r="2.5" fill={filled ? 'currentColor' : undefined} />
      <circle cx="15" cy="16.5" r="2.5" fill={filled ? 'currentColor' : undefined} />
    </>
  ),
};

export function Icon({ name, size = 24, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {GLYPHS[name](filled)}
    </svg>
  );
}

/** The app mark: the bottle inside the pink ring, as drawn on the home screen. */
export function Mark({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="110" fill="#12131a" />
      <circle cx="256" cy="256" r="172" fill="none" stroke="#ff9ac2" strokeWidth="36" />
      <g transform="translate(124 124) scale(11)" fill="none" stroke="#ff9ac2" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.25 5.5V4.5a1.75 1.75 0 0 1 3.5 0v1" />
        <rect x="8.75" y="5.5" width="6.5" height="2.75" rx="1" />
        <path d="M8.25 8.25h7.5v9.5a3 3 0 0 1-3 3h-1.5a3 3 0 0 1-3-3z" />
        <path d="M8.25 12h2.25M8.25 15h2.25" />
      </g>
    </svg>
  );
}
