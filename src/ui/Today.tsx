import { useCallback, useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Activity, Workout, WorkoutKind } from '../db/types';
import { Badge } from './Badge';
import { WorkoutEditor } from './WorkoutEditor';

type Act = Activity & { group: string };

export function Today({ repo, today, version, onChanged }: { repo: Repo; today: string; version: number; onChanged: () => void }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [completed, setCompleted] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [w, a, c, linked] = await Promise.all([
      repo.workoutsBetween(today, today), repo.activitiesBetween(today, today), repo.completionForDate(today), repo.linkedActivityIds(),
    ]);
    setWorkouts(w);
    setActs(a.filter((x) => x.group !== 'other' && !linked.has(x.id)));
    setCompleted(c.total);
    setLoaded(true);
  }, [repo, today]);

  useEffect(() => { void load(); }, [load, version]);

  async function add(kind: WorkoutKind) {
    setError(null);
    try {
      const w = await repo.createWorkout({ date: today, name: '', kind });
      await load(); onChanged(); setOpen(w.id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  async function link(workoutId: string, activityId: string) {
    setError(null);
    try { await repo.linkActivity(workoutId, activityId); await load(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  const planned = workouts.filter((w) => w.status === 'planned');
  const done = workouts.filter((w) => w.status === 'done');
  const label = (w: Workout) => w.name || (w.kind === 'run' ? 'Run' : 'Weights session');

  return (
    <section aria-labelledby="today-h">
      <h2 id="today-h">Today <span className="muted">{today}</span></h2>
      {error && <p role="alert" className="error">{error}</p>}
      {loaded && (
        <p data-testid="completed-line">
          Completed today: <strong data-testid="completed-count">{completed}</strong> <Badge kind="computed" />{' '}
          <span className="muted">(a watch activity linked to a workout counts once)</span>
        </p>
      )}

      {loaded && workouts.length === 0 && acts.length === 0 && (
        <p className="empty" data-testid="today-empty">Nothing planned for today. Rest is fine, or add a session.</p>
      )}

      {planned.length > 0 && (
        <>
          <h3>Planned</h3>
          <ul className="items">{planned.map((w) => (
            <li key={w.id}><span>{label(w)}</span><button onClick={() => setOpen(w.id)}>Open</button></li>
          ))}</ul>
        </>
      )}
      {done.length > 0 && (
        <>
          <h3>Done</h3>
          <ul className="items">{done.map((w) => (
            <li key={w.id}><span>{label(w)}{w.linked_activity_id && ' (linked to watch activity)'}</span><button onClick={() => setOpen(w.id)}>Open</button></li>
          ))}</ul>
        </>
      )}
      {acts.length > 0 && (
        <>
          <h3>Imported activities today</h3>
          <ul className="items">{acts.map((a) => (
            <li key={a.id}>
              <span>{a.title} <span className="muted">[{a.original_type}]</span>{' '}
                {a.duration_seconds !== null ? `${(a.duration_seconds / 60).toFixed(0)} min` : 'no duration'} <Badge kind="measured" /></span>
              {workouts.filter((w) => !w.linked_activity_id).length > 0 && (
                <LinkPicker label={`Link ${a.title} to workout`} workouts={workouts.filter((w) => !w.linked_activity_id)} nameOf={label} onLink={(wid) => link(wid, a.id)} />
              )}
            </li>
          ))}</ul>
        </>
      )}

      <div className="row gap wrap big">
        <button className="primary" onClick={() => void add('weights')}>Add weights session</button>
        <button onClick={() => void add('run')}>Add run</button>
      </div>

      {open && <WorkoutEditor key={open} repo={repo} workoutId={open} onChanged={() => { void load(); onChanged(); }} onClose={() => { setOpen(null); void load(); }} />}
    </section>
  );
}

function LinkPicker({ label, workouts, nameOf, onLink }: { label: string; workouts: Workout[]; nameOf: (w: Workout) => string; onLink: (id: string) => void }) {
  const [sel, setSel] = useState(workouts[0]?.id ?? '');
  return (
    <span className="row gap">
      <select aria-label={label} value={sel} onChange={(e) => setSel(e.target.value)}>
        {workouts.map((w) => <option key={w.id} value={w.id}>{nameOf(w)}</option>)}
      </select>
      <button onClick={() => onLink(sel)}>Link</button>
    </span>
  );
}
