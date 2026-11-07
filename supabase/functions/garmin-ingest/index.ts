import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.3';
import { createClient } from 'npm:@supabase/supabase-js@2.99.1';
import { AUDIENCE, allowedWorkflow } from './policy.ts';

const jwks = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'));
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
Deno.serve(async req => {
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  try {
    const header = req.headers.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return reply(401, { error: 'Unauthorized' });
    const { payload } = await jwtVerify(header.slice(7), jwks, {
      issuer: 'https://token.actions.githubusercontent.com', audience: AUDIENCE,
      algorithms: ['RS256'], maxTokenAge: '10 minutes', requiredClaims: ['exp', 'iat', 'sub'],
    });
    if (!allowedWorkflow(payload)) return reply(403, { error: 'Forbidden' });
  } catch { return reply(401, { error: 'Unauthorized' }); }
  try {
    const text = await req.text();
    if (text.length > 8_000_000) return reply(413, { error: 'Payload too large' });
    const body = JSON.parse(text);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: config, error: configError } = await db.from('eqfit_sync_owner').select('owner_id').eq('singleton', true).single();
    if (configError || !config?.owner_id) return reply(409, { error: 'Owner setup required' });
    if (body.action === 'state') {
      const { data, error } = await db.from('eqfit_sync_state').select('last_success,last_full_sync').eq('owner_id', config.owner_id).maybeSingle();
      if (error) throw error;
      return reply(200, { state: data });
    }
    if (body.action === 'commit') {
      if (!Array.isArray(body.rows) || body.rows.length > 15000 || typeof body.full !== 'boolean') return reply(400, { error: 'Invalid payload' });
      const ids = new Set();
      for (const row of body.rows) {
        if (!Array.isArray(row) || row.length !== 8 || row.some(x => typeof x !== 'string' || x.length > 1000)
          || !/^[1-9]\d{0,29}$/.test(row[6]) || ids.has(row[6]) || !['Running','Treadmill Running','Strength Training','Cardio','HIIT','Cycling','Indoor Cycling','Walking','Elliptical','Stair Stepper','Indoor Rowing','Rowing','Swimming'].includes(row[0])) return reply(400, { error: 'Invalid row' });
        ids.add(row[6]);
      }
      const { error } = await db.rpc('eqfit_commit_sync', { p_owner: config.owner_id, p_rows: body.rows, p_full: body.full });
      if (error) throw error;
      return reply(200, { ok: true });
    }
    if (body.action === 'failed') {
      const { error } = await db.rpc('eqfit_fail_sync', { p_owner: config.owner_id });
      if (error) throw error;
      return reply(200, { ok: true });
    }
    return reply(400, { error: 'Invalid action' });
  } catch { return reply(500, { error: 'Private sync failed' }); }
});
