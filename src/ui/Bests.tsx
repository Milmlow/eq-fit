import { useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Best, RunningBests } from '../lib/bests';
import { formatPace } from '../lib/running';
import { Badge } from './Badge';

const km = (b: Best) => (b.value === null ? '-' : `${b.value.toFixed(2)} km`);

export function Bests({ repo, version }: { repo: Repo; version: number }) {
  const [b, setB] = useState<RunningBests | null>(null);
  useEffect(() => { let live = true; void repo.runningBests().then((x) => { if (live) setB(x); }); return () => { live = false; }; }, [repo, version]);
  if (!b) return <p>Loading...</p>;
  const dash = (x: Best) => x.date ?? '-';
  return (
    <section className="card" aria-labelledby="bests-h" data-testid="bests">
      <h3 id="bests-h">Running bests <Badge kind="computed" /></h3>
      <p className="muted">Outdoor runs that have both a distance and a pace. Nothing is inferred: a 5 km split of a longer run is never invented.</p>
      <ul className="bests-list">
        <li data-testid="best-5k"><span className="bl">Fastest pace, runs of 5 km or more</span><span className="bv">{formatPace(b.fastest5k.value)}</span><span className="bm">{dash(b.fastest5k)} · n = {b.fastest5k.n} <Badge kind="watch-export" /></span></li>
        <li data-testid="best-10k"><span className="bl">Fastest pace, runs of 10 km or more</span><span className="bv">{formatPace(b.fastest10k.value)}</span><span className="bm">{dash(b.fastest10k)} · n = {b.fastest10k.n} <Badge kind="watch-export" /></span></li>
        <li data-testid="best-longest"><span className="bl">Longest run</span><span className="bv">{km(b.longest)}</span><span className="bm">{dash(b.longest)} · n = {b.longest.n} <Badge kind="watch-export" /></span></li>
        <li data-testid="best-week"><span className="bl">Best week by distance (Mon-Sun)</span><span className="bv">{km(b.bestWeek)}</span><span className="bm">{b.bestWeek.date ? `week of ${b.bestWeek.date}` : '-'}{b.bestWeek.runsInWeek ? ` (${b.bestWeek.runsInWeek} ${b.bestWeek.runsInWeek === 1 ? 'run' : 'runs'})` : ''} · n = {b.bestWeek.n} <Badge kind="watch-export" /></span></li>
      </ul>
      <p className="muted">n = how many qualifying runs the best was picked from (for the best week: how many weeks had a qualifying run). A pace best is the single fastest run, not an average. A tie goes to the earlier date. "-" means no qualifying run.</p>
    </section>
  );
}
