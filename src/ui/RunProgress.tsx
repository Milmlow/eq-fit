import { runningProgress } from '../lib/progress';
import { formatPace, type RunInput } from '../lib/running';

export function RunProgress({ rows, today, treadmill = false }: { rows: RunInput[]; today: string; treadmill?: boolean }) {
  const p = runningProgress(rows, today, treadmill);
  const delta = p.week.km !== null && p.previousElapsed.km !== null ? p.week.km - p.previousElapsed.km : null;
  const max = Math.max(1, ...p.weeks.map(w => w.km ?? 0));
  return <section className="progress-panel" aria-labelledby="run-progress-heading">
    <div className="row wrap gap"><div><p className="eyebrow">YOUR RUNNING</p><h2 id="run-progress-heading">Every run adds up.</h2></div><span className="muted">{treadmill ? 'Outdoor + treadmill' : 'Outdoor only'}</span></div>
    <div className="progress-metrics">
      <div><span>This week</span><strong>{p.week.km?.toFixed(2) ?? '—'} <small>km</small></strong><span>{p.week.runs} recorded runs</span></div>
      <div><span>This month</span><strong>{p.month.km?.toFixed(2) ?? '—'} <small>km</small></strong><span>{p.month.runs} recorded runs</span></div>
      <div><span>Weekly average pace</span><strong className="pace-metric">{formatPace(p.week.paceSecPerKm)}</strong><span>Distance-weighted · computed</span></div>
    </div>
    <p className="progress-note">{delta === null ? 'Your first comparison appears when both weeks have recorded distance.' : `${Math.abs(delta).toFixed(2)} km ${delta >= 0 ? 'more' : 'less'} than the same weekdays last week.`} <span className="muted">More distance is a comparison, not a target.</span></p>
    <div className="trend" aria-label="Distance for the last four complete weeks">
      {p.weeks.map(w => <div className="trend-col" key={w.start}>
        <span>{w.km?.toFixed(1) ?? '—'} <small>km</small></span>
        <div className="trend-track" aria-hidden="true"><div style={{ height: `${(w.km ?? 0) / max * 100}%` }} /></div>
        <span>{w.start.slice(8)}/{w.start.slice(5, 7)}</span>
      </div>)}
    </div>
    <p className="muted small">Four complete weeks · week starting Monday. Missing distance stays unknown. Mixed routes, effort and conditions affect pace; this is not a fitness score.</p>
  </section>;
}
