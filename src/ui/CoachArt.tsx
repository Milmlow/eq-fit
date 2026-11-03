import type { Expression } from '../lib/coach';
/** Original vector character, built for small screens; no external images or animation. */
export function CoachArt({expression='clipboard'}:{expression?:Expression}) {
 const robe=expression==='robe', rest=expression==='deckchair', proud=expression==='proud', trophy=expression==='trophy', permit=expression==='permit';
 return <svg className="coach-art" viewBox="0 0 180 180" role="img" aria-label={`Coach EQ: ${expression}`}>
  <circle cx="90" cy="90" r="85" fill="var(--paper)"/>
  <g stroke="var(--fg)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
   {rest&&<g fill="none"><path d="M25 98l43 65m-45 -4l56 -57m-48 4h48l-21 39H39"/><path d="M30 108l29 37m-17 -37l25 26" stroke="var(--accent)"/></g>}
   <g transform={rest?'translate(12 6) rotate(12 82 100)':proud?'translate(0 -3)':'translate(0 0)'}>
    <path d={robe?'M46 99L31 165h105l-17 -66 -35 11z':'M48 102Q28 115 31 160h106q3 -46 -20 -58z'} fill={robe?'var(--blue)':'var(--accent)'}/>
    {robe?<><path d="M61 99l23 49 22 -49 -22 10z" fill="var(--paper)"/><path d="M36 146h94m-48 0l-8 18m10 -18l12 18"/><path d="M42 128h17v14H42z" fill="none"/></>:<path d="M65 102l19 36 19 -36" fill="none"/>}
    <path d="M79 134h13v10H79z" fill="var(--paper)"/>
    <path d="M49 48q-10 -7 -12 5t11 15m70 -20q12 -7 12 5t-12 15" fill="var(--paper)"/>
    <path d="M46 40q1 -27 38 -27t38 28l-6 38q-9 26 -32 26T51 79z" fill="var(--paper)"/>
    <path d="M46 42q-4 -29 38 -29t39 29l-21 -13 -13 9 -20 -10z" fill="var(--fg)"/>
    <path d={robe?'M57 56h18m18 0h18':proud?'M57 51q10 -6 18 0m18 0q9 -6 18 0':'M56 48l20 9m17 -9l20 -7'} fill="none" strokeWidth="5"/>
    {robe?<path d="M61 65h10m25 0h10"/>:<><circle cx="67" cy="65" r="2.5" fill="var(--fg)"/><circle cx="102" cy="65" r="2.5" fill="var(--fg)"/></>}
    <path d="M84 63l-4 13h9" fill="none"/>
    <path d={proud?'M68 84q16 17 32 0':robe?'M77 88q7 -10 14 0q-6 10 -14 0':'M70 89l28 -5'} fill={robe?'var(--fg)':'none'}/>
    <path d="M60 78l5 2m41 -2l-4 2" stroke="var(--muted)"/>
   </g>
   {trophy?<><path d="M109 130l29 -25" fill="none" strokeWidth="10"/><path d="M136 98h15v10q-7 11 -15 0z M143 115v9m-7 0h14m-14 -23h-6q-2 13 11 12m10 -12h6q2 13 -10 12" fill="var(--warn)"/><path d="M138 83v-6m17 13l6 -5m-30 5l-6 -5" stroke="var(--muted)"/></>:permit?<><rect x="104" y="108" width="61" height="48" rx="4" fill="var(--paper)"/><path d="M114 120h38m-38 10h25m-25 12h34" stroke="var(--muted)"/><path d="M112 112l44 36m0 -36l-44 36" stroke="var(--accent)" strokeWidth="6"/></>:robe?<><path d="M120 126h27v27h-27z m27 5q20 -3 10 13h-10" fill="var(--paper)"/><path d="M126 116q-7 -9 0 -15m13 15q-7 -9 0 -15" fill="none" stroke="var(--muted)"/></>:proud?<path d="M121 131l13 -8v-15q9 -7 10 7v8h16l-4 24h-22z" fill="var(--paper)"/>:!rest?<><rect x="110" y="109" width="47" height="54" rx="4" fill="var(--paper)"/><path d="M121 106h24v9h-24z M119 127h29m-29 11h22m-22 11h26" fill="none"/></>:null}
  </g>
 </svg>;
}
