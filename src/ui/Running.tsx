import { useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import { formatPace, hasRuns, lastCompleteMonth, recentCompleteWeeks, summariseRuns, type RunInput, type RunPeriod } from '../lib/running';
import { addDays } from '../lib/summary';
import { Badge } from './Badge';
import { RunProgress } from './RunProgress';
import type { Activity } from '../db/types';
import type { Group } from '../lib/mapping';

interface Custom { id: number; start: string; end: string }
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function Running({ repo, today, version }: { repo: Repo; today: string; version: number }) {
  const [recent, setRecent] = useState<(Activity & { group: Group })[]>([]);
  const [rows, setRows] = useState<RunInput[] | null>(null);
  const [treadmill, setTreadmill] = useState(false);
  const [customs, setCustoms] = useState<Custom[]>([]);
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const all = await repo.activitiesBetween(addDays(today, -800), today);
      if (live) setRecent(all.filter(a => a.group === 'outdoor_run' || a.group === 'treadmill_run'));
      if (live) setRows(all.map((a) => ({ date: a.date, group: a.group, distance_km: a.distance_km, avg_pace_sec_per_km: a.avg_pace_sec_per_km })));
    })().catch(() => { if (live) setErr('Could not load running history. Please reopen the app.'); });
    return () => { live = false; };
  }, [repo, today, version]);

  if (!rows) return <p role={err ? "alert" : undefined}>{err || "Loading..."}</p>;

  if (!hasRuns(rows)) {
    return (
      <section aria-labelledby="run-h">
        <h2 id="run-h">Your running</h2>
        <p className="empty">No runs yet. Once Garmin syncs or you import your history, your distance, pace and weekly comparison will appear here.</p>
      </section>
    );
  }

  const weeks = recentCompleteWeeks(today, 4);
  const month = lastCompleteMonth(today);
  const periods: RunPeriod[] = [
    ...weeks.map((w, i) => summariseRuns(rows, w.start, w.end, treadmill, `Week ${i + 1} of 4`)),
    summariseRuns(rows, weeks[0].start, weeks[3].end, treadmill, '4 weeks combined'),
    summariseRuns(rows, month.start, month.end, treadmill, `Month ${month.label}`),
    ...customs.map((c) => summariseRuns(rows, c.start, c.end, treadmill, 'Custom')),
  ];

  function addCustom() {
    if (!ISO.test(cs) || !ISO.test(ce) || Number.isNaN(Date.parse(cs)) || Number.isNaN(Date.parse(ce))) return setErr('Choose both a start and an end date.');
    if (cs > ce) return setErr('Start must be on or before end.');
    setErr(null);
    setCustoms([...customs, { id: Date.now(), start: cs, end: ce }]);
  }

  return (
    <section aria-labelledby="run-h">
      <h2 id="run-h">Your running</h2>
      <p className="muted">Complete weeks and months before {today}. Figures from imported watch data <Badge kind="measured" /> combined by this app <Badge kind="computed" />.</p>
      <label className="check"><input type="checkbox" checked={treadmill} onChange={(e) => setTreadmill(e.target.checked)} /> Include treadmill runs (off = outdoor only)</label>

      <RunProgress rows={rows} today={today} treadmill={treadmill} />
      <h3>Recent runs</h3>
      <ul className="items">{recent.filter(a => treadmill || a.group === 'outdoor_run').slice(0, 5).map(a => <li key={a.id}><span><strong>{a.title || a.original_type}</strong><br/><span className="muted">{a.timestamp_local} · {a.original_type}</span></span><span>{a.distance_km?.toFixed(2) ?? '—'} km · {formatPace(a.avg_pace_sec_per_km)}</span></li>)}</ul>
      <h3>Compare complete periods</h3>
      <div className="scroll">
        <table data-testid="run-table">
          <caption>{treadmill ? 'Outdoor and treadmill runs' : 'Outdoor runs only'}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th><th scope="col">Dates (MM-DD)</th><th scope="col">Runs (with pace)</th><th scope="col">km</th><th scope="col">Pace</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => (
              <tr key={i} data-testid={`run-row-${i}`}>
                <th scope="row">{p.label}</th>
                <td className="nowrap" title={`${p.start} to ${p.end}`}>{p.start.slice(5)} to {p.end.slice(5)}</td>
                <td className="num nowrap">{p.runs} ({p.runsWithPace})</td>
                <td className="num">{p.km === null ? '-' : p.km.toFixed(2)}</td>
                <td className="num nowrap">{formatPace(p.paceSecPerKm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Avg pace is distance-weighted (long runs count more), not a mean of paces. Runs with no pace or distance are left out of the pace figure and are never filled in. "-" means no data.</p>

      <h3>Custom period</h3>
      <div className="row gap wrap">
        <label className="field">Start<input type="date" max={today} value={cs} onChange={(e) => setCs(e.target.value)} /></label>
        <label className="field">End<input type="date" max={today} value={ce} onChange={(e) => setCe(e.target.value)} /></label>
        <button onClick={addCustom}>Add period</button>
      </div>
      {err && <p role="alert" className="error">{err}</p>}
    </section>
  );
}
