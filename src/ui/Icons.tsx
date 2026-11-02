// Original inline icons (stroke = currentColor). Decorative: the visible label carries the meaning.
const base = { width: 28, height: 28, viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;

export const IconToday = () => (
  <svg {...base}><rect x="4" y="7" width="24" height="21" rx="3" /><path d="M4 13h24M10 3v6M22 3v6" /></svg>
);
export const IconWeek = () => (
  <svg {...base}><path d="M6 27V17M16 27V8M26 27V13" strokeWidth={5} /></svg>
);
export const IconLift = () => (
  <svg {...base}><path d="M3 12v8M8 8v16M24 8v16M29 12v8M8 16h16" /></svg>
);
export const IconRun = () => (
  <svg {...base}><circle cx="20" cy="6" r="2.5" /><path d="M14 27l3-8-5-4 3-6 6 3 4 3M12 12l-5 3M17 19l6 3 1 5" /></svg>
);
export const IconMore = () => (
  <svg {...base} fill="currentColor" stroke="none"><circle cx="6" cy="16" r="3" /><circle cx="16" cy="16" r="3" /><circle cx="26" cy="16" r="3" /></svg>
);
export const IconArrow = () => (
  <svg viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" aria-hidden="true" focusable="false"><path d="M2 20h56M40 4l20 16-20 16" /></svg>
);
