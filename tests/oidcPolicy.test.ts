import { describe, expect, it } from 'vitest';
import { allowedWorkflow } from '../supabase/functions/garmin-ingest/policy';
const claims = { repository_id: '1442704685', repository_owner_id: '271704382', repository: 'Milmlow/eq-fit', ref: 'refs/heads/main', sub: 'repo:Milmlow/eq-fit:ref:refs/heads/main', workflow_ref: 'Milmlow/eq-fit/.github/workflows/garmin-sync-private.yml@refs/heads/main', event_name: 'schedule' };
describe('trusted Garmin workflow identity (after JWT signature validation)', () => {
  it('accepts the production workflow', () => expect(allowedWorkflow(claims)).toBe(true));
  it.each(['repository_id','repository_owner_id','repository','ref','sub','workflow_ref','event_name'])('rejects changed %s', key => expect(allowedWorkflow({ ...claims, [key]: 'untrusted' })).toBe(false));
  it('accepts GitHub immutable-ID subjects with the same strict claims', () => expect(allowedWorkflow({ ...claims, sub: 'repo:Milmlow@271704382/eq-fit@1442704685:ref:refs/heads/main' })).toBe(true));
  it('rejects an empty identity', () => expect(allowedWorkflow({})).toBe(false));
});
