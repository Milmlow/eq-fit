import { useState } from 'react';
import { bulkBalanceStrength, previewStrengthDistribution, untaggedImportedStrength, undoBulkBalanceStrength, type BulkStrengthUndo } from '../lib/bulkStrength';
import type { Repo } from '../db/repo';
import type { TrainingEntry } from '../lib/dashboardFocus';
import { BODY_PARTS, sessionParts, trainingBalance } from '../lib/trainingBalance';
import { allocateSession, SESSION_ACTIVITIES, sessionActivity, type SessionActivity } from '../lib/sessionActivity';
import { formatTodayLabel, paceMinSec } from '../lib/todayStats';
import { MetricValue } from './HomeMasthead';
import { muscleHistory, isEstimatedStrength } from '../lib/muscleHistory';

export function TrainingOverview({ repo, today, entries, onChanged }: {
  repo: Repo; today: string; entries: TrainingEntry[]; onChanged: () => void;
}) {
  const data = trainingBalance(entries, today);
  const pending = data.pending[0];
  const history = muscleHistory(entries, today);
  const historyMax = Math.max(1, ...history.map(area => area.total));
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const selectedHistory = history.find(area => area.part === selectedArea);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkUndo, setBulkUndo] = useState<BulkStrengthUndo>([]);
  const eligible = untaggedImportedStrength(entries);
  async function applyBulk() {
    if (bulkBusy || !eligible.length) return;
    setBulkBusy(true); setBulkError('');
    try { const snapshot = await bulkBalanceStrength(repo, eligible); setBulkUndo(snapshot); setConfirmBulk(false); onChanged(); }
    catch { setBulkError('Unable to categorise sessions. Nothing changed. Refresh and try again.'); }
    finally { setBulkBusy(false); }
  }
  async function undoBulk() {
    if (bulkBusy || !bulkUndo.length) return;
    setBulkBusy(true); setBulkError('');
    try { await undoBulkBalanceStrength(repo, bulkUndo); setBulkUndo([]); onChanged(); }
    catch { setBulkError('Cannot safely undo because some sessions changed. Your data was left untouched.'); }
    finally { setBulkBusy(false); }
  }
  return <section className="training-overview" aria-label="Training dashboard">
    <p className="training-period">This week · {formatTodayLabel(data.start)} – {formatTodayLabel(today)}</p>
    <div className="training-run-totals">
      <div><strong><MetricValue value={data.runs.km === null ? '—' : data.runs.km.toFixed(1)} /></strong><span>km run</span></div>
      <div><strong><MetricValue value={paceMinSec(data.runs.paceSecPerKm)} /></strong><span>average pace / km</span></div>
    </div>
    <details className="training-metric-notes"><summary>Running figures</summary>
      <p>Running sessions this week, including treadmill and sessions you label Running. Pace is distance-weighted using saved pace and distance.</p>
      <p>Pace available for {data.runs.runsWithPace} of {data.runs.runs} runs.
        {data.missingDistance > 0 && ` Distance missing for ${data.missingDistance}.`}</p>
    </details>
    {(eligible.length > 0 || bulkUndo.length > 0) && <section className="training-classify" aria-label="Bulk strength categorisation">
      <p className="eyebrow">SORT YOUR STRENGTH HISTORY</p>
      {eligible.length > 0 && <><p>{eligible.length} untagged Garmin strength sessions. Spread evenly across five areas in date order.</p>
        {!confirmBulk ? <button type="button" className="primary training-save" onClick={() => setConfirmBulk(true)}>Balance {eligible.length} sessions</button> : <>
          <div className="training-area-grid">{previewStrengthDistribution(eligible.length).map(item => <div key={item.part} className="training-area"><span>{item.part}</span><strong>{item.count}</strong></div>)}</div>
          <p className="muted small">These are estimates, not verified exercises. Original Garmin data and existing tags stay intact.</p>
          <button type="button" className="primary training-save" disabled={bulkBusy} onClick={() => void applyBulk()}>{bulkBusy ? 'Saving…' : 'Confirm bulk allocation'}</button>
          <button type="button" disabled={bulkBusy} onClick={() => setConfirmBulk(false)}>Cancel</button>
        </>}
      </>}
      {bulkUndo.length > 0 && <button type="button" disabled={bulkBusy} onClick={() => void undoBulk()}>Undo last bulk allocation</button>}
      {bulkError && <p role="alert" className="error">{bulkError}</p>}
    </section>}
    {pending ? <ClassifySession key={pending.id} repo={repo} entry={pending} onChanged={onChanged} remaining={data.pending.length} />
      : <details className="training-sorted"><summary>{entries.some(entry => entry.activity) ? '✓ Garmin all caught up' : 'Garmin not connected yet'}</summary>
          <p>{entries.some(entry => entry.activity) ? 'Nothing needs categorising. New sessions will appear here when imported.' : 'Import or sync Garmin activities to begin sorting.'}</p>
        </details>}
    <section className="training-balance" aria-label="Training split and muscle history">
      <h2>Your session split <small>· this week</small></h2>
      <div className="training-split-totals">
        <p><strong><MetricValue value={data.effort.strength} /></strong> Strength</p>
        <p><strong><MetricValue value={data.effort.cardio} /></strong> Cardio <small>includes runs</small></p>
        {data.other > 0 && <p><strong>{data.other}</strong> Other</p>}
      </div>
      <details className="muscle-history-fold">
        <summary>Muscle-group history <small>· all recorded dates</small></summary>
        <div className="muscle-history-bars" aria-label="Muscle group history by category">
          {history.map(area => <button key={area.part} type="button" className="muscle-history-row"
            aria-pressed={selectedArea === area.part} onClick={() => { setSelectedArea(current => current === area.part ? null : area.part); setShowAllHistory(false); }}>
            <span className="muscle-history-name">{area.part}</span>
            <span className="muscle-history-stack" aria-hidden="true">
              <i className="muscle-history-confirmed" style={{width:`${area.confirmed / historyMax * 100}%`}} />
              <i className="muscle-history-estimated" style={{width:`${area.estimated / historyMax * 100}%`}} />
            </span>
            <strong>{area.total}</strong>
          </button>)}
        </div>
        <p className="muted small">Solid = confirmed tags · Striped = estimated allocation. Estimates do not count as evidence of exercises, sets or personal records.</p>
        {selectedHistory && <div className="muscle-history-detail">
          <h3>{selectedHistory.part} · {selectedHistory.total} sessions</h3>
          <p className="muted small">{selectedHistory.confirmed} confirmed · {selectedHistory.estimated} estimated</p>
          {selectedHistory.sessions.length === 0 ? <p>No sessions tagged yet.</p> : <ul>
            {selectedHistory.sessions.slice(0,showAllHistory ? undefined : 8).map(entry => <li key={entry.id}>
              <span>{formatTodayLabel(entry.date)} · {entry.title}</span>
              <small>{isEstimatedStrength(entry) ? 'Estimated' : 'Confirmed tag'}</small>
            </li>)}
          </ul>}
          {selectedHistory.sessions.length > 8 && <button type="button" className="muscle-history-more" onClick={() => setShowAllHistory(current => !current)}>
            {showAllHistory ? 'Show fewer' : `Show all ${selectedHistory.total}`}
          </button>}
        </div>}
      </details>
      <p className="muted small">This week: {data.areas.filter(area => area.count > 0).map(area => `${area.part} ${area.count}`).join(' · ') || 'No muscle groups tagged'}.
        {data.untaggedStrength > 0 && ` ${data.untaggedStrength} strength ${data.untaggedStrength === 1 ? 'session needs' : 'sessions need'} tagging.`}
      </p>
    </section>
  </section>;
}

function ClassifySession({ repo, entry, remaining, onChanged }: {
  repo: Repo; entry: TrainingEntry; remaining: number; onChanged: () => void;
}) {
  const [label, setLabel] = useState<SessionActivity | ''>(() => sessionActivity(entry.activity, entry.workout) ?? '');
  const [parts, setParts] = useState(() => sessionParts(entry));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (busy || !label || (label === 'Strength' && !parts.length)) return;
    setBusy(true); setError('');
    try {
      await allocateSession(repo, entry, label, label === 'Strength' ? parts : undefined);
      setSaved(true);
      onChanged();
    } catch {
      setError('Session labels could not be saved. Your choices are ready to retry.');
    } finally {
      setBusy(false);
    }
  }
  return <section className="training-classify" aria-label="Latest Garmin session needing input">
    <p className="eyebrow">LATEST TO SORT{remaining > 1 ? ` · ${remaining} waiting` : ''}</p>
    <h2>{entry.title}</h2>
    <p className="muted small">{formatTodayLabel(entry.date)}
      {entry.activity?.duration_seconds != null && ` · ${Math.round(entry.activity.duration_seconds / 60)} min`}
    </p>
    {saved ? <p role="status">Session saved ✓</p> : <>
      <fieldset disabled={busy}>
        <legend>What did you do?</legend>
        <div className="training-choice-grid">
          {SESSION_ACTIVITIES.map(activity => <button key={activity} type="button" aria-pressed={label === activity}
            onClick={() => setLabel(activity)}>{activity}</button>)}
        </div>
        {label === 'Strength' && <>
          <p className="training-body-label">Which areas? Pick all that apply.</p>
          <div className="training-choice-grid" role="group" aria-label="Body areas">
            {BODY_PARTS.map(part => <button type="button" key={part} aria-pressed={parts.includes(part)}
              onClick={() => setParts(current => current.includes(part) ? current.filter(value => value !== part) : [...current, part])}>{part}</button>)}
          </div>
        </>}
      </fieldset>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="button" className="primary training-save" disabled={busy || !label || (label === 'Strength' && !parts.length)}
        onClick={() => void save()}>{busy ? 'Saving…' : 'Save session'}</button>
    </>}
  </section>;
}
