import { useState, type ReactNode } from 'react';
import { formatTodayLabel } from '../lib/todayStats';
import './home.css';

const homeDesigns = [
  { id: 'pit-lane', label: 'Pit Lane', title: <>Ready to<br />race.</> },
  { id: 'front-page', label: 'Front Page', title: <>The training<br />edition.</> },
  { id: 'after-hours', label: 'After Hours', title: <>Night<br />shift.</> },
] as const;

function initialDesign() {
  try {
    const saved = localStorage.getItem('eqfit.home-design');
    return homeDesigns.find(design => design.id === saved) ?? homeDesigns[0];
  } catch {
    return homeDesigns[0];
  }
}

export function HomeMasthead({ today, stats, children }: {
  today: string;
  stats?: { strength: number; cardio: number };
  children: ReactNode;
}) {
  const [design, setDesign] = useState(initialDesign);
  return <>
    <section className={`home-masthead home-${design.id}`} aria-label={design.label}>
      <div className="home-art" aria-hidden="true"><i /><i /><i /></div>
      <header className="home-byline"><h1>EQ FIT</h1><time dateTime={today}>{formatTodayLabel(today)}</time></header>
      <p className="home-title">{design.title}</p>
      {stats && <dl className="home-totals" aria-label="This week">
        <div><dt>Strength</dt><dd>{stats.strength}</dd></div>
        <div><dt>Cardio</dt><dd>{stats.cardio}</dd></div>
      </dl>}
      <div className="home-workout">{children}</div>
    </section>
    <details className="home-designs">
      <summary>Home design <span>{design.label}</span></summary>
      <div role="group" aria-label="Choose a Home design">
        {homeDesigns.map(option => <button key={option.id} type="button" aria-pressed={design.id === option.id} onClick={() => {
          setDesign(option);
          try { localStorage.setItem('eqfit.home-design', option.id); } catch { /* The choice still works for this visit. */ }
        }}>{option.label}</button>)}
      </div>
    </details>
  </>;
}
