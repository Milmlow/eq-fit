import { useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise } from '../db/types';
import type { Session } from '../lib/activityPulse';
import type { TrainingEntry } from '../lib/dashboardFocus';
import { homeOverview } from '../lib/homeOverview';
import { formatTodayLabel, paceMinSec } from '../lib/todayStats';
import { HomeCard } from './HomeCard';
import { MyFour } from './MyFour';
import { IconLift, IconRun } from './Icons';

export type HomeDestination = 'week' | 'lift' | 'run';

export function HomeCards({ repo, today, entries, sessions, exercises, pace, onOpen, onChanged, onNavigate, checkIn = false }: {
  repo: Repo; today: string; entries: TrainingEntry[]; sessions: Session[]; exercises: Exercise[];
  pace: number | null; onOpen: (id: string) => void; onChanged: () => void;
  onNavigate?: (destination: HomeDestination) => void; checkIn?: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const overview = homeOverview(entries, today);
  const { effort } = overview;
  const toggle = (id: string) => setExpanded(current => current === id ? null : id);
  const period = `${formatTodayLabel(overview.start)} – ${formatTodayLabel(today)}`;

  function activityRows(rows: TrainingEntry[]) {
    return rows.length ? <ul className="home-recent-list">{rows.map(entry => <li key={entry.id}>
      <div className="home-activity-name">
        {(entry.category === 'strength' || entry.category === 'run') && <span aria-hidden="true">{entry.category === 'strength' ? <IconLift /> : <IconRun />}</span>}
        <span><strong>{entry.title}</strong><small>{formatTodayLabel(entry.date)} · {entry.category === 'run' ? 'Running' : entry.category === 'strength' ? 'Strength' : entry.category === 'cardio' ? 'Cardio' : 'Unclassified'}</small></span>
      </div>
      {entry.workout ? <button type="button" onClick={() => onOpen(entry.workout!.id)}>Open session</button>
        : onNavigate && <button type="button" onClick={() => onNavigate(entry.category === 'run' ? 'run' : 'week')}>View history</button>}
    </li>)}</ul> : <p className="muted">Your recorded sessions will appear here.</p>;
  }

  return <div className="home-data-cards">
    <HomeCard title="This week" value={effort.sessions} caption={`sessions · ${period}`}
      open={expanded === 'week'} onToggle={() => toggle('week')}>
      <div className="home-inline-stats">
        <p><strong>{effort.strength}</strong> strength</p><p><strong>{effort.cardio}</strong> cardio</p>
        <p><strong>{effort.minutes ?? '—'}</strong> recorded min</p>
      </div>
      {effort.missingDuration > 0 && <p className="muted small">Time available for {effort.sessions - effort.missingDuration} of {effort.sessions} sessions.</p>}
      <h3>Recent activity</h3>
      {activityRows(overview.recent)}
      {onNavigate && <button type="button" className="home-history-link" onClick={() => onNavigate('week')}>Open weekly history →</button>}
    </HomeCard>
    <HomeCard title="Strength" value={overview.workingSets} caption={`working sets · ${period}`}
      open={expanded === 'strength'} onToggle={() => toggle('strength')}>
      <p className="muted small">Working sets entered in completed sessions. Watch-only sessions may have no recorded sets.</p>
      <MyFour checkIn={checkIn} repo={repo} today={today} sessions={sessions} exercises={exercises} onOpen={onOpen} onChanged={onChanged} />
      {onNavigate && <button type="button" className="home-history-link" onClick={() => onNavigate('lift')}>Open strength history →</button>}
    </HomeCard>
    <HomeCard title="Running" value={effort.km === null ? '—' : `${effort.km} km`}
      caption={`recorded distance · ${period}`} open={expanded === 'running'} onToggle={() => toggle('running')}>
      {effort.missingDistance > 0 && <p className="muted small">Distance available for {effort.runs - effort.missingDistance} of {effort.runs} runs this week.</p>}
      <div className="home-inline-stats"><p><strong>{paceMinSec(pace)}</strong> / km</p></div>
      <p className="muted small">Distance-weighted outdoor running pace over the 28 days through today. Weekly distance includes activities allocated as running.</p>
      {activityRows(overview.runs)}
      {onNavigate && <button type="button" className="home-history-link" onClick={() => onNavigate('run')}>Open running history →</button>}
    </HomeCard>
  </div>;
}
