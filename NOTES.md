# Notes (things noticed, deliberately not acted on in Stage 1)

- Pool Swim rows: Distance is in metres ("1,650") and pace is per 100 m. distance_km and avg_pace_sec_per_km are stored as null for Pool Swim; raw values are preserved. Confirm units before Stage 2 comparisons.
- Cycling, Indoor Cycling and Golf rows have decimal "Avg Pace" values (km/h style, e.g. 21.9). Not parsed as pace (null, raw kept).
- Min/Max Elevation also carry the leading apostrophe on negatives (not only Body Battery Drain); the same one-apostrophe rule is applied to them.
- Time can be "mm:ss.s" (8 rows) as well as "hh:mm:ss(.s)"; both handled. Best Lap Time / Moving Time can be "--:--:--" (null).
- Three timestamps occur twice in the real file (simultaneous activities); both rows kept.
- Strict import: any cell that fails to parse blocks the whole file (all or none). Real file has 0 parse errors.
- Recent view window = 28 days ending on the latest imported activity date (not today's date), so it equals the handoff window.
- Layout at 390 px: week labels and activity lines wrap (readable, not broken); disabled import button has low contrast.
- vite build empties dist/; in this build session deletes were not permitted, so the final verification build used --emptyOutDir false.
- Keyboard navigation was not properly tested.

## Stage 2 notes
- Running comparison uses the stored (rounded-to-the-second) exported pace, weighted by distance, as briefed. Duration/distance would give slightly different pace values; not used.
- "Today" is the browser's local date. `?today=YYYY-MM-DD` in the URL overrides it (used for checks only).
- Completion today = done workouts + imported weights/run activities not linked to any workout. A done manual workout plus an unlinked watch activity on the same day counts as 2 until you link them.
- Sets can be added and removed but not edited. Workout removal deletes its sets (app records only).
- Baseline per week uses the 4 complete weeks before the selected week; rounds to 1 decimal.

## Stage 3 notes
- Renamed to "EQ Fit" in header, page title, README, package name/description. Internal class RecompDB and the IndexedDB name "recomp" were left unchanged on purpose so existing browser data stays visible. Folder and branches not renamed.
- RECOMP_APP_SPEC.md on G: had no "v2 changes" section when read in this session (4811 bytes, same content as before although its modified time changed; Drive sync may be pending). Stage 3 was built from the coordinator's written brief instead.
- A working set with missing load or reps still counts as a set in weekly counts; it just has no e1RM.
- Per-session e1RM source set = highest Epley among eligible working sets; a 1-rep set is the actual lift.
- Progression increment (2.5 kg) is wording only, not computed.
- Hint uses the last session containing the exercise; a pain note on ANY set (warm-up included) of that session blocks it.

## Themed Today screen notes (stage-3-theme)
- The designer's reference images show "TM" next to the wordmark, a fake status bar and a clock. None of those are built (hard stop); the wordmark is plain text.
- References put Alternative at 82.5 x 6; the app computes 82.5 x 7 for 80 x 8 (Epley e1RM 101.33 vs 101.75). 82.5 x 6 is demo only.
- Last-week "lifts" = imported weights-group entries (Cardio and Strength Training per the existing mapping) in the last complete Mon-Sun week; "-" if the import does not reach that week. A partially imported week would show partial numbers.
- Start opens the first PLANNED weights workout today, else creates the same blank planned weights session as "Add weights session". It does not reopen a done session.
- Rep-range rule: if last reps + 1 would pass your rep_max and the existing hint says "increase", the target is last load + 2.5 kg at your rep_min (assumption: the brief did not say which reps); if the hint says stay, only Last time and the existing hint text show.
- Hero shows the first planned exercise with a usable prior session; an earlier planned exercise with no history is skipped.
- Out of scope ideas: PR alert after logging a set, per-exercise load increments, Week/Lift/Run redesign, a JSON backup of the theme preference (it is deliberately not part of backups).
- `npm audit` reports moderate dev-dependency advisories in vitest/vite tooling (pre-existing; fix is a breaking major bump). Not touched.
- Windows: `npm install` adds `@fontsource-variable/archivo`; after pulling this branch run `npm install` again.

## Stage 4 notes (stage-4-install)
- Negative zero: the real export has `'-0` cells (27 Min Elevation rows and 2 Max Elevation rows) stored as -0. For backup purposes -0 and 0 are equal: the backup writes 0 and the real-data deep-equal is zero-sign-insensitive; raw_row and raw_fields keep the original text, and the Stage 1 parser and stored data are unchanged. Any other lossy difference makes the export refuse.
- The brief's DoD asks for a real-data round trip; `tests/backup-real.test.ts` does it (skipped when `data-local/Activities.csv` is absent). The real backup is about 9.2 MB.
- Backup fixture is `tests/fixtures/oracle-backup-expected.json`, not `oracle-backup.json`: the existing `.gitignore` pattern `*-backup.json` would have hidden it. `eq-fit-backup*.json` was added to `.gitignore`.
- Restore replaces and never merges; it does not clear the migration ledger; the theme preference and the last-backup time live in localStorage and are not part of a backup. After a restore the last-backup time is unchanged on purpose (a restore is not a backup).
- "Last backup" records when the file was created, not that it reached a safe place.
- The service worker is cache-first for the app shell. A new build is detected by a content-hashed cache name; it waits until you tap Update now (no automatic skipWaiting).
- Icons are generated by `scripts/make-icons.py` (Playwright + Pillow) from the self-hosted Archivo italic, and re-encoded so they hold no metadata chunks. The PNGs are committed; the script only needs to run if the mark changes.
- Out-of-scope ideas (not built): a scheduled reminder via notifications, export a backup straight to a cloud folder, encrypt backups with a passphrase, an in-app install button, a diff view before restore, remembering the last restore time, a compact CSV of activities.
- `npm audit` dev-dependency advisories are unchanged from Stage 3.
- Windows: after pulling this branch run `npm install` (no new dependencies were added, but `package.json` is now version 0.4.0). `npm run build` writes `dist/sw.js`.
