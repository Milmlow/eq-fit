# SETUP.md: EQ Fit Claude Code workspace

What was built from `SPEC.md`, why each file exists, and how to test it. `AUDIT.md` has the evidence behind the choices.

## START HERE

Open Claude Code in this repo, **accept the workspace trust dialog once** (without it Claude Code ignores the allow list), then run:

    claude "Use the verifier agent and tell me what is and is not verified"

You should get four lines (tests, tsc, lint, Python) plus a note that real-data tests were skipped unless `data-local/Activities.csv` exists.

## Files

| File | Why it exists | How to test it |
|---|---|---|
| `CLAUDE.md` (47 lines) | Rules every session reads: commands, git/shipping rules, folder map, style, never-touch list, and a **Mistakes** section. Every time you correct Claude, one line goes there. | `wc -l CLAUDE.md` is under 80. Ask a fresh session "how do I run tests?" and "what must you never touch?"; both answers should match the file. |
| `.claude/settings.json` | Permissions and the Stop hook. **allow** = daily safe commands (npm test/lint/build, tsc, vitest, Python unittest, read-only git, GitHub and Supabase reads). **ask** = push, reset, rebase, delete, installs, workflow edits, live coach-news script, PR creation, every Supabase write. **deny** = reads of `data-local/`, CSVs, backups, `.env*`, keys; shell readers on those paths; force-push and push to `main`; merge/auto-merge/delete on GitHub; Supabase delete/pause/restore; unused connectors (Sentry, PostHog, Netlify, Gmail, Drive). | Read `Read(data-local/x.csv)` and run `cat data-local/x.csv`: both are blocked. `git push` prompts (in a trusted, interactive session). `npm test` does not prompt. |
| `.claude/hooks/stop-tests.mjs` | When Claude finishes, run `npm test`. Pure Node, so it behaves the same on Windows and Linux. Loop guard (`stop_hook_active`), 90 s timeout, fails open on any hook error. Skips with a notice when `node_modules` is missing. | See "Testing the hook" below. |
| `.claude/agents/reviewer.md` | Read-only reviewer against this repo's rules (test with every change, no innerHTML, unknown shows "-" not 0, theme tokens, no secrets, backup versioning). Tools: Read, Grep, Glob, read-only git. | `claude --agent reviewer "Review my uncommitted changes"`. |
| `.claude/agents/verifier.md` | Runs tests, tsc, lint, Python tests and reports PASS/FAIL/NOT RUN with skipped counts. Never edits, installs, pushes or deletes. | `claude --agent verifier "Run your checks"`. |
| `.claude/skills/ui-change/` | Repeated task 1: reworking Today/Workout screens. Logic in `src/lib` first, theme tokens, contrast test, 390 px screenshot. | Ask: "Use the ui-change skill to ...". |
| `.claude/skills/coach-content/` | Repeated task 2: Coach EQ banter/news. Encodes the design rules from `docs/coach-eq.md`; forbids live API calls without asking. | Ask: "Use the coach-content skill to ...". |
| `.claude/skills/garmin-sync/` | Repeated task 3: Garmin import/sync and failure messages. Offline tests only; no live Garmin, no deploy, no secrets in messages. | Ask: "Use the garmin-sync skill to ...". |
| `.gitignore` (+1 line) | Keeps your personal `.claude/settings.local.json` out of git. | `git check-ignore .claude/settings.local.json` prints the path. |
| `AUDIT.md`, `SPEC.md` | The evidence and the approved plan. Move to `docs/` if you want a tidy root. | n/a |

## Testing the hook

From the repo root, with dependencies installed:

    echo '{"stop_hook_active":false}' | node .claude/hooks/stop-tests.mjs; echo $?      # healthy: silent, 0
    echo '{"stop_hook_active":true}'  | node .claude/hooks/stop-tests.mjs; echo $?      # loop guard: 0
    EQFIT_STOP_TIMEOUT_MS=1000 node .claude/hooks/stop-tests.mjs </dev/null; echo $?   # timeout: notice, 0

To see it block: add a throwaway test with `expect(1).toBe(2)`, run the first command (exit 2 with the error), delete the test. `EQFIT_STOP_TIMEOUT_MS` lets you shorten or lengthen the 90 s limit.

## What was verified, and what was not

Run during the build, with output seen:

- `CLAUDE.md`: 47 lines; fresh headless sessions answered both questions correctly.
- Permissions: Read of a dummy `data-local/x.csv` blocked; `cat` of it blocked; `npm test` ran without a prompt; `git push` needed permission in a headless session.
- Stop hook: healthy = silent exit 0; failing test = exit 2 with the real error; second stop with `stop_hook_active` = exit 0; 1 s timeout = notice, exit 0, no leftover processes. It also fired inside a real headless Claude session and made the agent react to the failing tests.
- Reviewer, on a deliberately broken file: found `dangerouslySetInnerHTML`, `?? 0` for an unknown value, a hard-coded colour and the missing test.
- Verifier: on the broken tree reported FAIL with the real assertion text and "12 skipped, not full verification"; on the clean tree reported PASS 495/29 with the same skip note.
- Baseline of the repo as built: vitest 495 passed, 12 skipped; tsc clean; lint clean; Python unittest 29 passed.

Not verified, stated plainly:

- **Supabase rule checks (SPEC check f).** The Supabase connector was not attached when I tested, so "execute_sql prompts, delete_branch refused" is written but untested.
- **Allow list in headless mode.** Claude Code ignores `allow` rules until the workspace is trusted. I did not edit your `~/.claude.json` to trust it; my headless tests passed the same commands with `--allowedTools` instead.
- **The cloud container I ran in auto-approved an `ask` rule** (a dry-run `git push` ran without a prompt). The same rule did prompt in a headless session. On your machine, check once that `git push` prompts.
- **Reviewer/verifier boundary attempts.** Neither agent attempted a forbidden action when asked; both declined on their own instructions. Their tool lists contain no write, delete or push tool, but a refused attempt was not observed.
- **Deny rules are best effort.** They block the Read tool and common shell readers on those paths. A determined shell command (a different program, a path trick) can get around text matching. The real protection is that the real data lives only on your Windows machine, not in the repo.
- **Windows.** Nothing here was run on Windows. The hook uses `shell: true` only on Windows to start `npm.cmd`, and Windows process-tree kill uses `taskkill`; both are untested.
- **Real-data tests** (golden, backup-real: 12 tests) skip without `data-local/Activities.csv`, so "tests pass" never covers them.
- **Push.** GitHub write access was denied (403) during this session, so none of this has been pushed. The commits exist only on branch `claude/unmerged-prs-status-5w9mw7` in the build container until you reconnect GitHub.

## Skill checks on real history

Each skill was run headless in a scratch worktree at the parent of a real commit, given only the PR title. Nothing was committed or pushed; the worktrees were discarded. "Real files" are the files the real commit changed.

| Skill | Real task | Real files | What the skill run changed | Result |
|---|---|---|---|---|
| `garmin-sync` | #28 `cc97434` "Distinguish Garmin download, validation and device save failures" | `syncFailure.ts`, `CloudSync.tsx`, `syncFailure.test.ts` | the same 3 files, plus a docs line | **Pass.** Failing test first, then fix; tests 440 passed / 12 skipped, tsc, lint, Python (16) clean. Reviewer caught that non-storage errors were blamed on storage; fixed and tested. |
| `coach-content` | #38 `9969ec3` "Balance news humour topics and prevent repeated events" | `coach.ts`, `coachNews.ts`, `CoachEQ.tsx`, `generate_coach_news.py`, `docs/coach-eq.md`, `coachNews.test.ts`, `test_coach_news.py` | 5 of the 7 (missed `coachNews.ts` and `CoachEQ.tsx`) | **Pass with caveats.** Failing test first, then fix; 488 passed / 12 skipped, tsc and lint clean, no live API call. Caveats: the run reverted its own edits to get a before-fix failure and had to re-apply them by hand (it said so); it ran only `test_coach_news` (10 tests), not the full Python suite. |
| `ui-change` | #24 `f16c43f` "Reduce Today scrolling with collapsed tools" | `Routines.tsx`, `Today.tsx`, `today.css` | `today.ts`, `Today.tsx`, `today.css`, a test, a docs paragraph (2 of 3 real files) | **Partial, not a pass.** Logic + test + contrast + tsc + lint fine (427 passed / 12 skipped), but it skipped the 390 px screenshot, which the skill requires. That step is possible here (I confirmed `playwright-core` plus the preinstalled Chromium takes one), so I rewrote step 6 with exact instructions. **The rewritten step has not been re-run.** The worktree also showed edits to `bigFour.ts`, `ActivityPulse.tsx`, `bigFour.test.ts` that the run says it did not make; I could not trace where they came from, so treat that run's file list as unreliable. |

What this does and does not show:

- In all three runs the nested `verifier` agent was denied Bash (the headless workspace was untrusted, so the allow list was ignored), so each run ran the checks itself. Once you accept the trust dialog the verifier's commands are allowed by `settings.json`; that path was shown working earlier only with `--allowedTools`.
- The `reviewer` agent ran in two of the three and gave useful findings (docs missing; storage blamed for non-storage errors).
- Matching the real commit's file list is a rough signal, not proof the change is as good. I did not compare the code line by line.
- No run built the app (`npm run build`), opened it in a browser, or used real data.

## Rules for the future

- Every correction you give Claude becomes one line under **Mistakes** in `CLAUDE.md`.
- Never use `--dangerously-skip-permissions` in this repo: the deny rules for personal data and the ask rules for push/deploy exist for a reason.
- Merging to `main` deploys the site and can trigger the hourly private sync. Merge by hand, after reading the diff.
