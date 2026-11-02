import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
let db: PGlite;
const rows = [['Running', '2026-11-03 04:00:00', 'Synthetic run', '5', '00:30:00', '6:00', '123', '']];
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261103_private_running.sql', import.meta.url), 'utf8'));
  await db.exec('set role service_role');
  await db.query('select public.eqfit_commit_sync($1, $2::jsonb, true)', [owner, JSON.stringify(rows)]);
  await db.exec('reset role');
}, 30_000);
afterAll(async () => { await db?.close(); });

describe('private database authorisation using PostgreSQL policies', () => {
  it('denies unauthenticated table access and snapshot RPC', async () => {
    await db.exec('set role anon');
    await expect(db.query('select * from public.eqfit_runs')).rejects.toThrow();
    await expect(db.query('select public.eqfit_snapshot()')).rejects.toThrow();
    await db.exec('reset role');
  });
  it('allows only the owner to read their activities and sync state', async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`);
    const own = await db.query<{ value: { rows: string[][]; state: unknown } }>('select public.eqfit_snapshot() as value');
    expect(own.rows[0].value.rows).toEqual(rows); expect(own.rows[0].value.state).toBeTruthy();
    await db.exec(`set request.jwt.claim.sub = '${other}'`);
    const theirs = await db.query<{ value: { rows: string[][]; state: unknown } }>('select public.eqfit_snapshot() as value');
    expect(theirs.rows[0].value.rows).toEqual([]); expect(theirs.rows[0].value.state).toBeNull();
    await db.exec('reset role');
  });
  it('denies authenticated users all direct and RPC writes', async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`);
    await expect(db.query('delete from public.eqfit_runs')).rejects.toThrow();
    await expect(db.query('update public.eqfit_sync_state set status = \'ok\'')).rejects.toThrow();
    await expect(db.query('select public.eqfit_commit_sync($1, $2::jsonb, false)', [owner, JSON.stringify(rows)])).rejects.toThrow();
    await expect(db.query('select public.eqfit_fail_sync($1)', [owner])).rejects.toThrow();
    await db.exec('reset role');
  });
  it('atomically upserts repeated IDs and retains the success cursor after failure', async () => {
    await db.exec('set role service_role');
    await db.query('select public.eqfit_commit_sync($1, $2::jsonb, false)', [owner, JSON.stringify(rows)]);
    const before = await db.query<{ last_success: Date }>('select last_success from public.eqfit_sync_state where owner_id = $1', [owner]);
    await db.query('select public.eqfit_fail_sync($1)', [owner]);
    const after = await db.query<{ last_success: Date; status: string }>('select last_success, status from public.eqfit_sync_state where owner_id = $1', [owner]);
    expect(after.rows[0].last_success).toEqual(before.rows[0].last_success); expect(after.rows[0].status).toBe('failed');
    expect((await db.query('select * from public.eqfit_runs')).rows).toHaveLength(1);
    const bad = [...rows[0]]; bad[6] = '';
    await expect(db.query('select public.eqfit_commit_sync($1, $2::jsonb, true)', [owner, JSON.stringify([bad])])).rejects.toThrow();
    const preserved = await db.query<{ status: string }>('select status from public.eqfit_sync_state where owner_id = $1', [owner]);
    expect(preserved.rows[0].status).toBe('failed');
    await db.exec('reset role');
  });
});
