import { useEffect, useRef, useState } from 'react';
import { useStore } from '../data/store';
import { fmtDur, fmtTime, dayOf } from '../lib/time';
import { isNightAt } from '../lib/timers';
import { DEFAULT_NIGHT_SLEEP } from '../lib/sleep';
import type { Sleep, SleepPlace } from '../types';

export interface AwakeDetail { id: string; at: number; sleptMs: number; place: SleepPlace | null }

/** Fire after a sleep is ended with "Woke up". The card shows if the household has it on; otherwise the caller's toast covers it. */
export const announceAwake = (d: AwakeDetail) => window.dispatchEvent(new CustomEvent<AwakeDetail>('bebe:awake', { detail: d }));

const PLACE_LINE: Record<SleepPlace, string> = { bassinet: 'the bassinet', contact: 'the snuggle zone', stroller: 'the stroller' };
const LINES = (place: SleepPlace | null) => [
  'nightmares', 'Monty', place ? PLACE_LINE[place] : 'naptime', 'the sleep regression (for now)', 'the swaddle',
  'bedtime', 'the white noise machine', 'another nap (for now)',
];

function pickLine(place: SleepPlace | null): string {
  const lines = LINES(place);
  let last = -1;
  try { last = Number(localStorage.getItem('bebe.awakeLine') ?? -1); } catch { /* ignore */ }
  let i = Math.floor(Math.random() * lines.length);
  if (i === last) i = (i + 1) % lines.length;
  try { localStorage.setItem('bebe.awakeLine', String(i)); } catch { /* ignore */ }
  return lines[i];
}

/** The flag from the old "Marked Safe" check-in, redrawn: a pole with a ball and a blue pennant. */
function Flag() {
  return (
    <svg viewBox="0 0 64 80" width="56" height="70" aria-hidden="true">
      <circle cx="13" cy="7" r="4.5" fill="#fff" stroke="#1c1e21" strokeWidth="2" />
      <rect x="10.5" y="13" width="5" height="62" rx="2.5" transform="rotate(-6 13 44)" fill="#fff" stroke="#1c1e21" strokeWidth="2" />
      <path d="M19 16 L60 25 L22 46 Z" fill="#5b7bd5" stroke="#1c1e21" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** "Frankie is Marked Awake, and safe from Monty." Fades after a few seconds, closes on a tap, keeps an Undo. */
export function MarkedAwake() {
  const { settings, update } = useStore();
  const [card, setCard] = useState<(AwakeDetail & { line: string; dim: boolean }) | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<AwakeDetail>).detail;
      setCard({ ...d, line: pickLine(d.place), dim: isNightAt(d.at, settings.night_sleep ?? DEFAULT_NIGHT_SLEEP) });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCard(null), 4500);
    };
    window.addEventListener('bebe:awake', on);
    return () => { window.removeEventListener('bebe:awake', on); window.clearTimeout(timer.current); };
  }, [settings.night_sleep]);
  if (!card) return null;
  const close = () => { window.clearTimeout(timer.current); setCard(null); };
  const when = dayOf(card.at) === dayOf(Date.now()) ? `Today ${fmtTime(card.at)}` : fmtTime(card.at);
  return (
    <div className={`awake-scrim${card.dim ? ' dim' : ''}`} onClick={close} role="status" aria-live="polite">
      <div className="awake-card">
        <Flag />
        <div className="awake-title">{settings.baby_name} is Marked Awake</div>
        <div className="awake-line">and safe from {card.line}</div>
        <div className="awake-meta">{when} · slept {fmtDur(card.sleptMs)}</div>
        <button type="button" className="awake-undo" onClick={(e) => { e.stopPropagation(); void update(card.id, { end_at: null } as Partial<Sleep>); close(); }}>Undo</button>
      </div>
    </div>
  );
}
