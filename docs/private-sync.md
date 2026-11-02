# Private Garmin sync — implemented, activation pending

## Decision

Keep GitHub Pages and the current `recomp` IndexedDB database. Reuse the working Garmin Personal API client in an hourly GitHub Actions worker. Add one Supabase project for authentication and private running records. Do not move the app to a different origin: that would strand the existing browser's lifting history until manually restored.

Supabase is not connected in this authoring session. No live project, policies, credentials, account or real-data pipeline has been provisioned or verified. The scheduled job is gated off by `EQFIT_PRIVATE_SYNC_ENABLED`. Keep this change in draft until activation checks pass.

## One-time provisioning (operator task, not a daily user workflow)

1. Connect the Supabase plugin and select/create a dedicated personal EQ Fit project. Confirm any cost before creating paid resources. Disable public signup; create the owner's account through supported auth management, with credential entry outside chat.
2. Apply `supabase/migrations/20261103_private_running.sql`. Verify anonymous reads fail, a different authenticated user sees no records, and the owner can read only their own. Users have no writes; only the server worker can call the sync writer.
3. Set GitHub Actions secrets using the secure settings interface: existing `GARMIN_PERSONAL_API_KEY`, plus `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (legacy server JWT key), and `EQFIT_OWNER_ID`. Never put these values in chat, source, PRs, artifacts or logs. Do not retrieve the existing Garmin key.
4. Set non-secret build variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (modern `sb_publishable_` key only) and `VITE_EQFIT_OWNER_ID`. These are intentionally public configuration, not privileged credentials.
5. Verify RLS and then set repository variable `EQFIT_PRIVATE_SYNC_ENABLED=true`. Run the private worker once, check the successful timestamp and private row, deploy the app, sign in as the owner, and check that the actual run appears. Re-run and prove the same Garmin ID remains one run. Verify offline reopening on the owner's phone. Only then claim automatic sync works.

GitHub repository secret/variable write operations are not exposed by the connected GitHub tools in this session. If still unavailable, secure settings entry is a second activation dependency; do not tell the user that connecting Supabase alone completes activation.

## Behaviour and limitations

- Poll at minute 17 each hour. GitHub schedules can be delayed and public-repository schedules can be disabled after inactivity; last successful Garmin sync and overdue (>3h) status are visible. This is predictable best-effort polling, not an exact-hour SLA.
- Normal polls read the last 35 days, extending to the last successful cursor after an outage. A weekly full scan from 2000 captures older edits. More than 15,000 returned activities aborts instead of committing incomplete data. This bound includes non-running activities.
- Updates use `(owner_id, garmin_id)` and commit records plus the success timestamp atomically. Invalid pages fail closed. Retries are bounded to four attempts for HTTP 429/5xx and recognized network errors; authentication/validation failures are not repeatedly retried.
- Deletion policy: retain records absent from Garmin. Neither missing pages nor a Garmin deletion removes local history. No deletion propagation or change-of-sport removal is claimed. This policy needs a future explicit review UI if removal is desired.
- Local wall-clock date/time is preserved exactly; it is not converted through the device timezone. It is not a UTC timestamp. Pace comes from supported average speed, distance is metres/1000, and average HR is included only when present and valid.
- The app retrieves a consistent owner-filtered snapshot on sign-in/open/resume and checks once per minute while visible. The refresh button retrieves private records; it does not trigger a Garmin job.
- IndexedDB stays useful offline. Existing lifting records are neither uploaded nor overwritten. Sign-out retains downloaded records on the trusted device; this is a single-user personal app, not a shared-device privacy boundary.
- Cloud imports update matching Garmin IDs in place and retain workout links. A date overlap with an ID-less CSV is held outside totals for explicit review; date similarity never proves identity. A matched row keeps its local ID and original raw fields. Multiple legacy rows already carrying the same Garmin ID require separate repair and are left unchanged.
- Subsequent ID-less CSVs overlapping synced running dates are blocked, rather than silently inflating kilometres. CSV edits to identified rows are skipped; Garmin is authoritative for those rows.
- Backup format/schema stays v3. No table migration or destructive automatic cleanup is introduced. Reconciliation asks for a saved backup and explicit match choices.

## Verification

Unit tests cover 100 repeated syncs, edits and links, overlap review, missing values, local dates, retained deletions, owner mismatch, CSV re-import, retries and failed-cursor preservation. PostgreSQL policy tests run using PGlite with synthetic owner identities. They validate the SQL itself, not the hosted Supabase Auth configuration. Existing regression tests and production build must pass. Real Garmin-to-database-to-browser verification remains required.

Security reference: https://supabase.com/docs/guides/database/postgres/row-level-security
