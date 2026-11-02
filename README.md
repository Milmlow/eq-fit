# Recomp (personal)

## Run it on Windows

1. Open PowerShell (or Command Prompt) and check Node is 20 or newer: `node -v` (it should print v20.x, v22.x or higher). If it is missing or older, install the current LTS from https://nodejs.org and open a new terminal.
2. Go to the project folder: `cd C:\Users\royce\Documents\Claude\Projects\recomp-app`
3. IMPORTANT first time only: the `node_modules` folder in this project was created on Linux during the build session, so it contains Linux binaries that will not run on Windows. Delete it first (File Explorer, or `rmdir /s /q node_modules` in Command Prompt; also delete `dist` if present), then run `npm install`. If an error mentions a native module or a failed build step, delete the `node_modules` folder (File Explorer, or `rmdir /s /q node_modules` in Command Prompt), then run `npm install` again (this is also the fix if you see a missing `@rollup/rollup-win32` or `esbuild` module error).
4. Start the app: `npm run dev`. It prints a line like `Local: http://127.0.0.1:5173/`. Open exactly that address in Chrome or Edge. Leave the terminal open while you use the app; press Ctrl+C to stop it. If port 5173 is busy the command stops with an error rather than picking another port; close the other program using it.
5. Import your data: open the Import tab, click "Choose CSV file", and pick `C:\Users\royce\Documents\Claude\Projects\recomp-app\data-local\Activities.csv`. Check the preview (2698 rows, 41 columns, 0 errors), then press the Import button. Importing the same file again adds nothing.
6. Your data is stored inside the browser you used (IndexedDB), per address. Always use the same address and browser, and do not clear site data for it, or the app will look empty. There is no backup yet (not built).

---

## About

Local-first, browser-only personal training app (Stage 2 of 5). Data lives in this browser's IndexedDB. No backend,
no remote, no analytics, no network calls. Personal project (not EQ, not SKS).

What works now: CSV import with preview, duplicate protection and reversible type mapping (Stage 1); Today screen
(planned vs completed, quick set log, "last time" for each exercise); flexible Week (move, add, remove sessions,
history baseline as context, optional 3-day fallback); structured exercises and sets (load, reps, optional RIR,
warm-up flag, pain note); linking an imported watch activity to a workout without double counting; running
comparison by period (4 weeks, 4 weeks combined, last complete month, custom range; treadmill toggle).

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
`python3 -I tests/oracle/oracle_running.py data-local/Activities.csv 2026-11-02` -> `tests/fixtures/oracle-running.json`.
Running pace = distance-weighted mean of the exported m:ss pace (seconds per km), over runs with both a pace and a
distance above zero; km = sum of distance. Outdoor = "Running"; treadmill = "Treadmill Running" (after mapping).

## Layout

- `src/lib`: parsers, CSV reading, hashing, type mapping, importer, summaries, running periods, week helpers
- `src/db`: Dexie schema (v1 import tables, v2 exercises/workouts/sets), migration ledger, repository layer (`Repo`)
- `src/ui`: screens. All imported or typed text is rendered as React text, never HTML.

Badges on figures say where they came from: reported (you entered it), measured (watch/device), watch-estimated,
computed (this app), proposed (a suggestion). Unknown values show as "-" or "unknown", never as 0.

## NOT built

Food, meals and check-ins (weight, waist), trends and charts, weekly review and suggestions, JSON backup/restore
(there is NO backup yet: clearing browser data deletes everything), CSV export, PWA/offline install, sync of any kind,
UI for changing activity-type mappings (repository supports it, tested), editing or deleting a logged set (only add
and remove), exercise rename/edit, planned exercise targets (sets/reps), Pool Swim and cycling distance/pace
interpretation, a committed Playwright suite (browser checks were ad-hoc scripts), Safari/Firefox/real-phone testing.
Next: Stage 3 is food and check-ins.
