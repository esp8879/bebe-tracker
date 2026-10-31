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
/**
 * Help she had falling asleep; none = on her own. Feeding isn't offered (she always goes down after a feed);
 * 'feeding' and 'own' remain only so sleeps logged before 2026-10-28 still read correctly.
 */
export type SleepHow = 'held' | 'rocking' | 'pacifier' | 'bjorn' | 'feeding' | 'own';
/** Offered: Held, Carrier, Pacifier. 'bjorn' is the carrier (its stored key predates the rename); 'rocking' is legacy (counts as held). */
export const SLEEP_HOW: { value: SleepHow; label: string }[] = [
  { value: 'held', label: 'Held' }, { value: 'bjorn', label: 'Carrier' }, { value: 'pacifier', label: 'Pacifier' },
];
export const SLEEP_HOW_LABEL: Record<SleepHow, string> = { held: 'held', rocking: 'rocked', pacifier: 'pacifier', bjorn: 'carrier', feeding: 'fed', own: 'on her own' };
export type SleepPlace = 'contact' | 'bassinet' | 'stroller';
export const SLEEP_PLACES: { value: SleepPlace; label: string }[] = [
  { value: 'contact', label: 'Contact' }, { value: 'bassinet', label: 'Bassinet' }, { value: 'stroller', label: 'Stroller' },
];
/** Where she slept, as a timeline: the first stop starts at `at`, later stops are moves ("bassinet → contact"). */
export interface SleepStop { at: number; place: SleepPlace }
/** A sleep runs from `at` (fell asleep) to `end_at` (woke up); `end_at` is null while she's asleep. */
export interface Sleep extends Base {
  type: 'sleep';
  end_at?: number | null;
  /** Night sleep vs nap. Pre-picked from the night window when logged; can be flipped. */
  night: boolean;
  how?: SleepHow[];
  places?: SleepStop[];
}
export type Entry = Feed | Diaper | Pump | MomMed | Sleep;
export type EntryType = Entry['type'];
export const ENTRY_TYPES: EntryType[] = ['feed', 'diaper', 'pump', 'mom_med', 'sleep'];

export interface Settings {
  baby_name: string;
  /** ISO local wall-clock time of birth in America/New_York, e.g. 2026-01-15T14:32 */
  dob: string;
  feed_interval_min: number;
  /** Optional night schedule: a feed that STARTS between `start` and `end` (household-local HH:MM, may wrap midnight) uses `interval_min` instead of `feed_interval_min`. */
  night_feeds?: { enabled: boolean; interval_min?: number; start: string; end: string };
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
  /** Diaper tracking on Today, in the dock and in the Summary table. Missing = on. History is always kept. */
  diapers_enabled?: boolean;
  /** Sleep tracking. Missing = on. */
  sleep_enabled?: boolean;
  /** The "Marked Awake" card when she wakes. Missing = on (households from before it existed); new households start with it off. */
  marked_awake?: boolean;
  /** A sleep that STARTS inside this household-local window counts as night sleep (may wrap midnight). Missing = 19:00–07:00. */
  night_sleep?: { start: string; end: string };
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
