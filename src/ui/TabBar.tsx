import type { ReactNode } from 'react';
import { IconLift, IconMore, IconRun, IconToday, IconWeek } from './Icons';

export type Tab = 'today' | 'week' | 'lift' | 'run' | 'more';
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'today', label: 'Today', icon: <IconToday /> },
  { id: 'week', label: 'Week', icon: <IconWeek /> },
  { id: 'lift', label: 'Lift', icon: <IconLift /> },
  { id: 'run', label: 'Run', icon: <IconRun /> },
  { id: 'more', label: 'More', icon: <IconMore /> },
];

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <button key={t.id} type="button" className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
