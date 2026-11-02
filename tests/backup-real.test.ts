// Real-data round trip (skipped when data-local/Activities.csv is absent, like the golden tests). Nothing here is written to disk.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TABLE_NAMES, normalizeNegativeZero, serializeBackup, validateBackup } from '../src/lib/backup';
import { buildPreview, commitPreview } from '../src/lib/importer';
import { freshRepo } from './helpers';

const CSV = new URL('../data-local/Activities.csv', import.meta.url);
const have = existsSync(CSV);
if (!have) console.warn('REAL-DATA BACKUP TEST SKIPPED: data-local/Activities.csv not present');

describe.skipIf(!have)('backup round trip on the real import (2698 activities)', () => {
  it('import, add training data, back up, wipe, restore: every table deep-equal', async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(new Uint8Array(readFileSync(CSV)), repo, 'Activities.csv'), repo);
    const ex = await repo.createExercise('Bench Press', 'Barbell', ['Chest']);
    await repo.updateExercise(ex.id, { rep_min: 5, rep_max: 8 });
    const w = await repo.createWorkout({ date: '2026-11-01', name: 'Push', kind: 'weights', status: 'done' });
    await repo.addSet(w.id, ex.id, { load_kg: 80, reps: 8, rir: 2, warmup: false, pain_note: null });
    const acts = await repo.activitiesBetween('2026-11-01', '2026-11-01');
    if (acts.length) await repo.linkActivity(w.id, acts[0].id);
    await repo.setTypeMapping('Cardio', 'weights');
    const g = await repo.createGoal({ kind: 'km_per_week', name: 'Weekly km', target: 25, muscle: null, include_treadmill: false }, '2026-11-02');
    await repo.reviseGoal(g.id, { target: 30 }, '2026-11-09');
    await repo.saveCheckin({ date: '2026-11-02', weight_kg: 81.5, waist_cm: 89, note: 'real-data check' }, '2026-11-02');

    // zero-sign-insensitive compare: the stored -0 (from "'-0" cells) is expected to come back as 0; everything else must be identical
    const before = normalizeNegativeZero(JSON.parse(JSON.stringify((await repo.exportBackup(new Date(0))).tables)));
    const text = serializeBackup(await repo.exportBackup());
    for (const t of TABLE_NAMES) await repo.db[t].clear();
    const v = validateBackup(text);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.counts.activities).toBe(2698);
    if (v.ok) await repo.restoreBackup(v.backup);
    expect(await repo.countActivities()).toBe(2698);
    const after = normalizeNegativeZero(JSON.parse(JSON.stringify((await repo.exportBackup(new Date(0))).tables)));
    for (const t of TABLE_NAMES) expect(after[t], t).toEqual(before[t]);
    console.log(`real backup: ${(text.length / 1048576).toFixed(2)} MB, counts ${JSON.stringify(v.ok ? v.counts : {})}`);
  });
});
