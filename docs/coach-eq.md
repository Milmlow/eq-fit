# Coach EQ — first release and trial plan

## Product decision
Keep the existing diary. Add a local, optional character beside latest activity on desktop, stacked on phones. Preserve the bottom Lift shortcut. Coach has no access to the repository write methods, credentials, cloud client, routes or training calculations. No schema migration. No AI API or audio.

Originality assessment: fitness banter and grumpy coaches are broad, familiar ideas; no claim that the category is unique. Our original execution is a clipboard bureaucrat with fictional permits, a whistle, dressing gown and recovery deckchair. No copied performer, likeness, catchphrase catalogue or voice. The first vector expressions are deliberately simple; refine them based on trial feedback. A tiny fictional trophy decorates office banter; earned-improvement and early-start reactions await explicit, tested evidence adapters. Do not derive workout time from record creation time. No PR claims in this release.

## Implemented
- 70 original editorial entries: visit, recorded run and recorded lifting. Full ID/text/tone/event/requiredFacts/exclusions/expression/cooldown/fallback contract in `src/lib/coach.ts`.
- Preview before enabling; Cheeky suggested, Friendly available, Off available, Filthy requires explicit adult opt-in. Chosen intensity is a ceiling, not a promise every line swears.
- One automatic selection for the latest completed activity dated today, or a daily visit if none. Historical imports do not celebrate anew. Existing ActivityPulse determines completion; suggested sets are not an input.
- Stable activity/workout aliases survive linking and corrections. Cached line persists across reopening. Changing kind invalidates incompatible lines. Deleted or backdated activity changes context. No animation celebrating an old event.
- Another one is deliberate; recent jokes have a 14-day cooldown. Exhaustion produces a quiet fallback rather than repeating. Not funny retires the line locally. Tone change explicitly requests a preview-selected new line.
- Local state is namespaced by the existing database name (owner/trial separation). No raw API key is copied into Coach state.
- Coach state is **not in training backups**. Restoring to a fresh browser resets tone, cooldowns and feedback; training restore format is unchanged. Clearing browser storage also resets these controls. LocalStorage failures show a notice; the separate error boundary protects the diary.
- Vote collection is optional, on-device only, bounded to 300 votes. Turning collection off clears votes. Without consent, a dislike still retires the joke as a preference but is not counted as trial feedback. No automatic export or telemetry.

## Two-week adult mate trial
Do not treat app opens as proof of motivation. Invite a small group manually; no messages sent by this implementation. Explain local data and backup limits, optional humour and no sharing. Ask permission before collecting any observations outside their device.

Day 0: preview tones, choose voluntarily, observe time to save a normal lift. Ask what sort of banter they dislike. Days 3, 7 and 14: ask whether they returned voluntarily, kept logging, encountered repetition, muted humour, or found it slowed logging. Compare to their own pre-trial habits without causal claims. Ask “Would you miss this if we removed it?” View local vote totals only with permission. Logging duration and return rate are manual self-report/observations in this release, not hidden analytics. Card-sharing measurement starts only when Phase 2 ships. Pool exhaustion is intentionally quiet; test whether the 70-entry mix is enough before expanding.

## Phase 2 — reviewable local-photo slice (not implemented)
1. Explicit file picker → bounded image decode → local crop/rotate → preview. Reject unsupported/oversize files with a useful message. Render to canvas with our own illustrations and selected visible workout fields only.
2. Offer fictional permit, newspaper and employee certificate layouts. Avoid actual alcohol approvals or health advice. User can replace/remove the photo; original bytes never go into export or persistent storage.
3. Store only resized, re-encoded crop locally in a separate asset table after explicit save. Canvas PNG/WebP export strips source metadata; test EXIF/GPS absence with fixtures. Revoke object URLs and clear pending data on removal. No face analysis, cloud upload or original-photo attachment.
4. Preview exact exported pixels. Share/download only after user action; no route, activity title, credentials or hidden records by default. Cancelled native share is not counted as sharing.
5. Proposed backup choice: training backups exclude photos by default; offer a separately labelled opt-in archive with image assets. Version manifests, limit decoded sizes, validate all entries, test crop round trip, old backup restore, omitted assets and delete/restore expectations before shipping. Removal cannot recall earlier exported cards/backups.

## Phase 3 — architecture proposal only (no cloud changes)
Keep private Garmin ingestion and local lifting outside this social system. Do not reuse trial API keys as identity or permission. Use independent authenticated adult accounts and a server-enforced relationship/share model.

Proposed tables: profiles(user_id, display_name); invites(token_hash, inviter_id, expires_at, consumed_at); connections(id, user_a, user_b, accepted_at, revoked_at); share_grants(id, owner_id, recipient_id, revoked_at); shared_cards(id, grant_id, whitelisted_summary, created_at); reactions(id, card_id, sender_id, reaction_key); comments(id, card_id, sender_id, body, hidden_at); blocks(owner_id, blocked_id); reports(reporter_id, content_id, reason, status); recipient_preferences(user_id, maximum_tone, allow_comments).

Publish a deliberately selected summary snapshot, not a pointer giving access to local history. Sharing starts off. Both sides accept connections. Every server read AND write checks identity, active connection, active grant, blocks and recipient settings. Never trust client owner IDs. Photos are omitted initially; future rendered cards require private object storage, authenticated reads, no public URLs and revocation-aware caching. Avoid long-lived signed URLs that outlive revocation. Revoke grants transactionally, deny future reads and remove cached objects where controlled; screenshots/downloads cannot be recalled.

Recipients preview acceptable reactions, control maximum intensity, mute/block, hide/remove comments and report abuse. Fixed reactions carry intensity metadata enforced server-side. Free text requires separate opt-in, length/rate limits, report queue, named moderation responsibility and documented response/deletion policy. Profanity settings alone do not moderate abuse. Sender identity is visible; no automated friend impersonation. No discovery, rankings, location, push or unattended comebacks. If push is later added, require consent plus timezone-aware quiet hours.

Release gate tests with at least accounts A/B/C and anonymous access: B cannot read A's unshared records; C cannot enumerate A/B shares or object paths; changing IDs cannot forge sender/owner; pending invitation is not access; expired/replayed invite denied; revoked grant/connection and either-direction block deny next read; hidden comments stay hidden; recipient tone enforced on writes; photos/messages never leak through list/search/export endpoints. Garmin credentials never enter these tables, payloads, logs or exports. No claim of proven isolation until implementation and adversarial tests pass.

## Phase 4 — gated experiment
Only if trial users request more and curated rotation is insufficient: review provider, minimum structured facts, server-side secrets, retention/deletion, budget, rate limits, caching and outages. Names/titles/comments remain untrusted data; validate fact use and tone then fall back to curated entries. No photo submission by default. Original voice only, manual play, no health or performance advice generation.

## Verification record
Full existing Vitest suite passed (384 tests before the final alias regression was added; 12 private-data tests skipped). Focused Coach suite then passed all 12 tests, including same-kind linking aliases. Production TypeScript/Vite build passed. Existing Python sync/export suite passed 16 tests. Browser checks covered activation, rotation, mute, light/dark/crazy presentation, a 390px phone viewport, and completion → planned correction with synthetic local data. Narrow viewport QA uses an iframe, not a physical phone. Preview is not service-worker capable: actual airplane-mode restart, private Garmin sign-in/sync and physical-device touch behaviour remain device checks; no claim that these were exercised live. The unchanged PWA cache tests passed and Coach ships in the cached application bundle with no network dependency.

## Follow-up review — 3 November 2026
PR #14 was already merged and its GitHub Pages run succeeded. A browser still running the previous service worker showed no Coach; the existing Update now control loaded the deployed Coach successfully. Do not clear training storage to update.

Fixed a cached-joke eligibility bug: Not funny now hides the current retired line immediately and stays quiet until Another one or a genuinely new event. Added twenty Friendly run/lift lines (existing IDs unchanged), so each event type has at least fourteen eligible entries at every enabled tone. This supports one selection per day in a two-week trial; repeated Another one requests can still exhaust the pool intentionally. A higher tone remains a ceiling, so later lines may be milder.

Validation: 387 tests passed; 12 private-fixture tests skipped. New regressions exercise immediate retirement, no automatic replacement, and fourteen distinct daily selections across every event/tone combination. Production build passed. The follow-up changes affect only the joke catalogue and selection policy, not training records or persistence. Physical-phone airplane-mode restart and private Garmin sync remain unverified in this session.
