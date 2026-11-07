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
6. Phone first: you MUST look at the screen at 390 px wide; this step is not optional and needs no install. `playwright-core` is already a devDependency and Chromium is preinstalled in cloud sessions. Build and serve: `npm run build` then `npm run preview` (127.0.0.1:4173). Then, with node: `chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })` (on Windows omit `executablePath` and use `channel: 'chrome'`), `newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })`, open the preview URL with `?today=YYYY-MM-DD` if the date matters, and `screenshot()` the changed screen in dark and one other theme (set `localStorage['eqfit.theme']`). Open the PNGs and look. If you could not do this, say "not checked at 390 px" and do not claim it fits.
7. Prefer fewer taps and less scrolling; this repo's history is mostly simplifying (collapse, compact, one primary action).

## How to check
- `tests/contrast.test.ts` passes (WCAG AA in every theme) and your new test passes.
- Run the `verifier` agent: tests, tsc and lint pass; report skipped counts.
- Run the `reviewer` agent on the diff.
- Say what you did NOT test (real phone, Safari, offline).
