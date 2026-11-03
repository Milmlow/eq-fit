import { useCallback, useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Activity, Workout } from '../db/types';
import { addDays, mondayOf } from '../lib/summary';
import { baselinePerWeek, fallbackDates, WEEKDAYS, weekDates } from '../lib/week';
import { daySummary } from '../lib/trainingWeek';
import { IconLift, IconRun } from './Icons';
import { WorkoutEditor } from './WorkoutEditor';
import { Badge } from './Badge';

type Act = Activity & { group: string };

export function Week({ repo, today, version, onChanged }: { repo: Repo; today: string; version: number; onChanged: () => void }) {
  const [anchor, setAnchor] = useState(today);
  const [selected,setSelected]=useState(today);
  const [open,setOpen]=useState<string|null>(null);
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

  const active=days.includes(selected)?selected:days[0];
  const summaries=days.map(d=>daySummary(d,workouts,acts,linked));
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

      <div className="week-overview">{days.map((d,i)=>{const s=summaries[i];return <button key={d} className={`week-tile ${d===today?'today':''}`} aria-pressed={active===d} aria-label={`${WEEKDAYS[i]} ${d}: ${s.lifts} completed lifts, ${s.runs} runs, ${s.planned} planned, ${s.km===null?'distance unknown':s.km.toFixed(1)+' km'}`} onClick={()=>{setSelected(d);setOpen(null);}}><span>{WEEKDAYS[i].slice(0,1)}</span><strong>{Number(d.slice(8))}</strong><span className="tile-activities">{s.lifts>0&&<span><IconLift/>{s.lifts}</span>}{s.runs>0&&<span><IconRun/>{s.runs}</span>}{!s.lifts&&!s.runs&&<span aria-hidden="true">—</span>}</span><small>{s.km!==null?`${s.km.toFixed(1)} km`:' '}</small>{s.planned>0&&<small className="planned-dot" title={`${s.planned} planned sessions`}>○ {s.planned}</small>}</button>;})}</div>
      <p className="week-total"><strong>{summaries.reduce((n,s)=>n+s.lifts,0)}</strong> completed lifts · <strong>{summaries.reduce((n,s)=>n+s.runs,0)}</strong> runs · <strong>{summaries.some(s=>s.km!==null)?summaries.reduce((n,s)=>n+(s.km??0),0).toFixed(1):'—'}</strong> recorded km</p>
      <details className="card"><summary>Weekly context</summary>
      <p data-testid="baseline">
        <strong>Baseline from your history</strong> <Badge kind="computed" /><br />
        {baseline
          ? <>About {baseline.weights} weights entries and {baseline.runs} runs per week over the previous {baseline.weeks} weeks. Context only, not a target.</>
          : <>No imported history in the previous 4 weeks, so there is no baseline.</>}
      </p>
      <p>This week: {plannedCount} planned, {doneCount} done <Badge kind="reported" /></p>
      </details>
      {error && <p role="alert" className="error">{error}</p>}

      <ul className="days">
        {days.map((d, i) => {
          const ws = workouts.filter((w) => w.date === d);
          const as = acts.filter((a) => a.date === d && !linked.has(a.id));
          return (
            <li key={d} hidden={active!==d} className="day" data-testid={`day-${d}`}>
              <h3 className="flush">{WEEKDAYS[i]} <span className="muted">{d}</span>{d === today && <strong> (today)</strong>}</h3>
              {ws.length === 0 && as.length === 0 && <p className="muted flush">Rest day or room for a session.</p>}
              {ws.map((w) => (
                <div className="item" key={w.id}>
                  <span>{w.name || (w.kind === 'run' ? 'Run' : 'Weights session')} <span className="muted">({w.status})</span></span>
                  <span className="row gap wrap">
                    <button onClick={()=>setOpen(w.id)}>Open session</button>
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
                <button onClick={() => void act(async () => {const w=await repo.createWorkout({ date: d, name: '', kind: 'weights' });setOpen(w.id);})}>Add weights on {WEEKDAYS[i]}</button>
                <button onClick={() => void act(() => repo.createWorkout({ date: d, name: '', kind: 'run' }))}>Add run on {WEEKDAYS[i]}</button>
              </div>
            </li>
          );
        })}
      </ul>

      {open&&<WorkoutEditor key={open} repo={repo} workoutId={open} onChanged={()=>{void load();onChanged();}} onClose={()=>setOpen(null)}/>}
      <details className="card"><summary>Optional planning</summary>
        <p className="flush"><strong>Busy week?</strong> <Badge kind="proposed" /></p>
        <p className="muted">Optional 3-day fallback: adds three blank weights sessions on Monday, Wednesday and Friday. You choose the exercises.</p>
        <button onClick={() => void act(async () => { for (const d of fallbackDates(anchor)) await repo.createWorkout({ date: d, name: 'Fallback session', kind: 'weights' }); })}>Add 3-day fallback</button>
      </details>
    </section>
  );
}
