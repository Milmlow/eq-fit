import { useCallback, useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, SetRecord, Workout } from '../db/types';
import { bestE1rm, hintText, progressionHint, weeklyWorkingSets, type WeekSets } from '../lib/lifting';
import { formatSet } from '../lib/training';
import { StrengthChart } from './StrengthChart';
import { IconLift } from './Icons';
import { MovementArt } from './MovementArt';
import { loadMode } from '../lib/strengthProgress';
import { localToday } from '../lib/today';
import { Badge } from './Badge';
import { EditExercise, SetEditForm } from './WorkoutEditor';

interface Session { workout: Workout; sets: SetRecord[] }

export function Lifting({ repo, version, onChanged }: { repo: Repo; version: number; onChanged: () => void }) {
  const [weeks, setWeeks] = useState<WeekSets[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [history, setHistory] = useState<Record<string, Session[]>>({});
  const [error, setError] = useState('');
  const [sel, setSel] = useState<string>('');

  const load = useCallback(async () => {
    const all = await repo.allSetsWithContext();
    setWeeks(weeklyWorkingSets(all.map((a) => ({ ...a.set, date: a.workout.date, muscles: a.exercise.primary_muscles }))));
    const exercises = await repo.listExercises();
    setExercises(exercises);
    const entries = await Promise.all(exercises.map(async ex => [ex.id, await repo.exerciseHistory(ex.id)] as const));
    setHistory(Object.fromEntries(entries));
  }, [repo]);
  useEffect(() => { void load().catch(()=>setError('Could not load strength history. Please retry.')); }, [load, version]);

  if (!weeks) return <p>Loading...</p>;
  return (
    <section aria-labelledby="lift-h">
      <p className="eyebrow">YOUR STRENGTH</p><h2 id="lift-h">Small steps. Real progress.</h2>
      <p className="muted small">Saved on this device · back up from More.</p>
      {error && <p role="alert">{error}</p>}
      <div className="exercise-cards">{exercises.map(ex=>{
        const sessions=history[ex.id]??[];
        const last=sessions.at(-1),working=last?.sets.filter(s=>!s.warmup)??[];
        const best=working.at(-1);
        const art=/bench/i.test(ex.name)?'Bench press':/squat/i.test(ex.name)?'Squat':/chin|pull.?up/i.test(ex.name)?'Chin-ups':/deadlift/i.test(ex.name)?'Deadlift':null;
        return <button key={ex.id} className={`exercise-progress-card ${sel===ex.id?'selected':''}`} aria-pressed={sel===ex.id} onClick={()=>setSel(ex.id)}>{art?<MovementArt name={art}/>:<IconLift/>}<span><strong>{ex.name}</strong><small>{ex.equipment||'Equipment unspecified'}</small><b>{best?formatSet(best):'Log your first set'}</b><small>{last?`${last.workout.date} · ${sessions.length} ${sessions.length===1?'session':'sessions'}`:'No history yet'}</small></span><span aria-hidden="true">↗</span></button>;
      })}</div>
      {sel && exercises.find(ex=>ex.id===sel) && <section className="card"><h3>{exercises.find(ex=>ex.id===sel)!.name}</h3><StrengthChart key={sel} exercise={exercises.find(ex=>ex.id===sel)!} sessions={history[sel]??[]} today={localToday()}/></section>}


      <details className="card">
        <summary>Weekly working sets per muscle</summary>
        <p className="muted" data-testid="convention">
          Counting rule: working sets only (warm-ups are excluded). Each set counts toward the primary muscle(s) you entered for its exercise,
          once per muscle; assisting muscles are not added. Weeks run Monday to Sunday. About 10 working sets per muscle per week is a common
          reference, not a target. Sets for exercises with no muscles entered appear as "{'unassigned'}".
        </p>
        {weeks.length === 0 && <p className="empty" data-testid="weekly-empty">No working sets logged yet.</p>}
        {weeks.map((w) => (
          <div key={w.weekStart} data-testid={`wk-${w.weekStart}`}>
            <h4 className="flush">{w.weekStart} to {w.weekEnd} <span className="muted">({w.workingSets} working sets)</span> <Badge kind="computed" /></h4>
            <table>
              <thead><tr><th scope="col">Muscle</th><th scope="col">Sets (n)</th></tr></thead>
              <tbody>
                {Object.entries(w.muscles).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m, n]) => (
                  <tr key={m} data-testid={`mus-${w.weekStart}-${m}`}><th scope="row">{m}</th><td className="num">{n}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </details>

      <div className="card">
        <h3>Exercise history</h3>
        {exercises.length === 0 ? <p className="empty">No exercises yet. Add one from the Today screen.</p> : (
          <label className="field">Exercise
            <select value={sel} onChange={(e) => setSel(e.target.value)} data-testid="ex-select">
              <option value="">Choose...</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}{e.equipment ? ` (${e.equipment})` : ''}</option>)}
            </select>
          </label>
        )}
        {sel && <History key={sel + version} repo={repo} exerciseId={sel} onChanged={() => { void load(); onChanged(); }} />}
      </div>
    </section>
  );
}

function History({ repo, exerciseId, onChanged }: { repo: Repo; exerciseId: string; onChanged: () => void }) {
  const [ex, setEx] = useState<Exercise | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEx((await repo.getExercise(exerciseId)) ?? null);
    setSessions(await repo.exerciseHistory(exerciseId));
  }, [repo, exerciseId]);
  useEffect(() => { void load(); }, [load]);

  if (!ex) return null;
  const last = sessions[sessions.length - 1];
  const mode = loadMode(ex);
  const hint = mode === 'external' ? progressionHint(ex.rep_max ?? null, last?.sets ?? []) : null;
  const newestFirst = [...sessions].reverse();

  async function guard(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); await load(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div data-testid="history">
      <h4 className="flush">{ex.name}{ex.equipment && <span className="muted"> ({ex.equipment})</span>}</h4>
      <p className="muted flush">
        Muscles: {ex.primary_muscles.length ? ex.primary_muscles.join(', ') : 'unassigned'}
        {ex.rep_min != null && ex.rep_max != null ? ` | rep range ${ex.rep_min}-${ex.rep_max}` : ' | no rep range'}
      </p>
      <details><summary>How estimates work</summary><p className="muted">
        Estimated 1RM uses working sets of this exact exercise and equipment only. Epley = load x (1 + reps / 30). Brzycki = load x 36 / (37 - reps).
        A single rep is shown as the actual lift, not an estimate. Estimates above about 10 reps are low confidence. A missing load or reps gives no estimate.
      </p>
      </details>
      <EditExercise ex={ex} onSave={(p) => guard(() => repo.updateExercise(ex.id, p))} />
      {error && <p role="alert" className="error">{error}</p>}
      {hint
        ? <p className="hint" data-testid="hint">Progression idea <Badge kind="proposed" /> {hintText(hint)}</p>
        : <p className="muted" data-testid="no-hint">{mode !== 'external' ? 'No automatic load increase is suggested for this equipment.' : ex.rep_max ? 'No progression hint (no sets logged).' : 'No progression hint: enter a rep range first.'}</p>}
      {sessions.length === 0 && <p className="empty">No sets logged for this exercise.</p>}
      {newestFirst.map((s) => {
        const best = mode === 'external' ? bestE1rm(s.sets) : null;
        return (
          <div key={s.workout.id} className="session" data-testid={`sess-${s.workout.date}`}>
            <h5 className="flush">{s.workout.date}{s.workout.name && ` ${s.workout.name}`} <Badge kind="reported" /></h5>
            <ol className="sets">
              {s.sets.map((x) => (
                <li key={x.id}>
                  {editing === x.id
                    ? <SetEditForm set={x} onCancel={() => setEditing(null)} onSave={async (i) => { await repo.updateSet(x.id, i); setEditing(null); await load(); onChanged(); }} />
                    : <>
                        <span>{formatSet(x)}{x.pain_note && <> <span className="pain">pain: {x.pain_note}</span></>}</span>
                        <button aria-label={`Edit set ${x.ordinal} on ${s.workout.date}`} onClick={() => setEditing(x.id)}>Edit</button>
                      </>}
                </li>
              ))}
            </ol>
            <p className="e1rm" data-testid={`e1rm-${s.workout.date}`}>
              Estimated 1RM <Badge kind="computed" />{' '}
              {best === null ? <span className="muted">{mode === 'external' ? 'not available (needs a working set with load and reps)' : 'not applied to this equipment'}</span>
                : best.actual ? <>actual lift {best.load} kg x 1 (not an estimate)</>
                : <>Epley {best.epley} kg | Brzycki {best.brzycki} kg, from {best.load} kg x {best.reps}{best.lowConfidence && <strong> (low confidence: over 10 reps)</strong>}</>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
