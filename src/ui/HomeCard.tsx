import { useEffect, useId, useRef, type ReactNode } from 'react';
import { MetricValue } from './HomeMasthead';

export function HomeCard({ title, value, caption, open, onToggle, children }: {
  title: string; value: string | number; caption: string;
  open: boolean; onToggle: () => void; children: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (panel.current) panel.current.inert = !open; }, [open]);
  return <section className={`home-data-card${open ? ' is-open' : ''}`}>
    <h2>
      <button className="home-card-header" type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="home-card-label"><strong>{title}</strong><small>{caption}</small></span>
        <span className="home-card-value"><MetricValue value={value} /></span>
        <span className="home-card-chevron" aria-hidden="true">⌄</span>
      </button>
    </h2>
    <div id={id} className="home-card-reveal" ref={panel} role="region" aria-label={title}>
      <div className="home-card-clip"><div className="home-card-content">{children}</div></div>
    </div>
  </section>;
}
