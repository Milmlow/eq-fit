# SPEC.md: EQ Fit Claude Code workspace (Phase 2)

Built in a fresh session from this file, one file at a time, each check run before the next. Nothing here is built yet. `AUDIT.md` has the evidence.

## 1. Your answers, restated

| Question | Your answer | What it means in the build |
|---|---|---|
| Where you run Claude Code | Cloud **and** Windows | No bash-only syntax. Hooks are a Node script (`.mjs`), permissions use `npm`/`npx`/`node` commands and `**` globs that match both path styles. |
| Git policy | Ask before push, PRs only on request, never merge | `git push` = ask. `create_pull_request` = ask. Merge, auto-merge and branch/file deletion on GitHub = deny. |
| Supabase | Read-only allowed, every write asks | Reads allowed. `execute_sql`, `apply_migration`, `deploy_edge_function`, secrets, branches = ask. Pause/restore/delete project = deny. |
| Skills | `ui-change`, `coach-content`, `garmin-sync` | One per repeated task in AUDIT.md section 3. |

## 2. Conflicts and tensions I found (please confirm each default)

1. **Stop hook vs missing `node_modules`.** Cloud sessions start without dependencies, and you said ask before installing. *Default:* the hook skips silently with a one-line notice if `node_modules` is absent; it never installs. `npm ci` is an *ask* permission.
2. **Verifier "tests only" vs Python tests.** `tests/test_*.py` need `cryptography` and `requests`, which need `pip install`. *Default:* verifier runs vitest, `tsc`, eslint and `unittest`; if the Python packages are missing it reports "python tests not run" rather than installing. It does not count that as a pass.
3. **Skipped is not passed.** Golden/real-data vitest tests skip without `data-local/Activities.csv`. *Default:* verifier must print the skipped count and say "real-data tests did not run", never plain "all green".
4. **Deny rules are best effort.** A `Read(**/data-local/**)` deny blocks the Read tool; a shell `cat`/`type` could still reach the file. *Default:* I also deny the common shell readers on those paths (`cat`, `type`, `Get-Content`, `head`, `tail`, `less`, `more`, `grep`, `rg`, `cp`, `curl --upload-file`) and say plainly in SETUP.md that this is a seatbelt, not a vault. The real protection stays that the file lives only on your Windows machine.
5. **coach-content may spend money.** `scripts/generate_coach_news.py` calls the Claude API with `ANTHROPIC_API_KEY`. *Default:* the skill uses the offline unit tests (`tests/test_coach_news.py`, `coachNews.test.ts`) only; running the script live is an *ask* and the skill says so.
6. **No formatter exists.** Per your rule, no formatter hook. I will *not* invent one; `eslint` is not a formatter. If you later add Prettier, it is a one-line hook.
7. **MCP limit of 3 and "ask before installing".** GitHub and Supabase are already attached to your account; I install nothing and add no `.mcp.json`. Sentry, PostHog, Netlify, Gmail, Drive are unused by this repo: I deny their tools in permissions rather than uninstall them.
8. **`.claude/settings.json` is committed, `settings.local.json` is yours.** I add `.claude/settings.local.json` to `.gitignore` so personal overrides never get pushed.

## 3. Files to create

Order is the build order. "Done" is a check I run and show you, not a claim.

### F1. `CLAUDE.md` (under 80 lines)
- **Purpose:** the repo's rules for every session, cloud or Windows, ChatGPT-built or Claude-built: commands, style, folder map, never-touch list, Mistakes section ("append one line each time Royce corrects you").
- **Contents:** run/test/lint/build commands; Python test command; commit title style (`Verb the thing (#N)`, one squash PR per change, test added with the feature); folder map from AUDIT.md section 1; never touch `data-local/`, `*.csv`, `eq-fit-backup*.json`, `dist/`, the IndexedDB name `recomp`, `.github/workflows/garmin-*` secrets wiring, deployed Supabase; "merge to main deploys" warning; "skipped tests are not passes".
- **Done when:** (a) `wc -l` < 80; (b) a fresh `claude -p "how do I run tests?"` in the repo answers `npm test` (and the Python command) correctly without searching; (c) a second fresh question, "what must you never touch?", lists data-local, backups and workflows.

### F2. `.claude/settings.json` (permissions)
- **Purpose:** safe daily work without prompts, prompts for risk, hard blocks for personal data.
- **allow:** `Bash(npm test*)`, `Bash(npm run lint*)`, `Bash(npm run build*)`, `Bash(npm run dev*)`, `Bash(npx tsc*)`, `Bash(npx vitest*)`, `Bash(python* -m unittest*)`, `Bash(python* -I tests/oracle/*)`, `Bash(git status|diff|log|show|branch|fetch*)`, `Bash(git add|commit*)`, GitHub read tools (`pull_request_read`, `list_*`, `get_*`), Supabase read tools (`list_tables`, `list_migrations`, `get_advisors`, `query_logs`, `get_edge_function`, `list_edge_functions`, `get_project*`, `search_docs`).
- **ask:** `git push*`, `git checkout -B`, `git rebase*`, `git reset*`, `rm*`, `del*`, `Remove-Item*`, `npm ci|install*`, `pip install*`, `python scripts/generate_coach_news.py*`, `Edit(.github/workflows/**)`, GitHub `create_pull_request`/`push_files`/`create_or_update_file`, Supabase `execute_sql`, `apply_migration`, `deploy_edge_function`, `create_edge_function_secret`, `create_branch`, `merge_branch`, `reset_branch`.
- **deny:** `Read` of `**/.env*`, `**/data-local/**`, `**/*.csv`, `**/*.CSV`, `**/eq-fit-backup*.json`, `**/recomp-backup*.json`, `**/*.pem`, `**/*secret*`; shell readers on those same paths (item 4 above); `git push --force*`; `git push origin main*`; GitHub `merge_pull_request`, `enable_pr_auto_merge`, `delete_file`; Supabase `delete_branch`, `pause_project`, `restore_project`, `create_project`; all `mcp__Sentry__*`, `mcp__PostHog__*`, `mcp__Netlify__*`, Gmail and Drive tools. No `--dangerously-skip-permissions` anywhere, and SETUP.md says not to use it.
- **Done when (each shown to you):** (a) JSON parses and `claude` loads it without warning; (b) a real attempt to Read `data-local/Activities.csv` (created as an empty dummy first, then removed after I ask you) is blocked; (c) `cat data-local/x.csv` is blocked; (d) `git push` prompts; (e) `npm test` does not prompt; (f) a Supabase `execute_sql` call prompts and `delete_branch` is refused.

### F3. `.claude/hooks/stop-tests.mjs` + hook entry in `settings.json`
- **Purpose:** when Claude says it is done, run fast tests so "done" means checked.
- **Behaviour:** reads the hook JSON from stdin; exits 0 at once if `stop_hook_active` is true (**loop guard**); exits 0 with a notice if `node_modules` is missing (conflict 1); runs `npm test --silent` with a **90 s timeout** and kills the process tree on expiry; on failure prints the last 30 lines to stderr and exits 2 so Claude must fix it; on timeout prints "tests timed out, not verified" and exits 0 (a slow suite must not trap the session); also fails open on any hook script error. Pure Node `child_process`, so identical on Windows and Linux.
- **Done when:** triggered on purpose three ways: (a) healthy repo, Stop passes silently; (b) I add a deliberately failing test (`expect(1).toBe(2)` in a throwaway file), Stop blocks once with the failure, and the next Stop passes the guard; (c) I temporarily set the timeout to 1 s, it times out and lets the session end. The throwaway file and setting are then reverted and `git status` shown clean.
- **Formatter hook:** intentionally none (conflict 6).

### F4. `.claude/agents/reviewer.md` (read-only)
- **Purpose:** independent review of a diff against this repo's rules, not anchored on my own reasoning.
- **Tools:** `Read, Grep, Glob, Bash(git diff*|git log*|git show*)` only. No Edit/Write, no network.
- **Checks it makes:** test added for each `src/` change; no `innerHTML`/`dangerouslySetInnerHTML` (README says all text is rendered as React text); no hardcoded keys; no changes to the `recomp` DB name; backup schema version bumped when tables change; missing "unknown shown as '-' never 0" handling; docs touched when behaviour changes. Output: ranked list, file:line, one-line reason each.
- **Done when:** run on a deliberately broken change (a src edit with no test, an `innerHTML` insertion, and a `0` shown for unknown) and it reports all three, and the tool list contains nothing that writes.

### F5. `.claude/agents/verifier.md` (tests only)
- **Purpose:** run the checks and report truthfully; never fix.
- **Tools:** `Read, Grep, Glob, Bash` with Bash limited by its own rules to `npm test`, `npm run lint`, `npx tsc --noEmit`, `python -m unittest ...`. No Edit/Write.
- **Report format:** per check PASS/FAIL/NOT RUN, counts (including **skipped**), first failing assertion verbatim. Treats skipped real-data tests as "NOT RUN" (conflict 3).
- **Done when:** run on the same deliberately broken change: it reports FAIL with the real error text on a broken test, and on a clean tree reports PASS with the skipped count. Attempting `rm` or `git push` from it is refused.

### F6. `.claude/skills/ui-change/SKILL.md`
- **Purpose:** repeat task #1 (Today/Workout screens). *When to use:* any change in `src/ui/*` or `*.css`.
- **Steps:** read the screen and its `src/lib` logic and test; change logic in `src/lib` (pure) before JSX; keep colours in `themes.css` tokens only; check all four themes with `tests/contrast.test.ts`; keep layout usable at 390 px (Playwright screenshot at 390 wide, `deviceScaleFactor` 1); text as React text; add or update a test; run verifier.
- **Done when:** run against a real past task, "Reduce Today scrolling with collapsed tools" (#24, commit `f16c43f`): on a scratch branch from its parent, the skill produces a change touching the same files, with test + contrast + 390 px screenshot. The scratch branch is discarded, nothing pushed.

### F7. `.claude/skills/coach-content/SKILL.md`
- **Purpose:** repeat task #2 (banter, news, characters). *When to use:* edits to `coach*.ts`, `CoachEQ.tsx`, `generate_coach_news.py`, `docs/coach-eq.md`.
- **Steps:** read `docs/coach-eq.md`; keep jokes grounded in verified training facts (`coachFacts.ts`); keep the two-week tone rotation and "disliked jokes hide immediately"; never call the live Claude API (ask first, conflict 5); update the unit tests (`coach*.test.ts`, `test_coach_news.py`); update `docs/coach-eq.md`; run verifier.
- **Done when:** run against the real past task "Balance news humour topics and prevent repeated events" (#38, `9969ec3`): on a scratch branch from its parent it identifies the same files and writes a repeated-event test that fails before the fix and passes after. Discarded, nothing pushed.

### F8. `.claude/skills/garmin-sync/SKILL.md`
- **Purpose:** repeat task #3 (import/sync work and failure diagnosis). *When to use:* `scripts/*garmin*.py`, `supabase/functions/**`, `garminEncrypted.ts`, `syncFailure.ts`, `.github/workflows/garmin-*`.
- **Steps:** work only against offline tests and fixtures; error messages must name the *stage* (download / validation / save) and never include keys or payload; no live Garmin call, no deploy, no Supabase write (all *ask*); update `docs/private-sync.md`; run verifier incl. `unittest`.
- **Done when:** run against the real past task "Distinguish Garmin download, validation and device save failures" (#28, `cc97434`) on a scratch branch: produces stage-specific failure paths with tests and a redaction check. Discarded, nothing pushed.

### F9. `.gitignore` (one line) and `SETUP.md`
- `.gitignore`: add `.claude/settings.local.json`. *Done when:* `git check-ignore .claude/settings.local.json` prints it.
- `SETUP.md`: every file above, why it exists, how to test it, honest limits (deny rules are best effort; hook skips when deps are missing), and `START HERE`. *Done when:* every "how to test" command in it was actually run once during the build and its output was as stated.

## 4. Not included, on purpose

- Formatter hook (no formatter in repo), `.mcp.json` / new MCP servers (nothing new needed), PR template and CODEOWNERS (outside "workspace" scope; can be a follow-up), CI lint step (would change workflows; suggest only), branch cleanup of the ~38 merged branches and stale PRs #1/#2 (deleting is yours to approve).
- `AUDIT.md` and `SPEC.md` stay in the repo root until you say to move them to `docs/`.

## 5. Build-time prerequisites

- `npm ci` must be run in the build session (**will ask you first**) or the verifier and Stop hook checks cannot run.
- Python packages `cryptography`, `requests` for the Python tests (**will ask first**); without them those checks are reported NOT RUN.
- Work on branch `claude/unmerged-prs-status-5w9mw7`. Commits are local; **no push without your yes.**

## 6. Approval

Reply **approved** (or list changes to the conflict defaults in section 2). Then start the build in a fresh session pointing at this file.
