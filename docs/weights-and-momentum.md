# Weights and momentum release

## Shipped behaviour

Repeat a completed weights session from Today. The new workout contains the exercise order, retains exact exercise/equipment identities, and starts planned with no logged sets, watch link, pain notes or session notes. Previous working sets and warm-ups are matched separately. Editable load/reps fields are only suggestions until Log set is pressed. Failed saves retain the draft and show an error. Finish session explicitly marks it done.

Lift has exercise cards and date-spaced charts for the last 56 calendar days or all saved history. Warm-ups are excluded. Load and reps are recorded maxima per session, not a strength score; missing values leave gaps. Estimated 1RM is optional and limited to explicitly recognised barbell/dumbbell/kettlebell exercises, with bodyweight/assisted names excluded. Assistance and added load have their own labels. Historic set edits refresh cards, graphs and calculations.

Week has selectable days, run/lift icons, a hollow planned count, and completed totals. Linked activities do not add a second session; their actual running distance is still counted once. Sessions can be opened from their day. Last-week hero lifting counts now include local completed sessions and exclude linked imported duplicates.

Today shows dismissible recent achievements from the last seven calendar days: heavier working sets for eligible external-load exercises in completed sessions, longest recorded outdoor runs and best recorded outdoor-distance months. A previous baseline is required; first records, warm-ups, plans and proposed targets are not records. Values are relative to saved history, not verified lifetime bests. Monthly totals include known outdoor distances. Corrections recalculate achievements. Dismissals are local, scoped to the current database, and keyed by event identity so the same event does not repeat after an edit. Clearing browser settings can reset dismissals. Bodyweight/assisted record celebrations are deliberately not inferred.

More includes feedback choices and a note. Users copy the text or open their device's share sheet and choose a recipient. There is no feedback collection endpoint and no automatic submission or sent claim.

## Data and verification

No schema or backup-format change. Existing workout, set, activity and link IDs are retained. The owner and per-key mate-trial databases remain separate. Lifting remains local; no new cloud upload is added.

Production build and 362 tests pass; 12 private-CSV tests are skipped because their fixtures are absent. New tests cover repeat preservation, suggestions without writes, equipment classification, historical corrections, linked-run counting, achieved records, corrections removing records, local offline logging/reopen/export without any fetch, and unique ordinals after deleting a middle set. Existing backup/restore, cloud isolation and PWA tests pass.

Browser QA used synthetic local data: log a 60 kg × 8 set, finish, repeat, verify zero copied logged sets and editable previous values, inspect chart first-point state and select a rest day. Responsive views were inspected in 390 px and 220 px browser frames; a narrow PR badge overflow was corrected. Real iOS/Android device interaction and airplane-mode PWA use remain device-specific checks; the HTTP QA origin cannot install a service worker.
