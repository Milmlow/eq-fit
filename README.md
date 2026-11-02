# Recomp (personal) - Stage 1: foundation + CSV import

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
