# EQ Fit (personal)

## Run it on Windows

1. Open PowerShell (or Command Prompt) and check Node is 20 or newer: `node -v` (it should print v20.x, v22.x or higher). If it is missing or older, install the current LTS from https://nodejs.org and open a new terminal.
2. Go to the project folder: `cd C:\Users\royce\Documents\Claude\Projects\recomp-app`
3. IMPORTANT first time only: the `node_modules` folder in this project was created on Linux during the build session, so it contains Linux binaries that will not run on Windows. Delete it first (File Explorer, or `rmdir /s /q node_modules` in Command Prompt; also delete `dist` if present), then run `npm install`. If an error mentions a native module or a failed build step, delete the `node_modules` folder (File Explorer, or `rmdir /s /q node_modules` in Command Prompt), then run `npm install` again (this is also the fix if you see a missing `@rollup/rollup-win32` or `esbuild` module error).
4. Start the app: `npm run dev`. It prints a line like `Local: http://127.0.0.1:5173/`. Open exactly that address in Chrome or Edge. Leave the terminal open while you use the app; press Ctrl+C to stop it. If port 5173 is busy the command stops with an error rather than picking another port; close the other program using it.
5. Import your data: open the Import tab, click "Choose CSV file", and pick `C:\Users\royce\Documents\Claude\Projects\recomp-app\data-local\Activities.csv`. Check the preview (2698 rows, 41 columns, 0 errors), then press the Import button. Importing the same file again adds nothing.
6. Your data is stored inside the browser you used (IndexedDB), per address. Always use the same address and browser, and do not clear site data for it, or the app will look empty. Make a backup now and then: More > Backup and restore (see "Backup routine" below).

---

## About

EQ Fit: local-first, browser-only personal training app (Stage 4: backup, restore, CSV export and an installable offline app, on branch stage-4-install, on top of the themed Today screen). Data lives in this browser's IndexedDB
(database name is still "recomp" internally so existing data is kept). No backend, no remote, no analytics, no network calls.
Personal project (not EQ, not SKS).

What works now: CSV import with preview, duplicate protection and reversible type mapping; Today screen; flexible Week;
structured exercises and sets (edit or remove a set, rename an exercise, optional rep range); watch-activity link
without double counting; running comparison by period; Lifting tab with weekly working sets per muscle (working sets
only, primary muscles as you typed them, Mon-Sun weeks, "unassigned" for blank), per-exercise history with estimated
1RM (Epley and Brzycki shown, source set, 1 rep = actual, over 10 reps = low confidence), and progression ideas
(double progression, labelled "proposed", only when you entered a rep range, never when the last session has a pain note).

## Themes, Today screen and tabs (branch stage-3-theme)

- Bottom tabs: Today, Week, Lift (lifting progress), Run (running by period), More (theme selector, Import, Recent, Backup and restore, demo mode).
- Today hero: date, session title, Start, "Beat last time" (Last time, Today's target, Alternative, a possible-PR cue), last-week totals and the 4-week running average.
  The "?" button explains the rule. Rules live in `src/lib/beatLastTime.ts` (pure; checked against `tests/oracle/oracle_beat.py`).
  Last time = best working set of the most recent earlier session (highest Epley e1RM, tie -> more reps). Target = same load, +1 rep
  (or +2.5 kg at the bottom of your rep range when your rep range is topped out and the progression hint says increase).
  Alternative = +2.5 kg (`ALT_INCREMENT_KG`) with the fewest reps that match last time's e1RM. "New PR" only means the target would beat your best recorded e1RM.
  A pain note in the last session shows Last time only; no history shows one neutral line.
- Themes: System / Light / Dark / Crazy. Dark until you choose. Stored in `localStorage` key `eqfit.theme` (not part of workout data).
  Tokens (all colours) are in `src/ui/themes.css`, one block per `data-theme`; layout/typography in `src/ui/today.css`; Crazy art in `src/ui/CrazyArt.tsx`.
  `tests/contrast.test.ts` reads `themes.css` and checks WCAG AA for every text and UI pair in every theme.
- Fonts: Archivo (SIL OFL) self-hosted from the npm package `@fontsource-variable/archivo`, Latin subset (`src/ui/fonts.css`). No CDN.
- Demo mode: More > Demo mode, or open the app with `?demo=1`. Shows the designer's reference values (Mon 2 Nov, Bench Press 80 x 8 -> 80 x 9, alt 82.5 x 6, 5 lifts, 3 runs, 26.49 km, 5:49). Reads and writes nothing.
- `?today=YYYY-MM-DD` still overrides today's date (checks only).

## Commands

    npm install
    npm run dev                 # http://127.0.0.1:5173/
    npm run build               # type-check + production build into dist/
    npm run preview             # serve dist/
    npm test                    # vitest (golden tests need data-local/Activities.csv, else they skip with a warning)
    npm run lint
    npx tsc --noEmit

Golden tests compare the app against figures produced by independent Python scripts (never by app code):
`python3 -I tests/oracle/oracle.py data-local/Activities.csv` -> `tests/fixtures/oracle.json`, and
`python3 -I tests/oracle/oracle_running.py data-local/Activities.csv 2026-11-02` -> `tests/fixtures/oracle-running.json`, and
`python3 -I tests/oracle/oracle_lifting.py` (synthetic data only) -> `tests/fixtures/synthetic-lifting.json` + `oracle-lifting.json`, and
`python3 -I tests/oracle/oracle_beat.py` (synthetic, exact fractions) -> `tests/fixtures/oracle-beat.json`.
Running pace = distance-weighted mean of the exported m:ss pace (seconds per km), over runs with both a pace and a
distance above zero; km = sum of distance. Outdoor = "Running"; treadmill = "Treadmill Running" (after mapping).

## Layout

- `src/lib`: parsers, CSV reading, hashing, type mapping, importer, summaries, running periods, week helpers
- `src/db`: Dexie schema (v1 import tables, v2 exercises/workouts/sets), migration ledger, repository layer (`Repo`)
- `src/ui`: screens. All imported or typed text is rendered as React text, never HTML.

Badges on figures say where they came from: reported (you entered it), measured (watch/device), watch-estimated,
computed (this app), proposed (a suggestion). Unknown values show as "-" or "unknown", never as 0.

## Backup routine (Stage 4)

Your data lives only inside the browser that holds it. Clearing site data, a lost phone, or the browser deciding it needs space can erase it. A backup file is the only copy that survives.

- More > Backup and restore > **Download backup** writes `eq-fit-backup-YYYY-MM-DD.json`: every table (import batches, activities, type mappings, exercises, workouts, sets), the schema version, the app version, the export time and a count per table. Demo mode data and the theme choice are not included.
- **Keep that file private.** It holds your full activity and training history. Do not email it, share it or put it anywhere public. Keep a copy somewhere you control (a phone Files folder you back up, a private cloud folder, a USB stick).
- Routine: after each week of logging, or at least every 7 days. The app shows a gentle banner on Today and More once the last backup is 7 or more days old, or when there is data and no backup yet. The banner is a reminder only; the app cannot see whether you moved the file somewhere safe.
- **Restore** (More > Choose backup file): the whole file is checked first (JSON shape, types, versions, duplicate or dangling ids, size limit of 64 MB). If anything is wrong the app lists the problems and changes nothing. If it is valid you get a confirmation naming what will be replaced (now vs after restore). Restoring replaces everything in one all-or-nothing database transaction; an error leaves your existing data untouched. Older backups (schema v1 and v2) are upgraded on restore. The file's text is only ever shown as plain text, never as HTML.
- Negative zero: the watch export has cells like `'-0` (Min and Max Elevation) that the importer stores as the number -0. For backup purposes -0 and 0 are the same number, so the backup writes 0. The original text stays in `raw_row` and `raw_fields`, which are the source of truth; stored data and the importer are not changed.
- **CSV export** (More): Workouts and sets, and Running periods. These are for spreadsheets and cannot be restored. Text cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return get a leading apostrophe so a spreadsheet will not run them as formulas.
- Storage: the app asks the browser for persistent storage (shown in More: granted, not granted or not supported). "Granted" lowers the chance of automatic clearing; it is not a backup. If IndexedDB is unavailable or a save fails, a red warning appears at the top of every screen.

### Safari's 7-day storage clearing (documented, with a caveat)

Source: WebKit blog, "Full Third-Party Cookie Blocking and More", John Wilander, 24 March 2020 (https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/). Documented there: Safari deletes all script-writable storage (IndexedDB and localStorage included) for a website after seven days of Safari use without the user interacting with that site. For web apps added to the home screen the post says they "are not part of Safari and thus have their own counter of days of use", and "We do not expect the first-party in such a web application to have its website data deleted"; if that happens WebKit "would consider it a serious bug". So it is a separate counter and an expectation, not a promise in those words that home-screen apps are exempt. **Not verified on a real phone by this build**, and the post is from 2020, so check Apple's current documentation if it matters. Practical rule: install to the Home Screen on iPhone, open it regularly, and keep backups. Using EQ Fit only as a Safari tab leaves your data exposed to the 7-day rule.

## Install on your phone (Stage 4)

Installing needs the app to be served over HTTPS (see Hosting). Nothing is uploaded; the app stays on your phone. The service worker keeps a copy of the app files so it opens with no signal. It never touches your workout data.

- **iPhone (Safari)**: open the hosted address in Safari > Share button > **Add to Home Screen** > Add. Open it from the new EQ Fit icon (not from Safari) so it runs as its own app. iPhone's Home Screen app has its own storage, separate from the Safari tab: if you already logged data in the Safari tab, take a backup there and restore it in the Home Screen app.
- **Android (Chrome)**: open the hosted address > the install prompt, or the menu (three dots) > **Install app** (or Add to Home screen) > Install.
- **Updating**: when a new version is available a banner says so; tap **Update now**. The page reloads; your data is not touched. Take a backup first if you like.
- First load must be online; after that the app opens offline, fonts and data included.

## Hosting (prepared, not deployed)

The build uses a relative base (`./`), so the same `dist/` works from a domain root or a sub-path. Nothing has been pushed, enabled or deployed; those are Royce's steps.

1. **GitHub Pages**: push the repo (public repos get Pages free; Pages on a private repo needs a paid GitHub plan; this repo holds no personal data because `data-local/`, CSVs and backups are gitignored, but check `git ls-files` first), then Settings > Pages > Source "GitHub Actions". `.github/workflows/pages.yml` is already written: on push to `main` it runs tests, builds and deploys. The app appears at `https://<user>.github.io/<repo>/`.
2. **Personal Netlify site**: either drag the `dist/` folder (after `npm run build`) onto Netlify's manual deploy, or connect the repo with build command `npm run build` and publish directory `dist`. Use your own personal Netlify account, not a work one. No redirects are needed.

Whichever you pick: data is stored per address, so choose the final address before you start logging (a different address starts empty; use backup and restore to move).

## NOT built

- Not done in Stage 4: any real iPhone or Android test (install, Add to Home Screen, offline, file download, share sheet) and Safari/Firefox testing: only headless Chromium was used; the iOS "Share or save backup" path is untested; deployment of any kind; enabling GitHub Pages; the private GitHub repo; automatic or scheduled backups (a banner only reminds you); cloud sync; merging a backup into existing data (restore replaces); a restore undo (use "Download my current data first"); an install button inside the app; push notifications; encrypting backup files.
- Not built yet from earlier stages: Food, meals and check-ins (weight, waist), trends and charts, weekly review, the push layer (a PR alert when a set is logged, per-exercise increments), UI for changing activity-type mappings (the repository supports it, tested), editing equipment of an exercise (by design: a different machine is a different exercise), planned set/rep targets per workout, per-muscle weekly targets (only a reference note), fractional or secondary-muscle set counting, a muscle taxonomy, max-testing prompts, a full redesign of Week, Lift, Run, Import and Recent (they only take the theme colours), themes for print, a committed Playwright suite (the browser checks were ad-hoc scripts), a Garmin-import spike.
- Next: the push layer, then a light weight/waist check-in.
