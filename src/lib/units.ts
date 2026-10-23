export const ML_PER_OZ = 29.5735;
export const G_PER_OZ = 28.3495;

export type VolumeUnit = 'ml' | 'oz';
export type WeightUnit = 'lb' | 'g';
let VOL: VolumeUnit = 'ml';
let WT: WeightUnit = 'lb';
export function setUnits(u?: { volume?: VolumeUnit; weight?: WeightUnit }) { if (u?.volume) VOL = u.volume; if (u?.weight) WT = u.weight; }
export const volumeUnit = () => VOL;
export const weightUnit = () => WT;

export const mlToOz = (ml: number) => ml / ML_PER_OZ;
export const ozToMl = (oz: number) => oz * ML_PER_OZ;
const oz1 = (ml: number) => `${(Math.round(mlToOz(ml) * 10) / 10).toString()} oz`;

/** Primary unit first, the other in parentheses. */
export function fmtMl(ml: number | undefined | null, withSecondary = true): string {
  if (ml == null) return '—';
  const m = `${Math.round(ml)} mL`, o = oz1(ml);
  if (!withSecondary) return VOL === 'oz' ? o : m;
  return VOL === 'oz' ? `${o} (${m})` : `${m} (${o})`;
}
/** Number only, in the preferred volume unit (for table cells and tiles). */
export const volValue = (ml: number) => (VOL === 'oz' ? Math.round(mlToOz(ml) * 10) / 10 : Math.round(ml));
export const volLabel = () => (VOL === 'oz' ? 'oz' : 'mL');
/** The other unit as a secondary note, e.g. "5.6 oz" when primary is mL. */
export const volSecondary = (ml: number) => (VOL === 'oz' ? `${Math.round(ml)} mL` : oz1(ml));

export function gramsToLbOz(g: number): { lb: number; oz: number } {
  const totalOz = g / G_PER_OZ;
  const lb = Math.floor(totalOz / 16);
  const oz = Math.round((totalOz - lb * 16) * 10) / 10;
  return oz >= 16 ? { lb: lb + 1, oz: 0 } : { lb, oz };
}
export const lbOzToGrams = (lb: number, oz: number) => Math.round((lb * 16 + oz) * G_PER_OZ);
/** "7 lb 4 oz" */
export function fmtLbOz(g: number): string {
  const { lb, oz } = gramsToLbOz(g);
  return `${lb} lb ${Number.isInteger(oz) ? oz : oz.toFixed(1)} oz`;
}
export const fmtGrams = (g: number) => `${Math.round(g).toLocaleString()} g`;
/** Weight in the preferred unit. */
export const fmtWeight = (g: number) => (WT === 'g' ? fmtGrams(g) : fmtLbOz(g));
/** The other weight unit. */
export const fmtWeightAlt = (g: number) => (WT === 'g' ? fmtLbOz(g) : fmtGrams(g));
/** Percent change, one decimal. */
export const pctChange = (g: number, baseG: number) => Math.round(((g - baseG) / baseG) * 1000) / 10;
export const fmtPct = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p).toFixed(1)}%`;
export const fmtSignedG = (d: number) => (WT === 'g' ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(Math.round(d))} g` : `${d > 0 ? '+' : d < 0 ? '−' : ''}${(Math.abs(d) / G_PER_OZ).toFixed(1)} oz`);
