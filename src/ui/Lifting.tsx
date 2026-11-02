import { useCallback, useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, SetRecord, Workout } from '../db/types';
import { bestE1rm, hintText, progressionHint, UNASSIGNED, weeklyWorkingSets, type Hint, type WeekSets } from '../lib/lifting';
import { formatSet } from '../lib/training';
import { formatTodayLabel } from '../lib/todayStats';
import { Badge } from './Badge';
import { ScreenHead, Segmented } from './Screen';
import { EditExercise, SetEditForm } from './WorkoutEditor';

interface Session { workout: Workout; sets: SetRecord[] }
type View = 'sets' | 'history';
const dm = (d: string) => formatTodayLabel(d).slice(4);
const REFERENCE_SETS = 10; // the bar scale never goes below the common 10-sets reference, so one set does not fill the bar

const HINT_LABEL: Record<Hint, string> = { increase: 'Small load increase', stay: 'Stay at this load', review_pain_note: 'Review the pain note first' };

function WeekBars({ w }: { w: WeekSets }) {
  const entries = Object.entries(w.muscles).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const scale = Math.max(REFERENCE_SETS, ...entries.map((e) => e[1]));
  const top = entries[0]?.[1] ?? 0;
  return (
    <ul className="hbars" data-testid={`wk-${w.weekStart}`}>
      {entries.map(([m, n]) => (
        <li key={m} data-testid={`mus-${w.weekStart}-${m}`} className={`${m === UNASSIGNED ? 'un' : ''}${n === top && m !== UNASSIGNED ? ' hi' : ''}`.trim() || undefined}>
          <span className="hb-l">{m}</span>
          <span className="hb-track" aria-hidden="true"><span className="hb-fill" style={{ width: `${(n / scale) * 100}%` }} /></span>
          <span className="hb-n"><span className="sr">{m}: </span>{n}<span className="sr"> working sets</span></span>
        </li>
      ))}
    </ul>
  );
}

export function Lifting({ repo, today, version, onChanged }: { repo: Repo; today: string; version: number; onChanged: () => void }) {
  const [weeks, setWeeks] = useState<WeekSets[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sel, setSel] = useState<string>('');
  const [view, setView] = useState<View>('sets');

  const load = useCallback(async () => {
    const all = await repo.allSetsWithContext();
    setWeeks(weeklyWorkingSets(all.map((a) => ({ ...a.set, date: a.workout.date, muscles: a.exercise.primary_muscles }))));
    setExercises(await repo.listExercises());
  }, [repo]);
  useEffect(() => { void load(); }, [load, version]);

  const head = <ScreenHead id="lift-h" title="Lifting" today={today} />;
  if (!weeks) return <section aria-labelledby="lift-h">{head}<p>Loading...</p></section>;
  return (
    <section aria-labelledby="lift-h" className="screen">
      {head}
      <Segmented label="Lifting view" name="lift-view" value={view} options={[{ value: 'sets', label: 'Weekly sets' }, { value: 'history', label: 'Exercise history' }]} onChange={setView} />

      {view === 'sets' && (
        <div className="block">
          <div className="block-head"><h2>Working sets per muscle</h2><Badge kind="computed" /></div>
          {weeks.length === 0 && <p className="empty" data-testid="weekly-empty">No working sets logged yet.</p>}
          {weeks.map((w, i) => (
            i === 0 ? (
              <div key={w.weekStart}>
                <p className="muted small">Latest week with sets: {dm(w.weekStart)} to {dm(w.weekEnd)} · {w.workingSets} working sets</p>
                <WeekBars w={w} />
              </div>
            ) : (
              <details key={w.weekStart} className="wk-old">
                <summary>{dm(w.weekStart)} to {dm(w.weekEnd)} <span className="muted">({w.workingSets} working sets)</span></summary>
                <WeekBars w={w} />
              </details>
            )
          ))}
          <p className="muted small" data-testid="convention">
            Counting rule: working sets only (warm-ups are excluded). Each set counts toward the primary muscle(s) you entered for its exercise,
            once per muscle; assisting muscles are not added. Weeks run Monday to Sunday. About 10 working sets per muscle per week is a common
            reference, not a target. Sets for exercises with no muscles entered appear as "{UNASSIGNED}".
          </p>
        </div>
      )}

      {view === 'history' && (
        <div className="block">
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
      )}
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
  const hint = progressionHint(ex.rep_max ?? null, last?.sets ?? []);
  const lastBest = last ? bestE1rm(last.sets) : null;
  const newestFirst = [...sessions].reverse();

  async function guard(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); await load(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div data-testid="history">
      <div className="xcard">
        <div className="block-head">
          <h2 className="xname">{ex.name}{ex.equipment && <span className="muted"> ({ex.equipment})</span>}</h2>
          <Badge kind="computed" />
        </div>
        <p className="muted small flush">
          Muscles: {ex.primary_muscles.length ? ex.primary_muscles.join(', ') : 'unassigned'}
          {ex.rep_min != null && ex.rep_max != null ? ` | rep range ${ex.rep_min}-${ex.rep_max}` : ' | no rep range'}
        </p>
        {last && (
          lastBest === null ? <p className="muted" data-testid="xcard-none">No estimated max for the latest session (it needs a working set with load and reps).</p> : (
            <div className="xmax" data-testid="xcard-max">
              <div>
                <p className="muted small">{lastBest.actual ? 'Latest session, actual lift' : `Latest session, best set ${lastBest.load} kg × ${lastBest.reps} gives an estimated max of`}</p>
                <p className="xbig">{lastBest.epley} <span className="xunit">kg</span></p>
              </div>
              <p className="muted small xsrc">
                {lastBest.actual ? <>1 rep: the actual lift,<br />not an estimate</> : <>Epley {lastBest.epley}<br />Brzycki {lastBest.brzycki}<br />{lastBest.reps} reps{lastBest.lowConfidence ? ': low confidence (over 10)' : ''}</>}
              </p>
            </div>
          )
        )}
        {hint
          ? <div className="hint" data-testid="hint"><p className="xchip-row"><span className="xchip">{HINT_LABEL[hint]}</span> <Badge kind="proposed" /></p><p className="small flush">{hintText(hint)}</p></div>
          : <p className="muted small" data-testid="no-hint">{ex.rep_max ? 'No progression hint (no sets logged).' : 'No progression hint: enter a rep range first.'}</p>}
        <p className="muted small">
          Estimated 1RM uses working sets of this exact exercise and equipment only. Epley = load x (1 + reps / 30). Brzycki = load x 36 / (37 - reps).
          A single rep is shown as the actual lift, not an estimate. Estimates above about 10 reps are low confidence. A missing load or reps gives no estimate.
        </p>
        <EditExercise ex={ex} onSave={(p) => guard(() => repo.updateExercise(ex.id, p))} />
        {error && <p role="alert" className="error">{error}</p>}
      </div>

      {sessions.length === 0 && <p className="empty">No sets logged for this exercise.</p>}
      <div className="hist">
        {newestFirst.map((s) => {
          const best = bestE1rm(s.sets);
          return (
            <div key={s.workout.id} className="session" data-testid={`sess-${s.workout.date}`}>
              <h3 className="sess-h">{dm(s.workout.date)}{s.workout.name && ` ${s.workout.name}`} <span className="muted small">{s.workout.date}</span> <Badge kind="reported" /></h3>
              <ol className="sets">
                {s.sets.map((x) => (
                  <li key={x.id}>
                    {editing === x.id
                      ? <SetEditForm set={x} onCancel={() => setEditing(null)} onSave={async (i) => { await repo.updateSet(x.id, i); setEditing(null); await load(); onChanged(); }} />
                      : <>
                          <span>{formatSet(x)}{x.pain_note && <> <span className="pain">pain: {x.pain_note}</span></>}</span>
                          <button type="button" className="b44" aria-label={`Edit set ${x.ordinal} on ${s.workout.date}`} onClick={() => setEditing(x.id)}>Edit</button>
                        </>}
                  </li>
                ))}
              </ol>
              <p className="e1rm small" data-testid={`e1rm-${s.workout.date}`}>
                Estimated 1RM <Badge kind="computed" />{' '}
                {best === null ? <span className="muted">not available (needs a working set with load and reps)</span>
                  : best.actual ? <>actual lift {best.load} kg x 1 (not an estimate)</>
                  : <>Epley {best.epley} kg | Brzycki {best.brzycki} kg, from {best.load} kg x {best.reps}{best.lowConfidence && <strong> (low confidence: over 10 reps)</strong>}</>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
