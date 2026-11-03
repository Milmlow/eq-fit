import { runningProgress } from '../lib/progress';
import { formatPace, type RunInput } from '../lib/running';
import { IconRun } from './Icons';

export function RunProgress({ rows, today, treadmill = false }: { rows: RunInput[]; today: string; treadmill?: boolean }) {
  const p = runningProgress(rows, today, treadmill);
  const delta = p.week.km !== null && p.previousElapsed.km !== null ? p.week.km - p.previousElapsed.km : null;
  const bars = [...p.weeks, p.week];
  const max = Math.max(1, ...bars.map(w => w.km ?? 0));
  return <section className="progress-panel visual-running" aria-labelledby="run-progress-heading">
    <div className="visual-heading"><div><p className="eyebrow">RUNNING</p><h2 id="run-progress-heading">Your distance</h2></div><IconRun /></div>
    <div className="progress-metrics">
      <div><span>This week</span><strong>{p.week.km?.toFixed(1) ?? '—'} <small>km</small></strong><span>{p.week.runs} runs</span></div>
      <div><span>This month</span><strong>{p.month.km?.toFixed(1) ?? '—'} <small>km</small></strong><span>{p.month.runs} runs</span></div>
      <div><span>Week pace</span><strong className="pace-metric">{formatPace(p.week.paceSecPerKm)}</strong><span>min / km</span></div>
    </div>
    <div className="visual-trend" role="img" aria-label={`Weekly kilometres. ${bars.map((w, i) => `${i === 4 ? 'This week so far' : 'Week of ' + w.start}: ${w.km === null ? 'distance unknown' : w.km.toFixed(1) + ' km'}`).join('. ')}`}>
      {bars.map((w, i) => <div className={`visual-trend-col ${i === 4 ? 'current' : ''}`} key={w.start} aria-hidden="true">
        <b>{w.km?.toFixed(1) ?? '—'}</b><div className="visual-trend-track"><div style={{ height: `${(w.km ?? 0) / max * 100}%` }} /></div>
        <span>{i === 4 ? 'This week' : `${w.start.slice(8)}/${w.start.slice(5, 7)}`}</span>
      </div>)}
    </div>
    <p className="distance-delta">{delta === null ? 'Building your comparison' : <><span aria-hidden="true">{delta > 0 ? '↗' : delta < 0 ? '↘' : '→'}</span> {Math.abs(delta).toFixed(1)} km {delta >= 0 ? 'more' : 'less'} <span className="muted">vs same days last week</span></>}</p>
    <details className="chart-details"><summary>Details</summary><p className="muted small">{treadmill ? 'Outdoor + treadmill' : 'Outdoor only'}. Four complete weeks and this week so far. Bars show distance, not a target. Pace is distance-weighted; routes and effort affect it. Missing distance stays unknown.</p></details>
  </section>;
}
