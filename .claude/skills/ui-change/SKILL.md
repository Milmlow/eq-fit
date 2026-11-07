---
name: ui-change
description: Use when changing a screen or style in src/ui (Today, Workout, Lift, Run, More, CSS, themes). Covers keeping logic testable, theme tokens, contrast and phone-width checks.
---
# ui-change

When: any edit to `src/ui/*.tsx`, `src/ui/*.css`, or the pure logic behind a screen in `src/lib`.

## Steps
1. Read the screen, the `src/lib` module that feeds it, and its test (e.g. `Today.tsx` + `today.ts`/`todayStats.ts` + `tests/today.test.ts`). Say in one line what the user sees now and what should change.
2. Put decisions in `src/lib` (pure functions), keep JSX thin. Write or update the test first, watch it fail, then change code.
3. Colours only from tokens in `src/ui/themes.css` (blocks: dark, light, crazy, girl-power; system follows the OS). New colour = add the token to every block.
4. All imported or typed text is rendered as React text. No `innerHTML` / `dangerouslySetInnerHTML` (`tests/pwa.test.ts` scans for it).
5. Unknown values show "-" or "unknown", never 0.
6. Phone first: the screen must work at 390 px wide. Take a Playwright screenshot at 390x844 (`deviceScaleFactor` 1, `chromium.launch()` with no options) of the changed screen in dark and one other theme, and look at it. Do not claim "fits on a phone" without it.
7. Prefer fewer taps and less scrolling; this repo's history is mostly simplifying (collapse, compact, one primary action).

## How to check
- `tests/contrast.test.ts` passes (WCAG AA in every theme) and your new test passes.
- Run the `verifier` agent: tests, tsc and lint pass; report skipped counts.
- Run the `reviewer` agent on the diff.
- Say what you did NOT test (real phone, Safari, offline).
