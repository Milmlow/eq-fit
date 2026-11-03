import { useCallback, useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Activity, Workout, WorkoutKind } from '../db/types';
import { DEMO_HERO } from '../lib/demo';
import { loadHero, type HeroData } from '../lib/hero';
import { startToday } from '../lib/start';
import type { ThemeName } from '../lib/theme';
import { Badge } from './Badge';
import { ActivityPulse } from './ActivityPulse';
import { TodayHero } from './TodayHero';
import { WorkoutEditor } from './WorkoutEditor';
import { Milestones } from './Milestones';
import { RepeatSession } from './RepeatSession';
import { Routines } from './Routines';
import { TrainingMomentum } from './TrainingMomentum';

type Act = Activity & { group: string };

/** Demo mode: the reference values only. No Repo is touched, so nothing can be written. */
export function DemoToday({ theme, onDemoOff }: { theme: ThemeName; onDemoOff: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div className="today-wrap">
      <TodayHero data={DEMO_HERO} theme={theme} onStart={() => setPressed(true)} starting={false} demo={pressed} />
      <p className="demo-banner">Demo mode is on. <button type="button" onClick={onDemoOff}>Turn off demo mode</button></p>
    </div>
  );
}

export function Today({ repo, today, version, onChanged, theme }: { repo: Repo; today: string; version: number; onChanged: () => void; theme: ThemeName }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [acts, setActs] = useState<Act[]>([]);
  const [completed, setCompleted] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hero, setHero] = useState<HeroData | null>(null);
  const [starting, setStarting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [w, a, c, linked, h] = await Promise.all([
      repo.workoutsBetween(today, today), repo.activitiesBetween(today, today), repo.completionForDate(today), repo.linkedActivityIds(), loadHero(repo, today),
    ]);
    setWorkouts(w);
    setActs(a.filter((x) => x.group !== 'other' && !linked.has(x.id)));
    setCompleted(c.total);
    setHero(h);
    setLoaded(true);
  }, [repo, today]);

  useEffect(() => { void load().catch(() => setError('Could not load your training history. Please reopen the app.')); }, [load, version]);

  // When a workout opens (Start or Open), bring it into view and move focus to it so keyboard users land in it.
  useEffect(() => {
    if (!open || !editorRef.current) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    editorRef.current.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    editorRef.current.focus({ preventScroll: true });
  }, [open]);

  async function add(kind: WorkoutKind) {
    setError(null);
    try {
      const w = await repo.createWorkout({ date: today, name: '', kind });
      await load(); onChanged(); setOpen(w.id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  async function start() {
    setError(null); setStarting(true);
    try {
      const r = await startToday(repo, today, false);
      if (r.kind === 'opened') { await load(); onChanged(); setOpen(r.id); }
    } catch (e) { setError(`Could not start: ${e instanceof Error ? e.message : String(e)}`); } finally { setStarting(false); }
  }
  async function link(workoutId: string, activityId: string) {
    setError(null);
    try { await repo.linkActivity(workoutId, activityId); await load(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  const planned = workouts.filter((w) => w.status === 'planned');
  const done = workouts.filter((w) => w.status === 'done');
  const label = (w: Workout) => w.name || (w.kind === 'run' ? 'Run' : 'Weights session');

  if (open) return <div ref={editorRef} tabIndex={-1} className="editor-anchor"><WorkoutEditor key={open} repo={repo} workoutId={open} onChanged={() => { void load(); onChanged(); }} onClose={() => { setOpen(null); void load(); }} /></div>;

  return (
    <div className="today-wrap">
      <ActivityPulse repo={repo} today={today} version={version} onOpen={setOpen} />
      {hero && <details className="next-session"><summary>Next weights session · Start / continue</summary><TodayHero data={hero} theme={theme} onStart={() => void start()} starting={starting} demo={false} /></details>}
      {!hero && <p>Loading...</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <Routines repo={repo} today={today} version={version} onChanged={onChanged} onOpen={setOpen} />
      <RepeatSession repo={repo} today={today} version={version} onOpen={id => { setOpen(id); void load(); onChanged(); }} />
      <TrainingMomentum repo={repo} today={today} version={version} onChanged={onChanged} onOpen={(id) => { setOpen(id); void load(); onChanged(); }} />
      <Milestones repo={repo} today={today} version={version} />
      <section aria-labelledby="today-h" className="today-log">
        <h2 id="today-h">Today <span className="muted">{today}</span></h2>
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

        <div ref={editorRef} tabIndex={-1} className="editor-anchor">
          {open && <WorkoutEditor key={open} repo={repo} workoutId={open} onChanged={() => { void load(); onChanged(); }} onClose={() => { setOpen(null); void load(); }} />}
        </div>
      </section>
    </div>
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
