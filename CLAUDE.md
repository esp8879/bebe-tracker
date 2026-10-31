# bébé tracker

Mobile-first PWA for logging a newborn's feeds, diapers, pumping and mom's meds, shared live between two phones. The original spec is kept out of the repo (it has the family's medical details). A logbook, not a medical device: never add advice, dosing, or clinical thresholds.

## Stack
- React 19 + Vite + TypeScript, plain CSS (`src/styles.css`), `vite-plugin-pwa`.
- Firebase project `bebe-tracker-1cf656` (Spark plan, no billing): Firestore + Hosting only. No Cloud Functions, no Firebase Auth.
- Live URL: https://bebe.fyi (custom domain on Firebase Hosting; https://bebe-tracker-1cf656.web.app still works). Release notes at https://bebe.fyi/notes/

## Identity model
No accounts. The household id in the URL path (`/h/<24+ char token>`, legacy `#h=` links redirect) is the secret; the manifest has no `start_url` (stripped in `scripts/postbuild.mjs`) so iOS Add to Home Screen keeps that path; `firestore.rules` only allows `households/{hid}/**` for well-formed ids. The id is cached in localStorage per phone (`src/household.ts`). Each phone picks Dad/Mom once (`bebe.who`), stamped as `logged_by`.

## Demo
`/demo` is a made-up household held in memory only (`src/data/demo.ts`, dated relative to now in the device's time zone; `DemoStoreProvider` in `src/data/demoStore.tsx` implements the same `Store`). It never touches Firestore or this device's saved household; Settings shows a "Start your own household" card and hides sharing, switching and delete. `store.demo` is true there.

## Data
- `households/{hid}/entries/{id}`: one collection, discriminated by `type` (`feed | diaper | pump | mom_med | sleep`). A sleep runs from `at` (fell asleep) to `end_at` (woke up; null while asleep), carries `night` (pre-picked from `settings.night_sleep`, default 19:00–07:00, flippable) and optional `how[]`: help falling asleep (held, `bjorn` = carrier, pacifier), offered on every sleep; none means on her own. Feeding and rocking aren't offered (she always goes down after a feed; rocked counts as held); legacy `feeding`/`own`/`rocking` values still display. Optional `places[]` is a timeline of {at, place} (contact, bassinet, stroller): the first stop is where she fell asleep, later stops are moves, logged from the open sleep's sheet ("Moved her?"). New sleeps default to where the last nap or night started (`defaultPlace`). Sleep math lives in `src/lib/sleep.ts`: daily totals split at midnight, a night is named by its evening (`nightKey`), bedtime/first stretch/longest stretch come from `nightStats`. Bilirubin tracking from the spec was dropped on 2026-09-12 at Eric's request; unknown `type` values are filtered out on read. Weight came back on 2026-09-14 as its own collection `households/{hid}/weights/{id}` (grams stored, shown as lb/oz first; first entry = birth weight). Appointments live in `households/{hid}/appointments/{id}`. Timestamps are epoch ms; `day` is the America/New_York calendar day computed at write time (`src/lib/time.ts`). Soft delete via `deleted_at`.
- `households/{hid}/settings/main`: singleton, written whole (no merge). Carries `tz` (IANA; missing = America/New_York for pre-existing households; new ones get the creating device's zone), `units` (volume ml|oz, weight lb|g; both always stored, display only), `custom_meds` (names; a custom med's key is its name), `users.other`.
- The entries listener is scoped to the last 30 days (`where at >=`); older entries load on demand via `loadOlder()` (Summary button, exports). `day` is recomputed on read from `at` in the household tz.
- Export (CSV/JSON) and delete-household live in Settings (`src/lib/export.ts`, `deleteHousehold` in the store). Feedback address in `src/config.ts`.
- Default settings are written by the first client that sees a server-confirmed empty settings doc. No seed entries.
- Firestore persistent cache handles offline queueing; `snapshot.metadata.hasPendingWrites` drives the sync badge.

## Commits
The repo is public (github.com/esp8879/bebe-tracker). Commit as `esp8879 <6955316+esp8879@users.noreply.github.com>` with no Co-Authored-By or other AI attribution lines. Never push the local `private-history` branch.

## Commands
- `npm run dev` / `npm run build` / `npm test` (vitest: day bucketing, DST, summary aggregation, timers, units)
- `npm run deploy` = build + `firebase deploy --only hosting,firestore`

## Screens
Tabs: Today · Summary (By day / All entries) · Weight · Appts · Settings. Summary has a third view, Sleep (`src/components/SleepDiary.tsx`): a 14-night diary (6 PM–8 AM rows, bars and feed dots) and a last-7-vs-previous-7 table. Once 3 nights are logged, Today's weight card becomes the `NightsCard` (first stretch of the last 7 nights), which opens Summary on Sleep via `useNav().setSummaryMode`. Today must fit an iPhone without scrolling (measure at 393x759, an iPhone 15 minus its insets) in every combination of tracked types: feed card, sleep card, pump card, meds card (with sleep on, several med rows fold into one, so four timer rows max; `roomy` spacing at three rows or fewer when diapers aren't also on), Today so far, weight + next appointment side by side, quick-log dock above the tab bar. `settings.today_mode` (`countdown` | `last`) switches the pump and meds cards between countdowns from intervals and last-time-only rows (`recentDoses`, meds dosed in the last 24 hours); `settings.pump_interval_min` is optional. `settings.night_feeds` ({enabled, interval_min, start, end}, household-local HH:MM, may wrap midnight) gives the feed timer a second interval; it is chosen by when the LAST feed started (`isNightAt` in `src/lib/timers.ts`), never by when the next one lands. Today's feed line then reads "Last feed 10:15 PM · night, 4h". `settings.meds_enabled === false` hides the meds card, greys the dock's Meds button (tap shows a toast) and hides the med interval and rotation settings; history and intervals are kept. The dock lists only tracked types, in a fixed order (Feed, Sleep, Diaper, Pump, Meds); while she's asleep Sleep reads "Woke up" and one tap ends the sleep with an Undo toast. With sleep on, diaper counts move from tiles to a line under them. `settings.sleep_enabled === false` hides sleep everywhere but All entries and exports. `settings.diapers_enabled === false` does the same for diapers: hides the diaper tiles on Today and the diaper columns in the Summary table, greys the dock's Diaper button; entries stay in All entries and exports.

## Conventions
- iOS 26 home-screen apps blur a band ~40pt below the status bar (`black-translucent`). Screens start at `env(safe-area-inset-top) + 30px` or more; don't put content higher.
- Store mL and grams; display order follows `settings.units` via `src/lib/units.ts` (`setUnits`, `fmtMl`, `volValue`, `fmtWeight`). All time formatting goes through `src/lib/time.ts` which reads the household tz (`setTimezone`); never call Intl with a hardcoded zone elsewhere.
- Every common action should stay 1–3 taps; time fields default to now.
- Med intervals are blank by default and entered by the user from discharge instructions.
- The "Marked Awake" card (`src/components/MarkedAwake.tsx`, shown on Woke up when `settings.marked_awake !== false`; new households start with it off) is a deliberate homage to the old safety check-in: its own flag drawing, Helvetica, white card (dark between the night-sleep hours). It's the one place outside the icon family and the app's type. Rotating lines live in that file.
- No emoji in the UI. Icons come from `src/components/Icon.tsx` (24px grid, 1.75px rounded stroke; `Mark` is the app icon) and appear only in the tab bar, the dock, the left edge of list rows and the app mark. Per-type tints (`--t-feed` etc.) go on glyphs only. Accent is the icon's pink; periwinkle (`--chart`) is for the weight chart and the feed tint. The wordmark (`.wordmark`) is the only use of Nunito (`public/fonts`). `scripts/icons.mjs` rasterizes `public/icon.svg` into the PNGs.

## Public pages
`docs/guide/index.html` is the shareable guide (built to /guide/ by `scripts/postbuild.mjs`, same wrapper as the notes). First-run flow: `Welcome` in `src/App.tsx` → `createHousehold()` → `src/components/Setup.tsx` (4 skippable steps) → app.

## Release notes
`docs/release-notes/` holds the source of the public release-notes page (a published Claude artifact, URL in its README), the demo-household seed script and the screenshot script. Eric wants it updated after every user-visible change: add a release entry, re-capture screenshots, republish to the same artifact URL.
