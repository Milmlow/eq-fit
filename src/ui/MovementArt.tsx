/** Simple movement illustrations; the button label supplies the accessible name. */
export function MovementArt({ name }: { name: string }) {
  const bar = <><path d="M16 26h64" /><path d="M20 18v16m7-19v22m46-22v22m7-19v16" /></>;
  return <svg viewBox="0 0 96 80" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'Bench press' ? <><path d="M12 60h70M20 60v12m52-12v12" /><circle cx="24" cy="49" r="6" /><path d="M33 53h26l13 16M41 52V29m17 24V29" />{bar}</> : name === 'Chin-ups' ? <><path d="M12 10h72M17 10v8m62-8v8" /><circle cx="48" cy="29" r="6" /><path d="M48 37v21m0-17L28 29V12m20 29 20-12V12M48 58 35 72m13-14 13 14" /></> : name === 'Squat' ? <><circle cx="48" cy="15" r="6" /><path d="M48 24 57 44 36 54l17 18M57 44l12 13-7 15M48 27 29 34m19-7 20 7" /><path d="M17 29h62m-57-7v14m52-14v14" /></> : <><circle cx="58" cy="16" r="6" /><path d="M54 24 39 42l8 15-8 16M39 42l-12 12 3 19M52 27l6 28M43 35 36 55M17 61h64m-59-7v14m53-14v14" /></>}
  </svg>;
}
