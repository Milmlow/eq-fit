import { useCallback, useEffect, useId, useState } from 'react';
import type { Repo } from '../db/repo';
import type { GoalKind, GoalRevision } from '../db/types';
import { GOAL_KINDS, progressText, unitOf, weekProgress, type GoalProgress } from '../lib/goals';
import { addDays, mondayOf } from '../lib/summary';
import { Badge } from './Badge';

const DEFAULT_TARGET: Record<GoalKind, string> = { lifts_per_week: '3', runs_per_week: '3', km_per_week: '20', sets_per_muscle_per_week: '10' };

function Bar({ p }: { p: GoalProgress }) {
  const label = `${p.goal.name}: ${p.value} of ${p.target} ${unitOf(p.goal.kind)}`;
  return (
    <div className={`bar${p.met ? ' met' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={p.target} aria-valuenow={Math.min(p.value, p.target)} aria-valuetext={label}>
      <span style={{ width: `${Math.round(p.fraction * 100)}%` }} />
    </div>
  );
}

/**
 * Weekly goals. Self-chosen only: nothing exists until you add it. No streaks; a week that fell short is just a number in plain text.
 * `weekOf` is any date; the Monday-Sunday week containing it is shown. `manage` adds create / edit / stop.
 */
export function Goals({ repo, today, weekOf, version, onChanged, kinds, manage, heading }: {
  repo: Repo; today: string; weekOf: string; version: number; onChanged: () => void; kinds?: GoalKind[]; manage: boolean; heading: string;
}) {
  const weekStart = mondayOf(weekOf);
  const isPast = addDays(weekStart, 6) < today;
  const [rows, setRows] = useState<GoalProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const hid = useId();

  const load = useCallback(async () => {
    const [revs, facts] = await Promise.all([repo.listGoalRevisions(), repo.goalWeekFacts(weekStart)]);
    setRows(weekProgress(revs, weekStart, facts).filter((p) => !kinds || kinds.includes(p.goal.kind)));
  }, [repo, weekStart, kinds]);
  useEffect(() => { void load(); }, [load, version]);

  /** Closing the edit form must not drop keyboard focus onto the page body: return it to that goal's Edit button. */
  function closeEdit(goalId: string) {
    setEditing(null);
    window.setTimeout(() => document.querySelector<HTMLElement>(`[data-testid="goal-${goalId}"] .goal-actions button`)?.focus(), 0);
  }

  async function act(fn: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    try { await fn(); await load(); onChanged(); return true; } catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
  }

  if (!rows) return <p>Loading...</p>;
  const thisMonday = mondayOf(today);
  return (
    <section className="card goals" aria-labelledby={hid} data-testid="goals">
      <h3 id={hid}>{heading} <span className="muted">week of {weekStart}</span> <Badge kind="computed" /></h3>
      {rows.length === 0 && (
        <p className="muted" data-testid="goals-empty">{manage ? 'No goals for this week. Goals are optional and yours to set; none are created for you.' : 'No running goals. You can add one under Week.'}</p>
      )}
      {rows.map((p) => (
        <div className="goal" key={p.goal.goal_id} data-testid={`goal-${p.goal.goal_id}`}>
          <div className="goal-head">
            <span className="goal-name">{p.goal.name}</span>
            <span className="muted">target {p.target} {unitOf(p.goal.kind)}{p.goal.kind === 'sets_per_muscle_per_week' && p.goal.muscle ? ` (${p.goal.muscle})` : ''}</span>
          </div>
          <Bar p={p} />
          <p className="goal-text" data-testid="goal-text">{isPast ? `Week of ${weekStart}: ` : ''}{progressText(p, isPast)}</p>
          {manage && editing !== p.goal.goal_id && (
            <div className="goal-actions">
              <button type="button" aria-label={`Edit goal ${p.goal.name}`} onClick={() => setEditing(p.goal.goal_id)}>Edit</button>
              <button type="button" aria-label={`Stop goal ${p.goal.name}`} onClick={() => { if (window.confirm('Stop this goal from this week on? Earlier weeks keep it.')) void act(() => repo.archiveGoal(p.goal.goal_id, thisMonday)); }}>Stop goal</button>
            </div>
          )}
          {manage && editing === p.goal.goal_id && (
            <GoalForm key={p.goal.id} initial={p.goal} thisMonday={thisMonday} submitLabel="Save change"
              onCancel={() => closeEdit(p.goal.goal_id)}
              onSubmit={async (v, from) => { if (await act(() => repo.reviseGoal(p.goal.goal_id, { name: v.name, target: v.target, muscle: v.muscle, include_treadmill: v.include_treadmill }, from))) closeEdit(p.goal.goal_id); }} />
          )}
        </div>
      ))}
      {error && <p role="alert" className="error">{error}</p>}
      {manage && <AddGoal onCreate={(v) => act(() => repo.createGoal(v, today))} />}
    </section>
  );
}

interface FormValues { kind: GoalKind; name: string; target: number; muscle: string | null; include_treadmill: boolean }

function AddGoal({ onCreate }: { onCreate: (v: FormValues) => Promise<boolean> }) {
  const [tmpl, setTmpl] = useState<GoalKind | null>(null);
  return (
    <details className="add-ex" open={tmpl !== null || undefined}>
      <summary>Add a goal</summary>
      <p className="muted">Pick a type to start from. You choose the name and the number.</p>
      <div className="tmpl" role="group" aria-label="Goal templates">
        {GOAL_KINDS.map((g) => (
          <button key={g.kind} type="button" aria-pressed={tmpl === g.kind} onClick={() => setTmpl(g.kind)}>{g.label}</button>
        ))}
      </div>
      {tmpl && (
        <GoalForm key={tmpl} kind={tmpl} thisMonday={null} submitLabel="Add goal" onCancel={() => setTmpl(null)}
          onSubmit={async (v) => { if (await onCreate(v)) setTmpl(null); }} />
      )}
    </details>
  );
}

function GoalForm({ initial, kind, thisMonday, submitLabel, onSubmit, onCancel }: {
  initial?: GoalRevision; kind?: GoalKind; thisMonday: string | null; submitLabel: string;
  onSubmit: (v: FormValues, effectiveFrom: string) => Promise<void>; onCancel: () => void;
}) {
  const k = initial?.kind ?? kind ?? 'lifts_per_week';
  const meta = GOAL_KINDS.find((g) => g.kind === k)!;
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(initial ? String(initial.target) : DEFAULT_TARGET[k]);
  const [muscle, setMuscle] = useState(initial?.muscle ?? '');
  const [tread, setTread] = useState(initial?.include_treadmill ?? false);
  const [from, setFrom] = useState(thisMonday ?? '');
  const [err, setErr] = useState<string | null>(null);
  const showTread = k === 'runs_per_week' || k === 'km_per_week';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = Number(target);
    if (target.trim() === '' || !Number.isFinite(t)) return setErr('Enter the target as a number.');
    setErr(null);
    try {
      await onSubmit({ kind: k, name, target: t, muscle: k === 'sets_per_muscle_per_week' ? muscle : null, include_treadmill: showTread ? tread : false }, from);
    } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
  }
  return (
    <form onSubmit={(e) => void submit(e)} aria-label={`${submitLabel}: ${meta.label}`} className="goal-form">
      <p className="muted flush">{meta.label}</p>
      <label className="field">Goal name<input value={name} maxLength={120} required autoFocus onChange={(e) => setName(e.target.value)} placeholder={meta.template} /></label>
      <label className="field">Target ({meta.unit} per week)<input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} required /></label>
      {k === 'sets_per_muscle_per_week' && (
        <label className="field">Muscle to count (as you typed it on your exercises)<input value={muscle} maxLength={60} required onChange={(e) => setMuscle(e.target.value)} placeholder="chest" /></label>
      )}
      {showTread && (
        <label className="check"><input type="checkbox" checked={tread} onChange={(e) => setTread(e.target.checked)} /> Count treadmill runs too (off = outdoor only)</label>
      )}
      {thisMonday !== null && (
        <label className="field">Applies from
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value={thisMonday}>this week (from Monday {thisMonday})</option>
            <option value={addDays(thisMonday, 7)}>next week (from Monday {addDays(thisMonday, 7)})</option>
          </select>
        </label>
      )}
      {err && <p role="alert" className="error">{err}</p>}
      <div className="row gap wrap"><button type="submit" className="primary">{submitLabel}</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
