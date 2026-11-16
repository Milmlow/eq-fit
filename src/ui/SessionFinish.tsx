import { useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise } from '../db/types';
import { activityPulse, type Session } from '../lib/activityPulse';
import { extraReps } from '../lib/coachFacts';
import { formatSet } from '../lib/training';
import { localToday } from '../lib/today';
import { formatTodayLabel } from '../lib/todayStats';
import { CoachEQ } from './CoachEQ';

export function SessionFinish({ repo, workoutId, onDone, onEdit }: { repo: Repo; workoutId: string; onDone: () => void; onEdit: () => void }) {
  const [data, setData] = useState<{ session: Session; history: Session[]; exercises: Exercise[] } | null>(null);
  const [error, setError] = useState('');
  const today = localToday();
  useEffect(() => {
    let live = true;
    Promise.all([repo.activitiesBetween('0000-01-01', today), repo.db.workouts.toArray(), repo.db.sets.toArray(), repo.listExercises()])
      .then(([a, w, s, e]) => {
        const pulse = activityPulse(a, w, s, e, today); const session = pulse.sessions.find(x => x.id === workoutId);
        if (live && session) setData({ session, history: pulse.sessions, exercises: e });
      }).catch(() => { if (live) setError('Your session is saved. The summary could not load.'); });
    return () => { live = false; };
  }, [repo, workoutId, today]);
  const win = data && extraReps(data.session, data.history, data.exercises);
  const exerciseCount = new Set(data?.session.sets.map(s => s.exercise_id)).size;
  return <section className="card session-finish" aria-labelledby="finished-title">
    <p className="eyebrow">SAVED ✓</p><h2 id="finished-title" tabIndex={-1} ref={el => el?.focus()}>Session done.</h2>
    {error && <p role="alert">{error}</p>}
    {data && <>
      <p>{data.session.title}</p>
      {win && <p className="finish-win">
        <strong>{win.exercise.name} · {win.load} kg × {win.reps}</strong>
        <span>+{win.reps - win.previousReps} {win.reps - win.previousReps === 1 ? 'rep' : 'reps'} at this weight vs {formatTodayLabel(win.previousDate)}</span>
      </p>}
      {data.session.kind === 'weights' && <p className="finish-count">
        <strong>{data.session.sets.length}</strong> working {data.session.sets.length === 1 ? 'set' : 'sets'}
        {' · '}<strong>{exerciseCount}</strong> {exerciseCount === 1 ? 'exercise' : 'exercises'}
      </p>}
      <CoachEQ session={data.session} today={today} scope={repo.db.name} history={data.history} exercises={data.exercises} share />
      {exerciseCount > 0 && <details><summary>Your sets</summary>{data.exercises.filter(e => data.session.sets.some(s => s.exercise_id === e.id)).map(e => <div key={e.id}><h3>{e.name}</h3><p>{data.session.sets.filter(s => s.exercise_id === e.id).map(formatSet).join(' · ')}</p></div>)}</details>}
    </>}
    <button className="primary finish-done" onClick={onDone}>Done</button>
    <button onClick={onEdit}>View / edit session</button>
  </section>;
}
