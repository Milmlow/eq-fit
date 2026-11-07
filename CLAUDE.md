# EQ Fit: rules for Claude Code

Personal local-first training tracker. React 18 + Vite 6 + TypeScript (strict) + Dexie/IndexedDB, installable PWA.
Backend side: Supabase edge functions + hourly Garmin sync (GitHub Actions) + Claude-API news script. Node 22, Python 3.12.
Used from both Linux cloud sessions and Windows. Built with both ChatGPT/Codex and Claude, so follow what is written here, not habit.

## Commands
- Install (ask first): `npm ci`
- Test: `npm test` (vitest). Python tests: `python -m unittest discover -s tests -p "test_*.py"` (needs `cryptography`, `requests`).
- Type-check: `npx tsc --noEmit`. Lint: `npm run lint` (CI does not run lint, so run it yourself).
- Build: `npm run build` (tsc + vite). Dev: `npm run dev` -> http://127.0.0.1:5173/
- CI = `npm ci`, `npm test`, `npm run build`, python unittest. Match it before saying done.
- Real-data/golden tests SKIP without `data-local/Activities.csv`. Skipped is not passed: report the skip count.

## Git and shipping
- One branch -> one PR -> squash merge. Commit title: `Verb the thing` (sentence case, no prefix), e.g. `Simplify Today with collapsed tools`.
- Add or update a test with every `src/` change (33 of the last 48 commits did).
- Merging to `main` auto-deploys GitHub Pages and may trigger the hourly private Garmin sync. Never merge, never push to `main`, never force-push.
- Ask before: `git push`, opening a PR, deleting anything, installing, editing `.github/workflows/**`, any Supabase write, any live API call.

## Folder map
- `src/lib` pure logic (parsers, coach, progress, backup). Put logic here, not in JSX.
- `src/db` Dexie schema + `Repo` layer. `src/ui` screens and CSS. Colours only in `src/ui/themes.css` tokens.
- `tests/` vitest + 3 python tests; `tests/oracle/` independent Python reference scripts; `tests/fixtures/` synthetic data.
- `scripts/` Python (Garmin, coach news, icons) and the PWA plugin. `supabase/` edge functions + migrations. `docs/` feature notes.
- Specs and history: `NOTES.md` (per-stage notes), `AUDIT.md`, `SPEC.md`, `SETUP.md`. README is partly stale.

## Style
- Unknown values show as "-" or "unknown", never 0. Badges say where a figure came from (reported, measured, computed, proposed).
- Render all imported or typed text as React text. No `innerHTML` or `dangerouslySetInnerHTML`.
- Phone first: usable at 390 px wide. Check all four themes (System, Light, Dark, Crazy); `tests/contrast.test.ts` enforces WCAG AA.
- Error messages name the stage and never include keys, tokens or payloads.

## Never touch
- `data-local/`, `*.csv`, `eq-fit-backup*.json`, `recomp-backup*.json`, `.env*`: personal data. Do not read, print or commit them.
- IndexedDB name `recomp` and class `RecompDB`: renaming hides existing browser data.
- Secrets wiring in `.github/workflows/*` (`GARMIN_*`, `ANTHROPIC_API_KEY`, passphrases). Reference only, never values.
- Deployed Supabase project and edge functions: read only unless the user says otherwise in that message.
- `dist/`, `node_modules/`, `package-lock.json` (change only via npm).
- Bump the backup schema version and add a migration if you change stored tables; older backups must still restore.

## Skills and agents (in `.claude/`)
- Skills: `ui-change`, `coach-content`, `garmin-sync`. Agents: `reviewer` (read-only), `verifier` (runs checks only).
- Before saying done: run the `verifier` agent; for a diff review, use `reviewer`.

## Mistakes (append one line each time the user corrects you)
- (none yet)
