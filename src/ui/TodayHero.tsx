import { useEffect, useId, useState } from 'react';
import { ALT_INCREMENT_KG, fmtKg, type BeatResult, type Lift } from '../lib/beatLastTime';
import type { HeroData } from '../lib/hero';
import { dash, paceMinSec } from '../lib/todayStats';
import { hintText } from '../lib/lifting';
import { Badge } from './Badge';
import { CrazyArt } from './CrazyArt';
import { IconArrow } from './Icons';

/** Quick (under 300 ms) count-up of the target reps from last time's reps. Skipped under reduced motion. Never blocks Start. */
function CountUp({ from, to }: { from: number; to: number }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || to <= from || to - from > 12) { setV(to); return; }
    setV(from);
    const steps = to - from;
    const timers = Array.from({ length: steps }, (_, i) => window.setTimeout(() => setV(from + i + 1), Math.round(((i + 1) * 240) / steps)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [from, to]);
  return <>{v}</>;
}

function Block({ cls, label, lift, countFrom }: { cls: string; label: string; lift: Lift | null; countFrom?: number }) {
  const name = lift ? `${label}: ${fmtKg(lift.load_kg)} kilograms for ${lift.reps} reps` : `${label}: none`;
  return (
    <div className={`blk ${cls}`} role="group" aria-label={name}>
      <span className="blk-label" aria-hidden="true">{label}</span>
      <span className="blk-load" aria-hidden="true">{lift ? `${fmtKg(lift.load_kg)} kg ×` : '-'}</span>
      <span className="blk-reps" aria-hidden="true">{lift ? (countFrom !== undefined ? <CountUp from={countFrom} to={lift.reps} /> : lift.reps) : '-'}</span>
    </div>
  );
}

function Explainer({ id }: { id: string }) {
  return (
    <div id={id} className="explain card" role="note">
      <p><Badge kind="proposed" /> <Badge kind="computed" /> These numbers are proposed, computed from your own logs.</p>
      <ul>
        <li>Last time: your best working set from the most recent earlier session of this exercise (highest Epley estimated 1RM; a tie goes to more reps). Warm-ups are left out.</li>
        <li>Today's target: the same load, one more rep. If you set a rep range and one more rep would pass its top, a 2.5 kg load increase is shown instead, when your progression hint allows it.</li>
        <li>Alternative: {fmtKg(ALT_INCREMENT_KG)} kg heavier, with the fewest reps that still match last time's estimated 1RM.</li>
        <li>New PR: shown only if the target's estimated 1RM would beat the best you have ever recorded for this exercise. It is a possibility, not a record you have set.</li>
        <li>If your last session has a pain note, only Last time is shown.</li>
      </ul>
    </div>
  );
}

function BeatBody({ beat }: { beat: BeatResult }) {
  if (beat.kind === 'none') return <p className="neutral safe">No last time yet.</p>;
  if (beat.kind === 'pain') return <div className="trio single"><Block cls="last" label="Last time" lift={beat.last} /></div>;
  if (beat.kind === 'hold') {
    return (
      <>
        <div className="trio single"><Block cls="last" label="Last time" lift={beat.last} /></div>
        <p className="hint safe">{hintText('stay')}</p>
      </>
    );
  }
  return (
    <div className="trio">
      <Block cls="last" label="Last time" lift={beat.last} />
      <Block cls="target" label="Today’s target" lift={beat.target} countFrom={beat.last.reps} />
      <Block cls="alt" label="Alternative" lift={beat.alternative} />
    </div>
  );
}

export interface HeroProps {
  data: HeroData;
  theme: 'light' | 'dark' | 'crazy';
  onStart: () => void;
  starting: boolean;
  demo: boolean;
}

export function TodayHero({ data, theme, onStart, starting, demo }: HeroProps) {
  const [explain, setExplain] = useState(false);
  const eid = useId();
  const { beat, lastWeek } = data;
  const showPr = beat.kind === 'target' && beat.pr;
  return (
    <section className="hero" aria-label="Today">
      {theme === 'crazy' && <CrazyArt />}
      <div className="hero-top">
        <h1 className="wordmark safe" aria-label="EQ FIT"><span>EQ</span><span>FIT</span></h1>
        <p className="hero-date safe" data-testid="hero-date">{data.dateLabel}</p>
      </div>
      <hr className="rule" />
      <h2 className="session-title safe" data-testid="hero-title">{data.title}</h2>
      <button type="button" className="start" onClick={onStart} disabled={starting} data-testid="start">
        <span className="start-in"><span>{starting ? 'Starting' : 'Start'}</span><IconArrow /></span>
      </button>
      {demo && <p className="demo-note safe" role="status">Demo values, nothing is saved. No session was started.</p>}

      <div className="beat">
        <div className="beat-head safe">
          <h3>Beat last time</h3>
          <button type="button" className="why" aria-expanded={explain} aria-controls={eid} aria-label="How these numbers are worked out" onClick={() => setExplain((x) => !x)}>?</button>
        </div>
        <div className="beat-name-row">
          {data.exerciseName && <p className="ex-name safe" data-testid="hero-exercise">{data.exerciseName}</p>}
          {showPr && (
            <span className="pr" role="img" aria-label="New PR. It would be a new personal record if you hit today's target." data-testid="hero-pr">New PR</span>
          )}
        </div>
        {explain && <Explainer id={eid} />}
        <BeatBody beat={beat} />
      </div>

      <hr className="rule" />
      <div className="stats">
        <div className="stat-week safe" data-testid="hero-week">
          <h3>Last week</h3>
          <p><b>{dash(lastWeek.lifts)}</b> <span>lifts</span></p>
          <p><b>{dash(lastWeek.runs)}</b> <span>runs</span></p>
          <p><b>{dash(lastWeek.km, 2)}</b> <span>km</span></p>
        </div>
        <div className="stat-pace safe" data-testid="hero-pace">
          <h3>4-week running average</h3>
          <p className="pace"><b>{paceMinSec(data.paceSec)}</b></p>
          <p className="per">per km</p>
        </div>
      </div>
    </section>
  );
}
