import { useState } from 'react';
import type { Exercise } from '../db/types';
import { loadMode,strengthPoints,type StrengthMetric,type StrengthSession } from '../lib/strengthProgress';
const dateLabel=(s:string)=>`${s.slice(8)}/${s.slice(5,7)}`;
export function StrengthChart({exercise,sessions,today}:{exercise:Exercise;sessions:StrengthSession[];today:string}) {
 const mode=loadMode(exercise);
 const [all,setAll]=useState(false),[metric,setMetric]=useState<StrengthMetric>(mode==='external'?'load':'reps');
 const points=strengthPoints(sessions,metric,today,all),valid=points.filter(p=>p.value!==null);
 const max=Math.max(1,...valid.map(p=>p.value!));
 const first=Date.parse((points[0]?.date??today)+'T00:00:00Z'),last=Date.parse((points.at(-1)?.date??today)+'T00:00:00Z');
 const x=(date:string)=>first===last?160:28+(Date.parse(date+'T00:00:00Z')-first)/Math.max(1,last-first)*264;
 const y=(n:number)=>132-n/max*100;
 const label=metric==='reps'?'Most reps in a working set':metric==='estimate'?'Estimated 1RM · Epley':mode==='assisted'?'Recorded assistance (kg)':'Heaviest working set (kg)';
 return <div className="strength-chart"><div className="row wrap gap"><label className="field">Show<select value={metric} onChange={e=>setMetric(e.target.value as StrengthMetric)}><option value="reps">Reps</option><option value="load">{mode==='assisted'?'Assistance (kg)':mode==='bodyweight'?'Added load (kg)':'Load (kg)'}</option>{mode==='external'&&<option value="estimate">Estimated 1RM</option>}</select></label><div className="range-switch"><button aria-pressed={!all} onClick={()=>setAll(false)}>8 weeks</button><button aria-pressed={all} onClick={()=>setAll(true)}>All history</button></div></div>
 <p className="eyebrow">{label}</p>
 {!valid.length?<p className="empty">No comparable working sets in this range. Log a set or choose All history.</p>:<>
 <svg viewBox="0 0 320 164" role="img" aria-label={`${label}. ${points.map(p=>`${p.date}: ${p.value??'unknown'}`).join('; ')}`}><path d="M28 32V132H292" fill="none" stroke="currentColor" opacity=".3"/><text x="28" y="20">{max}</text><text x="10" y="136">0</text>
 {points.map((p,i)=>p.value===null?null:<g key={p.id}>{i>0&&points[i-1].value!==null&&<line x1={x(points[i-1].date)} y1={y(points[i-1].value!)} x2={x(p.date)} y2={y(p.value)} stroke="currentColor" strokeWidth="3"/>}<circle cx={x(p.date)} cy={y(p.value)} r="5" fill="currentColor"><title>{p.date}: {p.value}</title></circle></g>)}
 <text x="28" y="156">{dateLabel(points[0].date)}</text><text x="292" y="156" textAnchor="end">{dateLabel(points.at(-1)!.date)}</text></svg>
 {valid.length===1&&<p className="muted small">First point logged. Another session will show the trend.</p>}
 </>}
 <details><summary>Chart details</summary><p className="muted small">Warm-ups excluded. Each point is one session; missing values leave gaps. Reps can be recorded at different loads, so more reps alone does not prove strength increased. {mode==='assisted'?'Lower assistance may be harder; it is not a heavier lift.':mode==='bodyweight'?'Bodyweight is not included in added load. No barbell estimate is applied.':mode==='unknown'?'Equipment is unclassified; no estimated 1RM is shown.':'Estimated 1RM is calculated, not an achieved lift; estimates above 10 reps are low confidence.'}</p></details>
 </div>;
}
