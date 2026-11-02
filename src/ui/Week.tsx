import { useCallback, useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Activity, Workout } from '../db/types';
import { addDays, mondayOf } from '../lib/summary';
import { dash, formatTodayLabel, lastWeekStats, type LastWeek } from '../lib/todayStats';
import { baselinePerWeek, fallbackDates, WEEKDAYS, weekDates } from '../lib/week';
import { Badge } from './Badge';
import { Goals } from './Goals';
import { Chip, ScreenHead } from './Screen';

type Act = Activity & { group: string };
const dm = (d: string) => formatTodayLabel(d).slice(4);

export function Week({ repo, today, version, onChanged }: { repo: Repo; today: string; version: number; onChanged: () => void }) {
  const [anchor, setAnchor] = useState(today);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [baseline, setBaseline] = useState<ReturnType<typeof baselinePerWeek>>(null);
  const [lastWeek, setLastWeek] = useState<LastWeek | null>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const days = weekDates(anchor);

  const load = useCallback(async () => {
    const mon = mondayOf(anchor);
    const sun = addDays(mon, 6);
    const [w, a, hist, l, latest] = await Promise.all([
      repo.workoutsBetween(mon, sun), repo.activitiesBetween(mon, sun), repo.activitiesBetween(addDays(mon, -28), addDays(mon, -1)), repo.linkedActivityIds(), repo.latestActivityDate(),
    ]);
    setWorkouts(w); setActs(a.filter((x) => x.group !== 'other')); setLinked(l);
    const rows = hist.map((h) => ({ date: h.date, group: h.group, distance_km: h.distance_km, duration_seconds: h.duration_seconds, avg_pace_sec_per_km: h.avg_pace_sec_per_km }));
    setBaseline(baselinePerWeek(rows, mon, 4));
    setLastWeek(lastWeekStats(rows, mon, latest));
  }, [repo, anchor]);
  useEffect(() => { void load(); }, [load, version]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); await load(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  const plannedCount = workouts.filter((w) => w.status === 'planned').length;
  const doneCount = workouts.filter((w) => w.status === 'done').length;
  const isThisWeek = mondayOf(anchor) === mondayOf(today);

  return (
    <section aria-labelledby="week-h" className="screen">
      <ScreenHead id="week-h" title={isThisWeek ? 'This week' : 'Week'} today={today} />
      <p className="muted flush" data-testid="week-range">{dm(days[0])} to {dm(days[6])}</p>
      <div className="chips wk-nav">
        <button type="button" onClick={() => setAnchor(addDays(anchor, -7))}>Previous week</button>
        <button type="button" onClick={() => setAnchor(today)} aria-current={isThisWeek ? 'true' : undefined}>This week</button>
        <button type="button" onClick={() => setAnchor(addDays(anchor, 7))}>Next week</button>
      </div>

      <div className="panels" data-testid="baseline">
        <div className="panel panel-blue">
          <p className="panel-k">The week before</p>
          <p className="panel-big xs">{lastWeek && lastWeek.lifts !== null ? `${lastWeek.lifts} lifts · ${lastWeek.runs} runs` : '-'}</p>
          <p className="panel-u sm">{lastWeek && lastWeek.km !== null ? `${dash(lastWeek.km, 2)} km outdoor` : 'no imported data for that week'}</p>
        </div>
        <div className="panel panel-card">
          <p className="panel-k">Your usual</p>
          <p className="panel-big xs">{baseline ? <>{baseline.weights} lifts<br />{baseline.runs} runs</> : '-'}</p>
          <p className="panel-u sm">{baseline ? `a week, previous ${baseline.weeks} weeks` : 'no history in the previous 4 weeks'}</p>
        </div>
      </div>
      <p className="muted small prov">Both from your imported history <Badge kind="computed" />. Context only, not a target. {plannedCount} planned, {doneCount} done this week <Badge kind="reported" /></p>

      <Goals repo={repo} today={today} weekOf={anchor} version={version} onChanged={onChanged} manage heading="Goals" />
      {error && <p role="alert" className="error">{error}</p>}

      <ul className="daylist">
        {days.map((d, i) => {
          const ws = workouts.filter((w) => w.date === d);
          const as = acts.filter((a) => a.date === d && !linked.has(a.id));
          const empty = ws.length === 0 && as.length === 0;
          const isToday = d === today;
          return (
            <li key={d} className={`drow${empty ? ' empty-day' : ''}`} data-testid={`day-${d}`}>
              <div className="drow-main">
                <div className="drow-d"><p className="drow-wd">{WEEKDAYS[i].toUpperCase()}</p><p className="muted small flush">{dm(d)}</p></div>
                <div className="drow-c">
                  {empty && <p className="muted flush">{d < today ? 'Nothing recorded' : 'Nothing planned'}</p>}
                  {ws.map((w) => (
                    <div className="item" key={w.id}>
                      <span className="drow-n">{w.name || (w.kind === 'run' ? 'Run' : 'Weights session')} <span className="muted small">({w.status})</span></span>
                      <span className="drow-act">
                        <span className="movewrap">
                          <span className="movebtn" aria-hidden="true">Move</span>
                          <select value={w.date} onChange={(e) => void act(() => repo.updateWorkout(w.id, { date: e.target.value }))} aria-label={`Move ${w.name || w.kind} on ${d} to`}>
                            {days.map((dd, j) => <option key={dd} value={dd}>{WEEKDAYS[j]} {dd}</option>)}
                          </select>
                        </span>
                        <button type="button" className="b44" aria-label={`Remove ${w.name || w.kind} on ${d}`} onClick={() => { if (window.confirm('Remove this workout and its sets?')) void act(() => repo.removeWorkout(w.id)); }}>Remove</button>
                      </span>
                    </div>
                  ))}
                  {as.map((a) => (
                    <div className="item" key={a.id}><span className="drow-n">{a.title} <span className="muted small">[{a.original_type}] imported</span> <Badge kind="measured" /></span></div>
                  ))}
                </div>
                {isToday && <span className="today-pill">Today</span>}
              </div>
              <div className="drow-add">
                <button type="button" className={`b44${empty ? ' go' : ''}`} onClick={() => void act(() => repo.createWorkout({ date: d, name: '', kind: 'weights' }))}>Add weights<span className="sr"> on {WEEKDAYS[i]}</span></button>
                <button type="button" className="b44" onClick={() => void act(() => repo.createWorkout({ date: d, name: '', kind: 'run' }))}>Add run<span className="sr"> on {WEEKDAYS[i]}</span></button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="chips">
        <Chip onClick={() => void act(async () => { for (const d of fallbackDates(anchor)) await repo.createWorkout({ date: d, name: 'Fallback session', kind: 'weights' }); })}>3-day busy week</Chip>
        <span className="muted small grow">Optional <Badge kind="proposed" />. Adds three blank weights sessions on Monday, Wednesday and Friday; you choose the exercises. Your usual rhythm is a guide, not a rule.</span>
      </div>
    </section>
  );
}
