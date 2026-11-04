import type { Activity } from '../db/types';
import type { Repo } from '../db/repo';
import { buildPreview, type PreparedRow } from './importer';
import { newId } from './hash';

export const CLOUD_HEADERS = ['Activity Type', 'Date', 'Title', 'Distance', 'Time', 'Avg Pace', 'Garmin Activity ID', 'Avg HR'];
export function garminId(a: Pick<Activity, 'raw_fields'>): string | null {
  const value = a.raw_fields['Garmin Activity ID']?.trim();
  return value && /^[1-9]\d{0,29}$/.test(value) ? value : null;
}
export interface PendingRun { incoming: PreparedRow; candidates: Activity[] }
export interface CloudImportResult { changed: number; pending: PendingRun[] }

/** A date collision is a request for human review, never proof that two runs are the same. */
export function candidatesFor(incoming: PreparedRow, existing: Activity[]): Activity[] {
  const id = garminId(incoming);
  const exact = existing.filter(a => garminId(a) === id);
  if (exact.length) return exact;
  return existing.filter(a => !garminId(a) && a.date === incoming.date && (/run/i.test(incoming.original_type) ? /run/i.test(a.original_type) : a.original_type===incoming.original_type));
}

export function prepareCloudRows(value:unknown,repo:Repo):Promise<PreparedRow[]> {return prepareRows(value,repo,['Running','Treadmill Running']);}
export function prepareTrialRows(value:unknown,repo:Repo):Promise<PreparedRow[]> {return prepareRows(value,repo,['Running','Treadmill Running','Strength Training','Cardio','HIIT','Cycling','Indoor Cycling','Walking','Elliptical','Stair Stepper','Indoor Rowing','Rowing','Swimming']);}
async function prepareRows(value: unknown, repo: Repo, allowedTypes:string[]): Promise<PreparedRow[]> {
  if (!Array.isArray(value) || value.length > 15000 || value.some(r => !Array.isArray(r) || r.length !== CLOUD_HEADERS.length || r.some(v => typeof v !== 'string' || v.length > 1000))) throw new Error('Invalid private running response.');
  if (value.length === 0) return [];
  const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = [CLOUD_HEADERS, ...value as string[][]].map(r => r.map(quote).join(',')).join('\n');
  const preview = await buildPreview(new TextEncoder().encode(csv), repo, 'Private Garmin sync');
  if (preview.blocked) throw new Error('Invalid private running response.');
  const ids = new Set<string>();
  for (const row of preview.prepared) {
    const id = garminId(row);
    if (!id || ids.has(id) || !allowedTypes.includes(row.original_type) || (row.distance_km !== null && (row.distance_km < 0 || row.distance_km > 2000))) throw new Error('Invalid private running response.');
    ids.add(id);
  }
  return preview.prepared;
}

/** Stable IDs, atomic updates, no deletion. Multiple legacy copies are held for explicit repair. */
export async function applyCloudRows(repo: Repo, rows: PreparedRow[], owner: string, choices: Record<string, string | 'separate'> = {}): Promise<CloudImportResult> {
  const selected = Object.values(choices).filter(v => v && v !== 'separate');
  if (new Set(selected).size !== selected.length) throw new Error('An existing record cannot match two different Garmin runs.');
  return repo.db.transaction('rw', repo.db.activities, repo.db.batches, async () => {
    const existing = await repo.db.activities.toArray();
    const pending: PendingRun[] = [];
    const writes: Activity[] = [];
    const batchId = newId();
    for (const incoming of rows) {
      const id = garminId(incoming);
      if (!id) throw new Error('Missing Garmin identifier.');
      const matches = candidatesFor(incoming, existing);
      const exact = matches.filter(a => garminId(a) === id);
      if (exact.length > 1) { pending.push({ incoming, candidates: exact }); continue; }
      let prior = exact[0];
      if (!prior && matches.length) {
        const choice = choices[id];
        if (choice !== 'separate') {
          prior = matches.find(a => a.id === choice)!;
          if (!prior) { pending.push({ incoming, candidates: matches }); continue; }
        }
      }
      if (prior?.owner_id && prior.owner_id !== owner) throw new Error('This browser contains running data for a different account.');
      if (prior?.row_hash === incoming.row_hash && prior.dedupe_key === `garmin:${id}`) continue;
      const raw_fields = { ...incoming.raw_fields };
      if (prior) raw_fields['EQ Fit original import'] = prior.raw_fields['EQ Fit original import'] || JSON.stringify(prior.raw_fields);
      const next: Activity = { ...incoming, id: prior?.id ?? incoming.id, owner_id: owner, batch_id: batchId, dedupe_key: `garmin:${id}`, mapping_override: prior?.mapping_override ?? null, raw_fields };
      writes.push(next);
      if (prior) existing.splice(existing.indexOf(prior), 1, next); else existing.push(next);
    }
    if (writes.length) {
      await repo.db.batches.add({ id: batchId, owner_id: owner, file_sha256: `cloud:${batchId}`, file_name: 'Private Garmin sync', imported_at: new Date().toISOString(), headers: CLOUD_HEADERS, source_row_count: rows.length, new_row_count: writes.length, skipped_duplicate_count: rows.length - writes.length });
      await repo.db.activities.bulkPut(writes);
    }
    return { changed: writes.length, pending };
  });
}
