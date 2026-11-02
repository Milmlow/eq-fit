import { useCallback, useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Activity, Workout } from '../db/types';
import { addDays, mondayOf } from '../lib/summary';
import { baselinePerWeek, fallbackDates, WEEKDAYS, weekDates } from '../lib/week';
import { Badge } from './Badge';

type Act = Activity & { group: string };

export function Week({ repo, today, version, onChanged }: { repo: Repo; today: string; version: number; onChanged: () => void }) {
  const [anchor, setAnchor] = useState(today);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [baseline, setBaseline] = useState<ReturnType<typeof baselinePerWeek>>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const days = weekDates(anchor);

  const load = useCallback(async () => {
    const mon = mondayOf(anchor);
    const sun = addDays(mon, 6);
    const [w, a, hist, l] = await Promise.all([
      repo.workoutsBetween(mon, sun), repo.activitiesBetween(mon, sun), repo.activitiesBetween(addDays(mon, -28), addDays(mon, -1)), repo.linkedActivityIds(),
    ]);
    setWorkouts(w); setActs(a.filter((x) => x.group !== 'other')); setLinked(l);
    setBaseline(baselinePerWeek(hist.map((h) => ({ date: h.date, group: h.group, distance_km: h.distance_km, duration_seconds: h.duration_seconds })), mon, 4));
  }, [repo, anchor]);
  useEffect(() => { void load(); }, [load, version]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); await load(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  const plannedCount = workouts.filter((w) => w.status === 'planned').length;
  const doneCount = workouts.filter((w) => w.status === 'done').length;

  return (
    <section aria-labelledby="week-h">
      <h2 id="week-h">Week <span className="muted">{days[0]} to {days[6]}</span></h2>
      <div className="row gap wrap">
        <button onClick={() => setAnchor(addDays(anchor, -7))}>Previous week</button>
        <button onClick={() => setAnchor(today)}>This week</button>
        <button onClick={() => setAnchor(addDays(anchor, 7))}>Next week</button>
      </div>

      <p className="card" data-testid="baseline">
        <strong>Baseline from your history</strong> <Badge kind="computed" /><br />
        {baseline
          ? <>About {baseline.weights} weights entries and {baseline.runs} runs per week over the previous {baseline.weeks} weeks. Context only, not a target.</>
          : <>No imported history in the previous 4 weeks, so there is no baseline.</>}
      </p>
      <p>This week: {plannedCount} planned, {doneCount} done <Badge kind="reported" /></p>
      {error && <p role="alert" className="error">{error}</p>}

      <ul className="days">
        {days.map((d, i) => {
          const ws = workouts.filter((w) => w.date === d);
          const as = acts.filter((a) => a.date === d && !linked.has(a.id));
          return (
            <li key={d} className="day" data-testid={`day-${d}`}>
              <h3 className="flush">{WEEKDAYS[i]} <span className="muted">{d}</span>{d === today && <strong> (today)</strong>}</h3>
              {ws.length === 0 && as.length === 0 && <p className="muted flush">Nothing planned.</p>}
              {ws.map((w) => (
                <div className="item" key={w.id}>
                  <span>{w.name || (w.kind === 'run' ? 'Run' : 'Weights session')} <span className="muted">({w.status})</span></span>
                  <span className="row gap wrap">
                    <label className="inline">Move to
                      <select value={w.date} onChange={(e) => void act(() => repo.updateWorkout(w.id, { date: e.target.value }))} aria-label={`Move ${w.name || w.kind} on ${d} to`}>
                        {days.map((dd, j) => <option key={dd} value={dd}>{WEEKDAYS[j]} {dd}</option>)}
                      </select>
                    </label>
                    <button aria-label={`Remove ${w.name || w.kind} on ${d}`} onClick={() => { if (window.confirm('Remove this workout and its sets?')) void act(() => repo.removeWorkout(w.id)); }}>Remove</button>
                  </span>
                </div>
              ))}
              {as.map((a) => (
                <div className="item" key={a.id}><span>{a.title} <span className="muted">[{a.original_type}] imported</span> <Badge kind="measured" /></span></div>
              ))}
              <div className="row gap wrap">
                <button onClick={() => void act(() => repo.createWorkout({ date: d, name: '', kind: 'weights' }))}>Add weights on {WEEKDAYS[i]}</button>
                <button onClick={() => void act(() => repo.createWorkout({ date: d, name: '', kind: 'run' }))}>Add run on {WEEKDAYS[i]}</button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="card">
        <p className="flush"><strong>Busy week?</strong> <Badge kind="proposed" /></p>
        <p className="muted">Optional 3-day fallback: adds three blank weights sessions on Monday, Wednesday and Friday. You choose the exercises.</p>
        <button onClick={() => void act(async () => { for (const d of fallbackDates(anchor)) await repo.createWorkout({ date: d, name: 'Fallback session', kind: 'weights' }); })}>Add 3-day fallback</button>
      </div>
    </section>
  );
}
