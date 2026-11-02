# Private Garmin sync — activation pending

## Implemented infrastructure

Dedicated project `eq-fit` in EQ Solutions, Sydney (`hihqnnxnlkjfbixhcgaa`). Public app URL and existing IndexedDB history are retained. The private tables and migrations are applied. RLS is enabled for all three tables; anonymous reads and browser writes are denied. The deployed `garmin-ingest` Edge Function rejects anonymous requests (HTTP 401 verified).

GitHub Actions authenticates using short-lived OIDC, verified against GitHub signing keys, issuer, exact audience, immutable repository and owner IDs, main branch, exact workflow path, and allowed event types. The gateway JWT check is disabled because the function performs its own GitHub JWT authentication. The function's built-in service credential never leaves Supabase. GitHub needs only the already-configured Garmin secret, plus `id-token: write`; no new privileged secret needs copying.

## Remaining activation work

1. Obtain the user's chosen sign-in email and establish their private Supabase Auth account through supported Auth controls. Do not invent an email, read unrelated business accounts, or assign the first arbitrary signup as owner. Bind the verified auth UUID in `eqfit_sync_owner` using the administration connection.
2. Set non-secret client build configuration: project URL, the enabled modern publishable key, and that owner's UUID. These may be committed as public configuration or supplied as build variables; never include privileged keys. Authentication and RLS protect data even though these values are public.
3. Replace the disabled schedule gate with explicit activation only after the owner is bound and tests pass. Add a trusted main-branch push trigger or run the workflow manually to verify actual OIDC authentication and a real Garmin import. The current connected GitHub tools do not provide workflow dispatch or repository-variable writes, so do not depend on those tools for activation.
4. Confirm owner sign-in and actual private records in the browser, repeated sync produces one run, and offline reopening on the user's phone. Only then claim automatic sync is complete.

The migration tests use synthetic identities. The production project currently has no configured owner and no fitness data. The OIDC worker, browser identity and real Garmin path have not yet been demonstrated end to end. Keep PR #6 in draft until verified.

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
