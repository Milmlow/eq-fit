---
name: coach-content
description: Use when editing Coach EQ banter, tones, characters, news sledges or the daily news script (src/lib/coach*.ts, CoachEQ.tsx, scripts/generate_coach_news.py, docs/coach-eq.md).
---
# coach-content

When: edits to `src/lib/coach*.ts`, `src/ui/CoachEQ.tsx`, `src/ui/CoachArt.tsx`, `scripts/generate_coach_news.py`, `docs/coach-eq.md`.

## Rules from the design doc (read `docs/coach-eq.md` first)
- Coach is optional and local: no access to repo write methods, credentials, the cloud client or training calculations. Keep it that way.
- Lines are grounded in verified training facts (`coachFacts.ts`); never claim a PR or an event the data does not show. Do not derive workout time from record creation time.
- Selection: one automatic line for the latest completed activity today, else a daily visit line. Historical imports do not celebrate. Jokes have a 14-day cooldown; exhaustion gives a quiet fallback, never a repeat. "Not funny" retires a line locally at once.
- Tone is a ceiling (Friendly / Cheeky / Off; Filthy only with explicit adult opt-in). No real people, copied catchphrases or likenesses.
- Coach state is not in backups. Do not add it to the backup format.
- News: sourced, current-events lines come from `scripts/generate_coach_news.py` (Claude API) at deploy. Repeated events and one-note topics are known failure modes (see tests/coachNews.test.ts, tests/test_coach_news.py).

## Steps
1. Read `docs/coach-eq.md`, the target module, and its tests (`coach.test.ts`, `coachFacts.test.ts`, `coachNews.test.ts`, `coachCharacters.test.ts`, `tests/test_coach_news.py`).
2. Write a failing test for the behaviour (e.g. same event not repeated, topics balanced, cooldown honoured), then fix.
3. NEVER run `python scripts/generate_coach_news.py` or any live API call without asking the user: it spends money and needs `ANTHROPIC_API_KEY`. Use the offline tests and fixtures.
4. Update `docs/coach-eq.md` if behaviour changed.

## How to check
- New test fails before the change and passes after (show both).
- `verifier` agent: vitest, tsc, lint and Python tests pass; report skips.
- `reviewer` agent on the diff. State that no live API call was made.
