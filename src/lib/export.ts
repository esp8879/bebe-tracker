import type { Entry, Settings, Weight, Appointment } from '../types';
import { dayOf, fmtTime, toDatetimeLocal } from './time';
import { mlToOz } from './units';

const q = (v: unknown) => {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per entry, sparse columns, oldest first. */
export function entriesToCsv(entries: Entry[]): string {
  const cols = ['id', 'type', 'date', 'time', 'day', 'logged_by', 'feed_kind', 'side', 'duration_min', 'volume_ml', 'volume_oz', 'latch', 'wet', 'dirty', 'stool_color', 'stool_amount', 'med', 'dose_text', 'notes', 'deleted'];
  const rows = [...entries].sort((a, b) => a.at - b.at).map((e) => {
    const r: Record<string, unknown> = { id: e.id, type: e.type, date: toDatetimeLocal(e.at).slice(0, 10), time: fmtTime(e.at), day: dayOf(e.at), logged_by: e.logged_by, notes: e.notes, deleted: e.deleted_at ? 'yes' : '' };
    if (e.type === 'feed') Object.assign(r, { feed_kind: e.kind, side: e.side, duration_min: e.duration_min, volume_ml: e.volume_ml, volume_oz: e.volume_ml != null ? +mlToOz(e.volume_ml).toFixed(2) : undefined, latch: e.latch_quality });
    if (e.type === 'diaper') Object.assign(r, { wet: e.wet ? 'yes' : 'no', dirty: e.dirty ? 'yes' : 'no', stool_color: e.stool_color, stool_amount: e.stool_amount });
    if (e.type === 'pump') Object.assign(r, { duration_min: e.duration_min, volume_ml: e.volume_ml, volume_oz: e.volume_ml != null ? +mlToOz(e.volume_ml).toFixed(2) : undefined });
    if (e.type === 'mom_med') Object.assign(r, { med: e.med, dose_text: e.dose_text });
    return cols.map((c) => q(r[c])).join(',');
  });
  return [cols.join(','), ...rows].join('\n') + '\n';
}

export function backupJson(data: { settings: Settings; entries: Entry[]; weights: Weight[]; appointments: Appointment[] }): string {
  return JSON.stringify({ app: 'bébé tracker', format: 1, exported_at: new Date().toISOString(), ...data }, null, 2);
}

/** Share sheet with a real file where supported (iOS, Android), else a download; in an iOS home-screen app
 *  downloads go nowhere, so the last resort is the clipboard. Call this synchronously from a tap. */
export async function deliverFile(filename: string, text: string, mime: string): Promise<'shared' | 'downloaded' | 'copied'> {
  const file = new File([text], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; standalone?: boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: filename }); return 'shared'; }
    catch (e) { if ((e as DOMException).name === 'AbortError') throw e; /* not allowed or unsupported: fall through */ }
  }
  const standalone = nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (standalone && /iPhone|iPad/.test(navigator.userAgent) && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
