# Private Garmin sync — live

## Implemented infrastructure

Dedicated project `eq-fit` in EQ Solutions, Sydney (`hihqnnxnlkjfbixhcgaa`). Public app URL and existing IndexedDB history are retained. The private tables and migrations are applied. RLS is enabled for all three tables; anonymous reads and browser writes are denied. The deployed `garmin-ingest` Edge Function rejects anonymous requests (HTTP 401 verified).

GitHub Actions authenticates using short-lived OIDC, verified against GitHub signing keys, issuer, exact audience, immutable repository and owner IDs, main branch, exact workflow path, and allowed event types. The gateway JWT check is disabled because the function performs its own GitHub JWT authentication. The function's built-in service credential never leaves Supabase. GitHub needs only the already-configured Garmin secret, plus `id-token: write`; no new privileged secret needs copying.

## Activation status

The configured owner is bound to the requested private account. The hourly schedule is enabled and the production Pages bundle has its public project URL, publishable key and owner UUID. The first live GitHub OIDC-authenticated import completed successfully with 473 runs and 473 distinct Garmin IDs on 3 November 2026 (Sydney).

GitHub now emits immutable-ID subjects for this repository. Both the exact original and immutable-ID subject forms are supported, while repository ID, owner ID, ref, workflow path, audience, issuer and signature checks remain mandatory. The initial 403 was fixed by accepting this exact authenticated subject, not by relaxing repository/workflow checks.

A one-time account setup function is used only for the authorized account and is protected by a random credential whose hash is deployed server-side. It must be disabled after delivering the user's activation link. No account-setup credential or login token belongs in this repository. The user can set their own password inside EQ Fit after activating the one-time link; it is never entered in chat.

A real phone/offline test and the user's first browser sign-in remain user-device verification steps. Existing CSV overlaps are deliberately held for explicit reconciliation, so some devices may show a review prompt rather than immediately including every incoming record.

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

Unit tests cover 100 repeated syncs, edits and links, overlap review, missing values, local dates, retained deletions, owner mismatch, CSV re-import, retries and failed-cursor preservation. PostgreSQL policy tests run using PGlite with synthetic owner identities. They validate the SQL itself, not the hosted Supabase Auth configuration. Existing regression tests and production build must pass. The first real Garmin-to-database import and an authenticated owner snapshot are verified: 473 rows with 473 unique IDs. Browser and phone-specific verification must still be reported separately.

Security reference: https://supabase.com/docs/guides/database/postgres/row-level-security
