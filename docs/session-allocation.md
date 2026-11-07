# Weekly sessions and activity allocation

Train freely shows all sessions from Monday through today, with separate strength and cardio counts (runs count as cardio). The previous three-row cap no longer hides sessions earlier in the week. Older sessions within 14 days are collapsed below; body coverage follows the session list.

A per-session activity picker offers Strength, Walking, Running, Cycling, Rowing, Swimming, HIIT and Other cardio. Strength retains the existing body-area picker. As recorded resets the allocation. Original Garmin types and metrics remain untouched. Allocations drive the training dashboard, not the separate raw-type running averages or historical mapping configuration. No workouts are created by allocating a label.

Activity and linked-workout metadata are written atomically, count once, survive Garmin corrections and validate in backups. Tags are local to the existing profile. No database index or migration is required.

The automatic owner import previously selected only running types. Its normalizer and browser validator now accept the same mixed training types as the friend-trial import. The encrypted running export retains its run-only default. Non-running records have no running pace generated. The regular 35-day overlap recovers this week's sessions on the first updated sync; the next full audit fills older history.

Deployment: garmin-ingest version 3 is already deployed with the extended type allowlist. Authentication, workload identity checks, destination and database permissions are unchanged. An unauthenticated POST remains rejected. Merge this branch to publish the UI and trigger the updated private sync workflow. Verify both Pages and private sync before claiming sessions are available. No personal session was relabelled in this implementation.

Validation: 495 TypeScript tests passed (12 private-fixture skips), 29 Python tests passed, production build and lint passed. Coverage includes linked-record counts, allocation/reset, retained original type, backup validation, Garmin correction preserving tags and mixed-type normalization. Physical iPhone rendering and authenticated Garmin sync remain post-deployment checks.
