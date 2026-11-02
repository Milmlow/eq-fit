import { useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import { formatPace, lastCompleteMonth, recentCompleteWeeks, summariseRuns, type RunInput, type RunPeriod } from '../lib/running';
import { addDays } from '../lib/summary';
import { dash, formatTodayLabel, paceMinSec } from '../lib/todayStats';
import type { GoalKind } from '../db/types';
import { Badge } from './Badge';
import { Bests } from './Bests';
import { Goals } from './Goals';
import { Chip, ScreenHead, Segmented } from './Screen';

interface Custom { id: number; start: string; end: string }
type Mode = 'weeks' | 'four' | 'month' | 'custom';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dm = (d: string) => formatTodayLabel(d).slice(4); // "2026-10-26" -> "26 Oct"
const monthName = (label: string) => MONTHS[Number(label.slice(5, 7)) - 1] ?? label;
const runWord = (n: number) => `${n} ${n === 1 ? 'run' : 'runs'}`;

const RUN_KINDS: GoalKind[] = ['runs_per_week', 'km_per_week'];

export function Running({ repo, today, version, onChanged }: { repo: Repo; today: string; version: number; onChanged: () => void }) {
  const [rows, setRows] = useState<RunInput[] | null>(null);
  const [treadmill, setTreadmill] = useState(false);
  const [mode, setMode] = useState<Mode>('four');
  const [customs, setCustoms] = useState<Custom[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const all = await repo.activitiesBetween(addDays(today, -800), today);
      if (live) setRows(all.map((a) => ({ date: a.date, group: a.group, distance_km: a.distance_km, avg_pace_sec_per_km: a.avg_pace_sec_per_km })));
    })();
    return () => { live = false; };
  }, [repo, today, version]);

  const head = <ScreenHead id="run-h" title="Running" today={today} />;
  if (!rows) return <section aria-labelledby="run-h">{head}<p>Loading...</p></section>;

  const weeks = recentCompleteWeeks(today, 4);
  const month = lastCompleteMonth(today);
  const weekPeriods = weeks.map((w) => summariseRuns(rows, w.start, w.end, treadmill, `Week of ${dm(w.start)}`));
  const combined = summariseRuns(rows, weeks[0].start, weeks[3].end, treadmill, '4 weeks combined');
  const monthP = summariseRuns(rows, month.start, month.end, treadmill, monthName(month.label));
  const customPeriods = customs.map((c) => summariseRuns(rows, c.start, c.end, treadmill, `${dm(c.start)} to ${dm(c.end)}`));

  // Rows keep the original order (weeks oldest first, combined, month, custom) for the test ids; weeks are shown newest first.
  const all: RunPeriod[] = [...weekPeriods, combined, monthP, ...customPeriods];
  const shown = [...[...weekPeriods.keys()].reverse(), 4, 5, ...customPeriods.map((_, i) => 6 + i)];

  const hero: { p: RunPeriod; title: string } =
    mode === 'weeks' ? { p: weekPeriods[3], title: weekPeriods[3].label }
    : mode === 'month' ? { p: monthP, title: monthP.label }
    : mode === 'custom' && customPeriods.length ? { p: customPeriods[customPeriods.length - 1], title: customPeriods[customPeriods.length - 1].label }
    : { p: combined, title: '4 weeks' };

  const maxKm = Math.max(0, ...weekPeriods.map((p) => p.km ?? 0));
  const anyBar = weekPeriods.some((p) => p.km !== null);

  function addCustom() {
    if (!ISO.test(cs) || !ISO.test(ce) || Number.isNaN(Date.parse(cs)) || Number.isNaN(Date.parse(ce))) return setErr('Enter both dates as YYYY-MM-DD.');
    if (cs > ce) return setErr('Start must be on or before end.');
    setErr(null);
    setCustoms([...customs, { id: Date.now(), start: cs, end: ce }]);
    setMode('custom');
  }

  return (
    <section aria-labelledby="run-h" className="screen">
      {head}
      <Segmented label="Period" name="run-mode" value={mode}
        options={[{ value: 'weeks', label: 'Weeks' }, { value: 'four', label: '4 weeks' }, { value: 'month', label: 'Month' }]}
        onChange={(v) => setMode(v)} />

      <div className="panels" data-testid="run-hero">
        <div className="panel panel-blue">
          <p className="panel-k">{hero.title} · {runWord(hero.p.runs)}</p>
          <p className="panel-big" data-testid="run-hero-km">{dash(hero.p.km, 2)}</p>
          <p className="panel-u">{treadmill ? 'km incl. treadmill' : 'km outdoor'}</p>
        </div>
        <div className="panel panel-accent">
          <p className="panel-k">Average pace</p>
          <p className="panel-big sm" data-testid="run-hero-pace">{paceMinSec(hero.p.paceSecPerKm)}</p>
          <p className="panel-u">per km</p>
        </div>
      </div>
      <p className="muted small prov">Watch export <Badge kind="measured" /> combined by this app <Badge kind="computed" />. Distance-weighted, from your watch export: long runs count more, and a run with no pace or distance is left out of the pace and never filled in.</p>

      <div className="block">
        <div className="block-head"><h2>Km per week</h2><span className="muted small">{dm(weeks[0].start)} to {dm(weeks[3].end)}</span></div>
        {anyBar ? (
          <ol className="bars" role="group" aria-label={`Kilometres per week, ${dm(weeks[0].start)} to ${dm(weeks[3].end)}`} data-testid="run-bars">
            {weekPeriods.map((p, i) => (
              <li key={p.start} className={i === 3 ? 'hi' : undefined}>
                <span className="sr">Week of {dm(p.start)}: {p.km === null ? 'no distance recorded' : `${p.km.toFixed(2)} km`}</span>
                <span className="bar-v" aria-hidden="true">{dash(p.km, 2)}</span>
                <span className="bar-col" aria-hidden="true">{p.km !== null && maxKm > 0 && <span className="bar-fill" style={{ height: `${Math.max(3, (p.km / maxKm) * 100)}%` }} />}</span>
                <span className="bar-l" aria-hidden="true">{dm(p.start)}</span>
              </li>
            ))}
          </ol>
        ) : <p className="empty" data-testid="run-empty">No runs with a distance in these four weeks.</p>}
      </div>

      <ul className="prow" data-testid="run-table">
        {shown.map((idx) => {
          const p = all[idx];
          return (
            <li key={idx} data-testid={`run-row-${idx}`}>
              <div className="prow-l">
                <p className="prow-t">{p.label}</p>
                <p className="muted small">{runWord(p.runs)}{p.runsWithPace !== p.runs ? ` (${p.runsWithPace} with pace)` : ''} · {p.km === null ? '-' : `${p.km.toFixed(2)} km`}</p>
                <p className="muted small nowrap" title={`${p.start} to ${p.end}`}>{p.start.slice(5)} to {p.end.slice(5)}</p>
              </div>
              <p className="prow-v">{paceMinSec(p.paceSecPerKm)} <span className="muted">/km</span><span className="sr"> pace {formatPace(p.paceSecPerKm)}</span></p>
            </li>
          );
        })}
      </ul>

      <div className="chips">
        <Chip pressed={!treadmill} onClick={() => setTreadmill(!treadmill)}>Outdoor only</Chip>
        <Chip pressed={formOpen} onClick={() => setFormOpen(!formOpen)}>Custom period</Chip>
      </div>
      <p className="muted small">{treadmill ? 'Treadmill runs are included.' : 'Treadmill runs are left out. Press Outdoor only to include them.'} Complete weeks and months before {today}. "-" means no data.</p>

      {formOpen && (
        <div className="card" data-testid="custom-form">
          <h2 className="h-sm">Custom period</h2>
          <div className="row gap wrap">
            <label className="field">Start<input placeholder="YYYY-MM-DD" value={cs} onChange={(e) => setCs(e.target.value)} /></label>
            <label className="field">End<input placeholder="YYYY-MM-DD" value={ce} onChange={(e) => setCe(e.target.value)} /></label>
            <button type="button" onClick={addCustom}>Add period</button>
          </div>
          {err && <p role="alert" className="error">{err}</p>}
        </div>
      )}

      <Goals repo={repo} today={today} weekOf={today} version={version} onChanged={onChanged} kinds={RUN_KINDS} manage={false} heading="Running goals" />
      <Bests repo={repo} version={version} />
    </section>
  );
}
