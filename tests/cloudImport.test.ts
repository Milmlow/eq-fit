import { describe, expect, it } from 'vitest';
import { freshRepo, csvOf, row } from './helpers';
import { applyCloudRows, prepareCloudRows } from '../src/lib/cloudImport';
import { buildPreview, commitPreview } from '../src/lib/importer';
import { serializeBackup, validateBackup } from '../src/lib/backup';

const payload = (km = '5', title = 'Run', id = '123') => [['Running', '2026-11-03 04:00:00', title, km, '00:30:00', '6:00', id, '140']];
describe('private Garmin ingestion', () => {
  it('syncing one run 100 times yields one run and one batch', async () => {
    const repo = await freshRepo();
    for (let i = 0; i < 100; i++) await applyCloudRows(repo, await prepareCloudRows(payload(), repo), 'owner');
    expect(await repo.countActivities()).toBe(1); expect(await repo.listBatches()).toHaveLength(1);
    expect((await repo.activitiesBetween('2026-11-03', '2026-11-03'))[0].distance_km).toBe(5);
    repo.db.close();
  });
  it('edits update the same ID while preserving workout links and keeping backup valid', async () => {
    const repo = await freshRepo();
    await applyCloudRows(repo, await prepareCloudRows(payload(), repo), 'owner');
    const original = (await repo.db.activities.toArray())[0];
    const w = await repo.createWorkout({ date: original.date, name: 'Run', kind: 'run' });
    await repo.linkActivity(w.id, original.id);
    await applyCloudRows(repo, await prepareCloudRows(payload('6', 'Edited'), repo), 'owner');
    expect(await repo.countActivities()).toBe(1);
    expect((await repo.db.activities.get(original.id))?.distance_km).toBe(6);
    expect((await repo.getWorkout(w.id))?.linked_activity_id).toBe(original.id);
    expect(validateBackup(serializeBackup(await repo.exportBackup())).ok).toBe(true);
    repo.db.close();
  });
  it('holds date overlaps without guessing, then retains the original ID after an explicit match', async () => {
    const repo = await freshRepo();
    const preview = await buildPreview(csvOf([row({ 'Activity Type': 'Running', Date: '2026-11-03 04:00:00', Distance: '5', Time: '00:30:00', 'Avg Pace': '6:00' })]), repo);
    await commitPreview(preview, repo);
    const original = (await repo.db.activities.toArray())[0];
    const prepared = await prepareCloudRows(payload(), repo);
    const result = await applyCloudRows(repo, prepared, 'owner');
    expect(result.pending).toHaveLength(1); expect(result.changed).toBe(0); expect(await repo.countActivities()).toBe(1);
    await applyCloudRows(repo, prepared, 'owner', { '123': original.id });
    expect(await repo.countActivities()).toBe(1); expect((await repo.db.activities.get(original.id))?.dedupe_key).toBe('garmin:123');
    expect(validateBackup(serializeBackup(await repo.exportBackup())).ok).toBe(true);
    repo.db.close();
  });
  it('different Garmin IDs on the same day remain separate', async () => {
    const repo = await freshRepo();
    await applyCloudRows(repo, await prepareCloudRows([...payload(), ...payload('5', 'Second run', '124')], repo), 'owner');
    expect(await repo.countActivities()).toBe(2); repo.db.close();
  });
  it('does not remove a run absent from a later snapshot', async () => {
    const repo = await freshRepo();
    await applyCloudRows(repo, await prepareCloudRows(payload(), repo), 'owner');
    await applyCloudRows(repo, [], 'owner'); expect(await repo.countActivities()).toBe(1); repo.db.close();
  });
  it('rejects invalid or duplicate IDs and preserves missing metrics and local dates', async () => {
    const repo = await freshRepo();
    await expect(prepareCloudRows([...payload(), ...payload()], repo)).rejects.toThrow();
    await expect(prepareCloudRows(payload('5', 'Run', ''), repo)).rejects.toThrow();
    const data = payload(); data[0][3] = ''; data[0][5] = ''; data[0][7] = '';
    const prepared = await prepareCloudRows(data, repo);
    expect(prepared[0].distance_km).toBeNull(); expect(prepared[0].avg_hr).toBeNull(); expect(prepared[0].timestamp_local).toBe('2026-11-03 04:00:00');
    repo.db.close();
  });
  it('refuses updates across owners atomically', async () => {
    const repo = await freshRepo(); await applyCloudRows(repo, await prepareCloudRows(payload(), repo), 'first');
    await expect(applyCloudRows(repo, await prepareCloudRows(payload('7'), repo), 'second')).rejects.toThrow();
    expect((await repo.db.activities.toArray())[0].distance_km).toBe(5); repo.db.close();
  });
  it('does not duplicate API runs on a subsequent identified CSV import, blocks ID-less overlap', async () => {
    const repo = await freshRepo(); await applyCloudRows(repo, await prepareCloudRows(payload(), repo), 'owner');
    const identified = await buildPreview(csvOf([payload()[0]], ['Activity Type', 'Date', 'Title', 'Distance', 'Time', 'Avg Pace', 'Garmin Activity ID', 'Avg HR']), repo);
    await commitPreview(identified, repo); expect(await repo.countActivities()).toBe(1);
    const legacy = await buildPreview(csvOf([row({ 'Activity Type': 'Running', Date: '2026-11-03 05:00:00', Distance: '5' })]), repo);
    expect(legacy.blocked).toBe(true); repo.db.close();
  });
});
