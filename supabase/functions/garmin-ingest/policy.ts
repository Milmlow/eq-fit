export const AUDIENCE = 'https://hihqnnxnlkjfbixhcgaa.supabase.co/functions/v1/garmin-ingest';
export function allowedWorkflow(p: Record<string, unknown>): boolean {
  return p.repository_id === '1442704685' && p.repository_owner_id === '271704382'
    && p.repository === 'Milmlow/eq-fit'
    && p.ref === 'refs/heads/main'
    && p.sub === 'repo:Milmlow/eq-fit:ref:refs/heads/main'
    && p.workflow_ref === 'Milmlow/eq-fit/.github/workflows/garmin-sync-private.yml@refs/heads/main'
    && ['schedule', 'workflow_dispatch', 'push'].includes(String(p.event_name));
}
