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

Local-first, browser-only. Data lives in this browser's IndexedDB. No backend, no remote, no analytics, no network calls.
Personal project (not EQ, not SKS).

## Setup (Node 20+ and npm required; tested with Node 22.23 / npm 10.9)

    npm install
    mkdir data-local            # gitignored; keep your Activities.csv here (never committed)

## Run

    npm run dev                 # http://127.0.0.1:5173
    npm run build               # type-check + production build into dist/
    npm run preview             # serve dist/

Open the app, Import tab, choose Activities.csv, review the preview, press Import. The Recent tab shows the last
28 days ending on the latest imported activity date.

## Test

    npm test                    # vitest: unit tests, importer tests, golden tests
    npm run lint

Golden tests read `data-local/Activities.csv` and compare against `tests/fixtures/oracle.json`, which was produced by
the independent script `tests/oracle/oracle.py` (`python3 -I tests/oracle/oracle.py data-local/Activities.csv`).
If the CSV is absent the golden tests are skipped with a console warning.

## Layout

- `src/lib`: parsers, CSV reading, hashing, type mapping, importer, summary maths (no DB access except importer via Repo)
- `src/db`: Dexie schema v1, migration ledger, repository layer (`Repo`) - the only thing the UI talks to
- `src/ui`: import screen and read-only recent view (all imported text rendered as React text)

## Not built (Stage 1 only)

Today screen, flexible week, workouts/exercises/sets, meals and food log, weight/waist check-ins, trends and charts,
running comparison across periods, weekly review, JSON backup/restore, CSV export, PWA/offline install, sync of any kind,
UI for changing type mappings (the repository supports it and it is tested), Playwright test suite (screenshots were
taken with an ad-hoc script, not committed). Stage 2 is Training.
