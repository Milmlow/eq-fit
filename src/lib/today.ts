/** Local calendar date (YYYY-MM-DD). `?today=YYYY-MM-DD` overrides it (for deterministic checks only). */
export function localToday(search = typeof window === 'undefined' ? '' : window.location.search, now = new Date()): string {
  const o = new URLSearchParams(search).get('today');
  if (o && /^\d{4}-\d{2}-\d{2}$/.test(o) && !Number.isNaN(Date.parse(`${o}T00:00:00Z`)) && new Date(`${o}T00:00:00Z`).toISOString().slice(0, 10) === o) return o;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
