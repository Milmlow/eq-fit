import { useEffect, useId, useRef, type ReactNode } from 'react';
import { MetricValue } from './HomeMasthead';

export function HomeCard({ title, value, caption, open, onToggle, children }: {
  title: string; value: string | number; caption: string;
  open: boolean; onToggle: () => void; children: ReactNode;
}) {
  const id = useId();
  const header = useRef<HTMLButtonElement>(null);
  const anchor = useRef<number>();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (panel.current) panel.current.inert = !open; }, [open]);
  useEffect(() => {
    if (!open || anchor.current === undefined) return;
    const cancel = () => { anchor.current = undefined; };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchmove', cancel, { passive: true });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => {
      const button = header.current;
      if (button && anchor.current !== undefined && document.activeElement === button) {
        window.scrollBy({ top: button.getBoundingClientRect().top - anchor.current, behavior: 'instant' });
      }
      anchor.current = undefined;
    }, reduced ? 0 : 230);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchmove', cancel);
    };
  }, [open]);
  return <section className={`home-data-card${open ? ' is-open' : ''}`}>
    <h2>
      <button className="home-card-header" type="button" aria-expanded={open} aria-controls={id} ref={header} onClick={() => {
        header.current?.focus({ preventScroll: true });
        anchor.current = header.current?.getBoundingClientRect().top;
        onToggle();
      }}>
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
