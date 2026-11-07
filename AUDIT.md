# AUDIT.md: EQ Fit workspace audit (Phase 1, read-only)

Date: 2026-11-07. Scope: whole repo, all 48 commits (repo is 6 days old, so that is the full history), no existing `CLAUDE.md` or `.claude/`.
Nothing was installed or run. `node_modules` is absent, so the test baseline is **unknown** (see Gaps).

## 1. What this repo is

- Local-first training tracker: React 18 + Vite 6 + TypeScript (strict) + Dexie (IndexedDB), installable PWA. Node 22, Python 3.12.
- Since Stage 4 it also has a backend side: Supabase (edge functions `garmin-ingest`, `garmin-trial`, 3 migrations), a Garmin sync that runs **hourly** in GitHub Actions, and a Claude-API "news banter" script that runs at every Pages deploy.
- Commands (from `package.json`): `npm run dev | build (tsc --noEmit && vite build) | test (vitest run) | lint (eslint .)`. Python tests: `python -m unittest discover -s tests -p 'test_*.py'` (needs `cryptography`, `requests`).
- Layout: `src/lib` (pure logic, 40 files) · `src/db` (Dexie + `Repo`) · `src/ui` (screens/CSS) · `tests/` (49 vitest + 3 python, `fixtures/`, `oracle/` Python reference scripts) · `scripts/` (Python Garmin/news, PWA build) · `supabase/` · `docs/` · `.github/workflows/` (6).
- CI (`checks.yml`, PRs only): `npm ci`, `npm test`, `npm run build`, python unittest. **Lint is not in CI.**
- Merging to `main` **auto-deploys to GitHub Pages** (`pages.yml`: push + daily cron) and re-triggers private-sync if its files change.

## 2. What slows you down

1. **No written rules, so every session re-learns the repo.** The only conventions live in README/NOTES.md, which are stale (README still says "no backend, no network calls", "Stage 4", a `C:\Users\royce\...` path, `RECOMP_APP_SPEC.md on G:`).
2. **Two tools, two styles.** 12 `codex/*` branches (ChatGPT/Codex) vs 13 `feat/*` + 7 `fix/*` + the `stage-*` branches. Commit titles are consistent (`Verb … (#N)`), but nothing tells a new session that.
3. **Branch litter.** About 38 remote branches are already merged (squash), which makes "what is unmerged?" hard to answer (the question that started this session). Two stale PRs (#1, #2) still target `stage-1-import`.
4. **Environment friction.** `node_modules` is not installed in fresh sessions; README's Windows fix ("delete node_modules, reinstall") shows cross-OS native-binary trouble. Each session pays for `npm ci` before it can verify anything.
5. **Silent green.** Golden/real-data tests skip when `data-local/Activities.csv` is missing, so "tests pass" can mean "the strongest tests did not run".
6. **Hot files are big and shared.** `src/ui/today.css` (15 touches), `Today.tsx` (12), `App.tsx` (11), `db/repo.ts` (11, 434 lines) are changed in almost every feature, so merge conflicts between parallel Codex/Claude branches are likely.

## 3. Your 3 most repeated tasks (evidence from git)

| # | Task | Evidence |
|---|---|---|
| 1 | **Rework a Today/Workout screen** (simplify, compact, fewer taps, phone-first) | ~12 of 48 commit titles (#17-#24, #26, #36, #40: "Simplify…", "Compact…", "Reduce Today scrolling…"). Top files: `today.css`, `Today.tsx`, `WorkoutEditor.tsx`, `workoutFlow.ts`. |
| 2 | **Coach EQ content: banter, news, characters** | ~14 titles (#14-#16, #25, #29-#34, #38, #39). Files: `coach*.ts`, `CoachEQ.tsx`, `scripts/generate_coach_news.py`, `docs/coach-eq.md` (8 touches). Four were pure "diagnose/fix" follow-ups (#32-#34, #39), i.e. the first attempt missed. |
| 3 | **Garmin import/sync: add, then diagnose failures** | ~10 titles (#3-#7, #26-#28, #40). Files: `scripts/*garmin*.py`, `supabase/functions/*`, `garminEncrypted.ts`, `syncFailure.ts`, 3 python test files. |

Cross-cutting pattern behind all three: **one branch → one squash-merged PR → test file added** (33 of the last 48 commits touch both `src/` and `tests/`). That is the habit to protect with a skill and a verifier.

## 4. Risks and gaps

| Risk | Detail | Severity |
|---|---|---|
| Merge = production deploy | `pages.yml` deploys on push to `main`; Garmin sync is on an hourly cron. An unreviewed merge or workflow edit goes live and touches personal data. | High |
| Prod database reachable from Claude | A Supabase connector (apply_migration, execute_sql, deploy_edge_function, create/delete branch, pause project…) is attached to sessions. Edge function v3 was deployed to prod directly (docs/session-allocation.md). | High |
| Personal data adjacent to code | `data-local/Activities.csv` (2,698 real rows) and `eq-fit-backup*.json` are gitignored (good) but sit in the working tree on your Windows machine; any `Read` could surface them. Real-data test reads `data-local/`. | High |
| Secrets in workflows | Only references (`${{ secrets.* }}`), no values. `pages.yml` hardcodes a Supabase **publishable** key and an owner UUID: the key is designed to be public, but the owner UUID plus project URL identifies your account. Not a secret, but worth knowing. | Medium |
| Other connectors attached | Sentry, PostHog, Netlify, Gmail, Drive are connected to the account; this repo uses none of them (hosting is GitHub Pages, README says no analytics). Unneeded tool surface. | Medium |
| Lint not in CI | `npm run lint` exists but nothing runs it; `tsc` runs only inside `build`. | Low |
| `npm audit` dev advisories | Known and deferred in NOTES.md (vitest/vite major bump). | Low |
| Doc drift | README "no network calls" is now false (Supabase, Claude API). `NOTES.md` is a per-stage log, not rules. | Low |
| No PR template, CODEOWNERS or pre-commit | Nothing enforces test-with-feature or title style. | Low |
| Python 3.13 locally vs 3.12 in CI | Possible subtle difference for the python tests. | Low |

## 5. What I recommend building (summary; details go in SPEC.md after your answers)

- `CLAUDE.md` (<80 lines): commands, the PR/branch convention, folder map, never-touch (data-local/, backups, workflow secrets, deployed Supabase, `dist/`), Mistakes list.
- 3 skills matched to section 3: `ui-change` (phone-width check + theme contrast test), `coach-content` (banter/news, no live API calls), `garmin-sync` (offline python tests first, never call live Garmin).
- 2 subagents: `reviewer` (read-only) and `verifier` (Bash limited to test/lint/tsc).
- Permissions: allow npm/vitest/tsc/eslint/python-unittest/git-read; ask for push, `npm ci`/install, delete, workflow edits, any Supabase write, deploy; deny reads of `data-local/**`, `**/*.csv`, `**/eq-fit-backup*.json`, `.env*`.
- Hooks: no formatter (the repo has none, so skipped per your rule); Stop hook runs `npm test` with timeout and loop guard.
- MCP: keep GitHub (replaces manual PR/CI lookups); optionally Supabase read-only (replaces dashboard clicks for schema/logs). Everything else: deny, not used.
