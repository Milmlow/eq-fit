---
name: garmin-sync
description: Use when changing Garmin import or sync, private Supabase ingest, or sync failure messages (scripts/*garmin*.py, supabase/functions/**, src/lib/garminEncrypted.ts, cloud*.ts, syncFailure.ts, .github/workflows/garmin-*).
---
# garmin-sync

When: edits to `scripts/*garmin*.py`, `scripts/sync_garmin_private.py`, `supabase/functions/**`, `src/lib/garminEncrypted.ts`, `src/lib/cloud*.ts`, `src/lib/syncFailure.ts`, `.github/workflows/garmin-*`.

## Hard limits (ask the user first for any of these)
- No live Garmin call, no deploy of an edge function, no Supabase write (`execute_sql`, `apply_migration`, `deploy_edge_function`), no workflow edit, no push. Production sync is hourly and uses personal data.
- Never print, log or commit keys, tokens, passphrases, account ids or activity payloads. Do not read `data-local/`.
- Auth for the ingest function is GitHub OIDC with exact repo/owner id, workflow path, audience and issuer checks. Never loosen them to fix a 403; accept only the exact subject form.

## Steps
1. Read `docs/private-sync.md` (and `docs/garmin-encrypted-export.md` for the manual path), the target code and its tests: `tests/test_private_sync.py`, `tests/test_garmin_export.py`, `tests/syncFailure.test.ts`, `tests/oidcPolicy.test.ts`, `tests/cloudImport.test.ts`, `tests/garminTrial.test.ts`.
2. Work only against fixtures and mocks. Add a failing test that reproduces the failure, then fix.
3. Failure messages name the stage (`download`, `validation`, `save`) and a safe error code, never server text or payloads. Invalid pages fail closed; a bad response is never an "empty success".
4. Keep retries bounded (HTTP 429/5xx and known network errors only); auth/validation failures are not retried.
5. Keep backup schema v3 unless the stored tables change; if they do, bump version and add a migration.
6. Update `docs/private-sync.md` when behaviour changes.

## How to check
- Python: `python3 -m unittest discover -s tests -p "test_*.py"`; TS: `npm test`, `npx tsc --noEmit`, `npm run lint`.
- `verifier` agent; `reviewer` agent on the diff (secrets, fail-closed, stage names).
- State plainly what was NOT verified: live Garmin, deployed function, real phone.
