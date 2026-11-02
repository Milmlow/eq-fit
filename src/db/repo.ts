import { newId } from '../lib/hash';
import { isGroup, resolveGroup, type Group } from '../lib/mapping';
import { recordMigrations, type RecompDB } from './db';
import type { Activity, ImportBatch, MigrationRecord } from './types';

/** The only layer the UI talks to. The UI never imports Dexie tables directly. */
export class Repo {
  constructor(readonly db: RecompDB) {}

  static async open(db: RecompDB): Promise<Repo> {
    await db.open();
    await recordMigrations(db);
    return new Repo(db);
  }

  listMigrations(): Promise<MigrationRecord[]> {
    return this.db.migrations.orderBy('version').toArray();
  }

  countActivities(): Promise<number> {
    return this.db.activities.count();
  }

  listBatches(): Promise<ImportBatch[]> {
    return this.db.batches.orderBy('imported_at').toArray();
  }

  findBatchByFileHash(sha: string): Promise<ImportBatch | undefined> {
    return this.db.batches.where('file_sha256').equals(sha).first();
  }

  async existingDedupeKeys(keys: string[]): Promise<Set<string>> {
    const rows = await this.db.activities.where('dedupe_key').anyOf(keys).toArray();
    return new Set(rows.map((r) => r.dedupe_key));
  }

  /**
   * Atomic commit: the batch record and all new activities are written in ONE transaction.
   * If anything throws, nothing is written.
   */
  async commitImport(batch: Omit<ImportBatch, 'id' | 'owner_id'>, activities: Omit<Activity, 'batch_id'>[]): Promise<ImportBatch> {
    const full: ImportBatch = { ...batch, id: newId(), owner_id: null };
    await this.db.transaction('rw', this.db.batches, this.db.activities, async () => {
      // Re-check inside the transaction so concurrent imports cannot create duplicates.
      const have = await this.existingDedupeKeys(activities.map((a) => a.dedupe_key));
      const fresh = activities.filter((a) => !have.has(a.dedupe_key));
      full.new_row_count = fresh.length;
      full.skipped_duplicate_count = batch.source_row_count - fresh.length;
      if (fresh.length === 0) return; // nothing to add: no batch record either
      await this.db.batches.add(full);
      await this.db.activities.bulkAdd(fresh.map((a) => ({ ...a, batch_id: full.id })));
    });
    return full;
  }

  // ---- type mapping (reversible) -------------------------------------------------------

  async getTypeMappings(): Promise<Map<string, Group>> {
    const rows = await this.db.type_mappings.toArray();
    return new Map(rows.map((r) => [r.original_type, r.target]));
  }

  /** Set a type mapping. Original types on activities are untouched. */
  async setTypeMapping(originalType: string, target: Group): Promise<void> {
    if (!isGroup(target)) throw new Error(`invalid group: ${target}`);
    await this.db.type_mappings.put({
      id: newId(), owner_id: null, original_type: originalType, target, updated_at: new Date().toISOString(),
    });
  }

  /** Undo a type mapping: falls back to the built-in default. */
  async clearTypeMapping(originalType: string): Promise<void> {
    await this.db.type_mappings.delete(originalType);
  }

  async setActivityOverride(activityId: string, group: Group | null): Promise<void> {
    await this.db.activities.update(activityId, { mapping_override: group });
  }

  // ---- reads ---------------------------------------------------------------------------

  async activitiesBetween(startDate: string, endDate: string): Promise<(Activity & { group: Group })[]> {
    const maps = await this.getTypeMappings();
    const rows = await this.db.activities.where('date').between(startDate, endDate, true, true).toArray();
    return rows
      .map((a) => ({ ...a, group: resolveGroup(a.original_type, a.mapping_override, maps) }))
      .sort((a, b) => (a.timestamp_local < b.timestamp_local ? 1 : a.timestamp_local > b.timestamp_local ? -1 : a.row_index - b.row_index));
  }

  async latestActivityDate(): Promise<string | null> {
    const last = await this.db.activities.orderBy('date').last();
    return last?.date ?? null;
  }

  async typeCounts(): Promise<Map<string, number>> {
    const m = new Map<string, number>();
    await this.db.activities.each((a) => m.set(a.original_type, (m.get(a.original_type) ?? 0) + 1));
    return m;
  }
}
