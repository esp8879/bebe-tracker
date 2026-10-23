export type Who = 'dad' | 'mom' | 'other';
export type FeedKind = 'breast' | 'bottle_formula' | 'bottle_breastmilk' | 'bottle_mixed';
export type Side = 'left' | 'right' | 'both';
export type Latch = 'good' | 'ok' | 'poor';
export type StoolColor = 'black' | 'dark_green' | 'green' | 'yellow' | 'light_brown' | 'brown' | 'other';
export type StoolAmount = 'smear' | 'small' | 'medium' | 'large';
export type KnownMed = 'tylenol' | 'motrin' | 'oxycodone' | 'lovenox' | 'stool_softener' | 'prenatal' | 'other';
/** Known meds by key, or a custom med by its display name (from settings.custom_meds). */
export type Med = KnownMed | (string & {});

/** All timestamps are epoch milliseconds (UTC). `day` is the America/New_York calendar day. */
export interface Base {
  id: string;
  at: number;
  day: string;
  created_at: number;
  updated_at: number;
  logged_by: Who;
  notes?: string;
  deleted_at?: number | null;
}

export interface Feed extends Base {
  type: 'feed';
  kind: FeedKind;
  side?: Side;
  duration_min?: number;
  volume_ml?: number;
  latch_quality?: Latch;
}
export interface Diaper extends Base {
  type: 'diaper';
  wet: boolean;
  dirty: boolean;
  stool_color?: StoolColor;
  stool_amount?: StoolAmount;
}
export interface Pump extends Base {
  type: 'pump';
  duration_min?: number;
  volume_ml?: number;
  left_ml?: number;
  right_ml?: number;
}
export interface MomMed extends Base {
  type: 'mom_med';
  med: Med;
  dose_text?: string;
}
export type Entry = Feed | Diaper | Pump | MomMed;
export type EntryType = Entry['type'];
export const ENTRY_TYPES: EntryType[] = ['feed', 'diaper', 'pump', 'mom_med'];

export interface Settings {
  baby_name: string;
  /** ISO local wall-clock time of birth in America/New_York, e.g. 2026-01-15T14:32 */
  dob: string;
  feed_interval_min: number;
  med_intervals: Partial<Record<Med, number>>;
  /** Alternate Tylenol and Motrin: minimum minutes between any two doses of the pair. Off until set. */
  rotation: { enabled: boolean; stagger_min?: number };
  users: { dad: string; mom: string; other?: string };
  /** IANA timezone used for day boundaries and display. Missing = America/New_York (households created before this existed). */
  tz?: string;
  units?: { volume: 'ml' | 'oz'; weight: 'lb' | 'g' };
  /** Extra med names beyond the built-in list. */
  custom_meds?: string[];
  /** Meds tracking on Today and in the dock. Missing = on. History is always kept. */
  meds_enabled?: boolean;
  /** Today screen: project the next pump and dose from intervals, or just show when each last happened. */
  today_mode?: 'countdown' | 'last';
  /** Minutes between pumps; blank = the pump row shows the last pump only. */
  pump_interval_min?: number;
  pin?: string;
  pump_target_per_day?: number;
  reference_text?: string;
}

const todayLocal = (() => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const g = (t: string) => p.find((x) => x.type === t)?.value; return `${g('year')}-${g('month')}-${g('day')}T00:00`; })();

export const DEFAULT_SETTINGS: Settings = {
  baby_name: 'Baby',
  dob: todayLocal,
  feed_interval_min: 180,
  med_intervals: {},
  rotation: { enabled: false },
  users: { dad: 'Dad', mom: 'Mom', other: 'Caregiver' },
  units: { volume: 'ml', weight: 'lb' },
  custom_meds: [],
  today_mode: 'countdown',
};

export const FEED_KINDS: { value: FeedKind; label: string; short: string }[] = [
  { value: 'breast', label: 'Breast', short: 'Breast' },
  { value: 'bottle_formula', label: 'Formula', short: 'Formula' },
  { value: 'bottle_breastmilk', label: 'Bottle BM', short: 'Bottle BM' },
  { value: 'bottle_mixed', label: 'Mixed', short: 'Mixed' },
];
export const MEDS: { value: KnownMed; label: string }[] = [
  { value: 'tylenol', label: 'Tylenol' },
  { value: 'motrin', label: 'Ibuprofen' },
  { value: 'oxycodone', label: 'Oxycodone' },
  { value: 'lovenox', label: 'Lovenox' },
  { value: 'stool_softener', label: 'MiraLax' },
  { value: 'prenatal', label: 'Prenatal' },
  { value: 'other', label: 'Other' },
];
export const STOOL_COLORS: { value: StoolColor; label: string; swatch: string }[] = [
  { value: 'black', label: 'Black', swatch: '#1a1a1a' },
  { value: 'dark_green', label: 'Dark green', swatch: '#2f4f2f' },
  { value: 'green', label: 'Green', swatch: '#5b8c3a' },
  { value: 'yellow', label: 'Yellow', swatch: '#d9a52a' },
  { value: 'light_brown', label: 'Light brown', swatch: '#b5885a' },
  { value: 'brown', label: 'Brown', swatch: '#6b4423' },
];
export const STOOL_AMOUNTS: StoolAmount[] = ['smear', 'small', 'medium', 'large'];

export const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const medLabel = (m: Med) => MEDS.find((x) => x.value === m)?.label ?? m;
/** Built-in meds plus the household's custom ones. */
export const allMeds = (custom: string[] = []): { value: Med; label: string }[] => [...MEDS.filter((m) => m.value !== 'other'), ...custom.map((c) => ({ value: c, label: c })), MEDS[MEDS.length - 1]];
export const feedKindLabel = (k: FeedKind) => FEED_KINDS.find((x) => x.value === k)?.label ?? label(k);

export type ApptKind = 'pediatrician' | 'ob' | 'imaging' | 'other';
export interface Appointment {
  id: string;
  kind: ApptKind;
  title: string;
  at: number;
  day: string;
  location?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number | null;
}
export const APPT_KINDS: { value: ApptKind; label: string }[] = [
  { value: 'pediatrician', label: 'Pediatrician' },
  { value: 'ob', label: 'OB' },
  { value: 'imaging', label: 'Imaging / scan' },
  { value: 'other', label: 'Other' },
];

export type WeightSource = 'pediatrician' | 'home' | 'hospital';
export interface Weight {
  id: string;
  at: number;
  day: string;
  grams: number;
  source: WeightSource;
  notes?: string;
  created_at: number;
  updated_at: number;
  deleted_at?: number | null;
}
export const WEIGHT_SOURCES: { value: WeightSource; label: string }[] = [
  { value: 'pediatrician', label: 'Pediatrician' },
  { value: 'home', label: 'Home scale' },
  { value: 'hospital', label: 'Hospital' },
];
