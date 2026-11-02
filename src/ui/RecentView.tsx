import { useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Activity } from '../db/types';
import type { Group } from '../lib/mapping';
import { addDays, mondayOf, summarise, window28, type Summary } from '../lib/summary';

type Row = Activity & { group: Group };

interface Data {
  start: string;
  end: string;
  rows: Row[];
  total: Summary;
  weeks: Summary[];
}

const LABEL: Record<Exclude<Group, 'other'>, string> = {
  weights: 'Weights',
  outdoor_run: 'Outdoor runs',
  treadmill_run: 'Treadmill runs',
};
const ORDER: Exclude<Group, 'other'>[] = ['weights', 'outdoor_run', 'treadmill_run'];

export function RecentView({ repo, version }: { repo: Repo; version: number }) {
  const [data, setData] = useState<Data | null | 'empty'>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const anchor = await repo.latestActivityDate();
      if (!anchor) return live && setData('empty');
      const { start, end } = window28(anchor);
      const rows = await repo.activitiesBetween(start, end);
      const weeks: Summary[] = [];
      for (let w = mondayOf(start); w <= end; w = addDays(w, 7)) {
        weeks.push(summarise(rows, w < start ? start : w, addDays(w, 6) > end ? end : addDays(w, 6)));
      }
      if (live) setData({ start, end, rows, total: summarise(rows, start, end), weeks });
    })();
    return () => { live = false; };
  }, [repo, version]);

  if (data === null) return <p>Loading...</p>;
  if (data === 'empty') return <p data-testid="empty">No activities yet. Import a CSV first.</p>;

  return (
    <section aria-labelledby="rec-h">
      <h2 id="rec-h">Last 28 days</h2>
      <p className="muted" data-testid="window">
        {data.start} to {data.end} (ends on the latest imported activity date; times are as exported, no timezone applied)
      </p>

      <table data-testid="totals">
        <caption>Totals for the window</caption>
        <thead>
          <tr><th scope="col">Group</th><th scope="col">Entries</th><th scope="col">Days</th><th scope="col">km</th><th scope="col">Minutes</th></tr>
        </thead>
        <tbody>
          {ORDER.map((g) => {
            const t = data.total[g];
            return (
              <tr key={g} data-testid={`total-${g}`}>
                <th scope="row">{LABEL[g]}</th>
                <td className="num">{t.entries}</td><td className="num">{t.distinctDays}</td>
                <td className="num">{t.km.toFixed(2)}</td><td className="num">{t.minutes.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>Active dates (any activity type): <strong data-testid="active-dates">{data.total.activeDates}</strong></p>

      <h3>By week (Monday to Sunday, dates are MM-DD)</h3>
      <div className="scroll">
        <table data-testid="weeks">
          <thead>
            <tr><th scope="col">Week</th><th scope="col">Weights</th><th scope="col">Outdoor runs</th><th scope="col">Run km</th><th scope="col">Treadmill</th></tr>
          </thead>
          <tbody>
            {data.weeks.map((w) => (
              <tr key={w.start} data-testid={`week-${w.start}`}>
                <th scope="row" className="nowrap" title={`${w.start} to ${w.end}`}>{w.start.slice(5)} to {w.end.slice(5)}</th>
                <td className="num">{w.weights.entries}</td><td className="num">{w.outdoor_run.entries}</td>
                <td className="num">{w.outdoor_run.km.toFixed(2)}</td><td className="num">{w.treadmill_run.entries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ORDER.map((g) => {
        const list = data.rows.filter((r) => r.group === g);
        return (
          <div key={g}>
            <h3>{LABEL[g]} ({list.length})</h3>
            {list.length === 0 ? <p className="muted">None in this window.</p> : (
              <ul className="acts">
                {list.map((r) => (
                  <li key={r.id} className="act">
                    <span><span className="mono nowrap">{r.timestamp_local}</span> {r.title}</span>
                    <span className="muted nowrap">
                      [{r.original_type}] {r.duration_seconds !== null ? `${(r.duration_seconds / 60).toFixed(1)} min` : 'no duration'}
                      {r.distance_km ? `, ${r.distance_km.toFixed(2)} km` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
