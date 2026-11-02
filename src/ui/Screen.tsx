import type { ReactNode } from 'react';
import { formatTodayLabel } from '../lib/todayStats';

/** Shared top of the Week, Lift, Run and More screens: wordmark, date, rule and a big italic title. Text only; no images. */
export function ScreenHead({ id, title, today, aside }: { id: string; title: string; today: string; aside?: ReactNode }) {
  return (
    <header className="sh">
      <div className="sh-top">
        <p className="wordmark sh-mark" aria-hidden="true"><span>EQ</span><span>FIT</span></p>
        <p className="hero-date sh-date">{formatTodayLabel(today)}</p>
      </div>
      <hr className="rule" />
      <div className="sh-title-row">
        <h1 id={id} className="sh-title">{title}</h1>
        {aside}
      </div>
    </header>
  );
}

/** Segmented control: a radio group, so arrow keys move between options and the choice is announced. */
export function Segmented<T extends string>({ label, name, value, options, onChange }: {
  label: string; name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="segc" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value} className={`segc-item${value === o.value ? ' on' : ''}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/** Toggle chip (pill button with aria-pressed). */
export function Chip({ pressed, onClick, children }: { pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`chip${pressed ? ' on' : ''}`} aria-pressed={pressed} onClick={onClick}>{children}</button>;
}
