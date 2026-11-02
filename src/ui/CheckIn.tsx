import { useCallback, useEffect, useId, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Checkin } from '../db/types';
import { sparsePoints, windowMean, type Measure } from '../lib/checkins';
import { addDays } from '../lib/summary';
import { Badge } from './Badge';

const num = (s: string): number | null | 'bad' => (s.trim() === '' ? null : Number.isFinite(Number(s)) ? Number(s) : 'bad');

function Chart({ entries, selected, measure, unit, label }: { entries: Checkin[]; selected: string; measure: Measure; unit: string; label: string }) {
  const pts = sparsePoints(entries, selected, measure, 30);
  const start = addDays(selected, -29);
  if (pts.length === 0) return <p className="muted" data-testid={`chart-empty-${measure}`}>No {label.toLowerCase()} readings in the 30 days to {selected}.</p>;
  const W = 300, H = 130, L = 34, R = 8, T = 10, B = 26;
  const vals = pts.map((p) => p.value);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const x = (d: number) => L + (d / 29) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const desc = `${label}, ${pts.length} reading${pts.length === 1 ? '' : 's'} from ${start} to ${selected}: ${pts.map((p) => `${p.date} ${p.value} ${unit}`).join('; ')}`;
  return (
    <figure style={{ margin: '8px 0' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc} data-testid={`chart-${measure}`}>
        <rect className="win" x={x(23)} y={T} width={x(29) - x(23)} height={H - T - B} />
        <line className="axis" x1={L} y1={H - B} x2={W - R} y2={H - B} />
        <line className="axis" x1={L} y1={T} x2={L} y2={H - B} />
        <text x={L - 4} y={T + 4} textAnchor="end">{hi.toFixed(1)}</text>
        <text x={L - 4} y={H - B} textAnchor="end">{lo.toFixed(1)}</text>
        <text x={L} y={H - 8} textAnchor="start">{start.slice(5)}</text>
        <text x={W - R} y={H - 8} textAnchor="end">{selected.slice(5)}</text>
        {pts.map((p) => <circle key={p.date} cx={x(p.dayIndex)} cy={y(p.value)} r={4}><title>{`${p.date}: ${p.value} ${unit}`}</title></circle>)}
      </svg>
      <figcaption className="muted">{label} ({unit}), last 30 days. Dots are real readings only; nothing is drawn between them. Dashed box: the 7-day window.</figcaption>
    </figure>
  );
}

/**
 * Light weight / waist check-in. One entry per date; leaving a box blank stores "not measured" (never 0).
 * `compact` (Today): form and 7-day means. Full (More): adds the 30-day chart and the list of entries.
 */
export function CheckIn({ repo, today, version, onChanged, compact }: { repo: Repo; today: string; version: number; onChanged: () => void; compact: boolean }) {
  const [entries, setEntries] = useState<Checkin[] | null>(null);
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const hid = useId();

  const load = useCallback(async () => setEntries(await repo.listCheckins()), [repo]);
  useEffect(() => { void load(); }, [load, version]);

  // Selecting a date that already has an entry shows it for editing.
  useEffect(() => {
    if (!entries) return;
    const cur = entries.find((e) => e.date === date);
    setWeight(cur?.weight_kg?.toString() ?? ''); setWaist(cur?.waist_cm?.toString() ?? ''); setNote(cur?.note ?? '');
  }, [date, entries]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const w = num(weight), c = num(waist);
    if (w === 'bad' || c === 'bad') return setErr('Enter numbers only (or leave a box blank).');
    setErr(null); setSaved(null);
    try {
      await repo.saveCheckin({ date, weight_kg: w, waist_cm: c, note: note.trim() === '' ? null : note }, today);
      await load(); onChanged(); setSaved(`Saved check-in for ${date}.`);
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
  }
  async function remove(d: string) {
    setErr(null); setSaved(null);
    try { await repo.removeCheckin(d); await load(); onChanged(); setSaved(`Removed check-in for ${d}.`); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
  }

  if (!entries) return <p>Loading...</p>;
  const selected = date > today ? today : date;
  const wm = windowMean(entries, selected, 'weight_kg'), cm = windowMean(entries, selected, 'waist_cm');
  const mean = (m: typeof wm, unit: string) => (m.mean === null
    ? <>- <span className="muted">(no readings in the window)</span></>
    : <><b>{m.mean.toFixed(2)} {unit}</b> <span className="muted">(n = {m.n} of 7 days)</span></>);
  const has = entries.some((e) => e.date === date);

  return (
    <section className="card" aria-labelledby={hid} data-testid="checkin">
      <h3 id={hid}>Check-in <span className="muted">weight and waist</span></h3>
      <p className="mean-line" data-testid="mean-weight">7-day mean weight <Badge kind="computed" />: {mean(wm, 'kg')}</p>
      <p className="mean-line" data-testid="mean-waist">7-day mean waist <Badge kind="computed" />: {mean(cm, 'cm')}</p>
      <p className="muted" data-testid="mean-window">Window: the 7 calendar days {wm.start} to {wm.end}. Days without a reading are left out, not filled in.</p>

      <details className="add-ex" open={!compact || undefined}>
        <summary>{has ? `Edit the check-in for ${date}` : 'Add a check-in'}</summary>
        <form onSubmit={(e) => void save(e)} aria-label="Weight and waist check-in">
          <label className="field">Date<input type="date" value={date} max={today} required onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          <div className="grid3">
            <label className="field">Weight (kg)<input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
            <label className="field">Waist (cm)<input inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} /></label>
          </div>
          <label className="field">Note (optional)<input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
          <p className="muted flush">Leave a box blank if you did not measure it. Blank is saved as "not measured", never as 0.</p>
          {err && <p role="alert" className="error">{err}</p>}
          {saved && <p role="status" data-testid="checkin-saved">{saved}</p>}
          <div className="row gap wrap">
            <button type="submit" className="primary">Save check-in</button>
            {has && <button type="button" className="danger" onClick={() => void remove(date)}>Remove this date</button>}
          </div>
        </form>
      </details>

      {!compact && (
        <>
          <Chart entries={entries} selected={selected} measure="weight_kg" unit="kg" label="Weight" />
          <Chart entries={entries} selected={selected} measure="waist_cm" unit="cm" label="Waist" />
          <h4>Entries</h4>
          {entries.length === 0 && <p className="muted" data-testid="checkin-empty">No check-ins yet.</p>}
          <ul className="checkin-list" data-testid="checkin-list">
            {[...entries].reverse().slice(0, 60).map((e) => (
              <li key={e.id}>
                <span>{e.date}: weight {e.weight_kg === null ? '-' : `${e.weight_kg} kg`}, waist {e.waist_cm === null ? '-' : `${e.waist_cm} cm`}{e.note && <> <span className="muted">note: {e.note}</span></>}</span>
                <span className="row gap">
                  <button type="button" aria-label={`Edit check-in ${e.date}`} onClick={() => setDate(e.date)}>Edit</button>
                  <button type="button" aria-label={`Remove check-in ${e.date}`} onClick={() => void remove(e.date)}>Remove</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
