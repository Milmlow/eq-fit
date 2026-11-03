# Weights and momentum release

## Shipped behaviour

Repeat a completed weights session from Today. The new workout contains the exercise order, retains exact exercise/equipment identities, and starts planned with no logged sets, watch link, pain notes or session notes. Previous working sets and warm-ups are matched separately. Editable load/reps fields are only suggestions until Log set is pressed. Failed saves retain the draft and show an error. Finish session explicitly marks it done.

Lift has exercise cards and date-spaced charts for the last 56 calendar days or all saved history. Warm-ups are excluded. Load and reps are recorded maxima per session, not a strength score; missing values leave gaps. Estimated 1RM is optional and limited to explicitly recognised barbell/dumbbell/kettlebell exercises, with bodyweight/assisted names excluded. Assistance and added load have their own labels. Historic set edits refresh cards, graphs and calculations.

Week has selectable days, run/lift icons, a hollow planned count, and completed totals. Linked activities do not add a second session; their actual running distance is still counted once. Sessions can be opened from their day. Last-week hero lifting counts now include local completed sessions and exclude linked imported duplicates.

Today shows dismissible recent achievements from the last seven calendar days: heavier working sets for eligible external-load exercises in completed sessions, longest recorded outdoor runs and best recorded outdoor-distance months. A previous baseline is required; first records, warm-ups, plans and proposed targets are not records. Values are relative to saved history, not verified lifetime bests. Monthly totals include known outdoor distances. Corrections recalculate achievements. Dismissals are local, scoped to the current database, and keyed by event identity so the same event does not repeat after an edit. Clearing browser settings can reset dismissals. Bodyweight/assisted record celebrations are deliberately not inferred.

More includes feedback choices and a note. Users copy the text or open their device's share sheet and choose a recipient. There is no feedback collection endpoint and no automatic submission or sent claim.

## Data and verification

No schema or backup-format change. Existing workout, set, activity and link IDs are retained. The owner and per-key mate-trial databases remain separate. Lifting remains local; no new cloud upload is added.

Production build and 366 tests pass; 12 private-CSV tests are skipped because their fixtures are absent. New tests cover repeat preservation, suggestions without writes, equipment classification, historical corrections, linked-run counting, achieved records, corrections removing records, local offline logging/reopen/export without any fetch, and unique ordinals after deleting a middle set. Existing backup/restore, cloud isolation and PWA tests pass.

Browser QA used synthetic local data: log a 60 kg × 8 set, finish, repeat, verify zero copied logged sets and editable previous values, inspect chart first-point state and select a rest day. Responsive views were inspected in 390 px and 220 px browser frames; a narrow PR badge overflow was corrected. Real iOS/Android device interaction and airplane-mode PWA use remain device-specific checks; the HTTP QA origin cannot install a service worker.

## Main-lift quick entry

Tapping Bench press, Deadlift, Squat or Chin-ups opens a focused weight/reps/sets dialog. It selects the exact existing exercise/equipment identity when present and uses recent working-set values as editable suggestions. Large decrement/increment controls and numeric entry work together. A single explicit Save action atomically logs 1–20 identical completed sets; failures roll back the whole operation. Exercises remain in today's open weights session until Finish session is pressed. Added bodyweight load may stay unknown; assistance is labelled separately. Warm-up batches remain separate, and exercise/equipment selection is available under Details. Browser QA at 390 px saved and inspected three 62.5 kg × 8 sets.

## Session-first Today (November 2026)

Today now leads with the latest completed run/lift and a rolling 28-day dashboard through today. Outdoor pace remains distance-weighted; outdoor kilometres and completed lifting sessions are divided by four for weekly averages. Missing pace stays unknown. The existing historical calendar-week reports are unchanged.

One factual signal accompanies the latest session: more distance than the mean of at least three previous outdoor runs in 28 days; a strictly improved working set compared with the previous dated session of the same external-load exercise; return after a gap; or recorded training-day consistency. No inferred quality score, pace-based praise, first-session PR, or target treated as achievement. Recomputed from saved history, so corrections remove unsupported signals. Same-day lifting comparisons are deliberately excluded because completion times are not recorded.

Linked watch activities appear once, with their measured run metrics retained. An imported linked activity establishes completion for the recent feed even if its local plan remains unfinished. Unlinked planned lifting sessions never contribute. Small branding and Garmin status, backup reminder below Today, and collapsed next-session comparisons leave more room for training. Account, sync, storage schema and backups unchanged.

Validation: 373 tests passed, 12 private-fixture tests skipped; production build passed. Phone-width preview inspected with synthetic data. Actual device offline/PWA testing not performed in this change.
