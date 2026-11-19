import { useState, type ReactNode } from 'react';
import { HOME_DESIGNS, readHomeDesign, type HomeDesign } from '../lib/homeOverview';
import { formatTodayLabel } from '../lib/todayStats';
import './home.css';

function initialDesign() {
  try { return readHomeDesign(localStorage); }
  catch { return HOME_DESIGNS[0]; }
}

export function HomeMasthead({ today, stats, children, panels }: {
  today: string;
  stats?: { strength: number; cardio: number };
  children: ReactNode;
  panels?: ReactNode;
}) {
  const [design, setDesign] = useState(initialDesign);
  const [notice, setNotice] = useState('');
  function chooseDesign(option: HomeDesign) {
    setDesign(option);
    try { localStorage.setItem('eqfit.home-design', option.id); setNotice(''); }
    catch { setNotice('Theme selected for this visit. This browser could not save it.'); }
  }
  return <div className={`home-experience home-${design.id}`}>
    <section className="home-masthead" aria-label={design.label}>
      <div className="home-art" aria-hidden="true"><i /><i /><i /></div>
      <header className="home-byline"><h1>EQ FIT</h1><time dateTime={today}>{formatTodayLabel(today)}</time></header>
      <p className="home-title">{design.title}</p>
      <div className="home-workout">{children}</div>
      {stats && <dl className="home-totals" aria-label="This week">
        <div><dt>strength this week</dt><dd><MetricValue value={stats.strength} /></dd></div>
        <div><dt>cardio</dt><dd><MetricValue value={stats.cardio} /></dd></div>
      </dl>}
    </section>
    {panels}
    <details className="home-designs">
      <summary>Home theme <span>{design.label}</span></summary>
      <div className="home-theme-options" role="group" aria-label="Choose a Home theme">
        {HOME_DESIGNS.map(option => <button className={`home-theme-preview home-${option.id}`} key={option.id} type="button"
          aria-pressed={design.id === option.id} onClick={() => chooseDesign(option)}>
          <span className="home-theme-swatch" aria-hidden="true"><b>EQ</b><i /></span>
          <span>{option.label}</span>
        </button>)}
      </div>
      {notice && <p role="status">{notice}</p>}
    </details>
  </div>;
}

export function MetricValue({ value }: { value: string | number }) {
  // The keyed span animates changed values; the value itself is always the real total.
  return <span key={value} className="home-metric-value">{value}</span>;
}
