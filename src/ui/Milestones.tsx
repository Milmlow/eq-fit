import {useEffect,useState} from 'react';
import type {Repo} from '../db/repo';
import {milestones,type Milestone} from '../lib/milestones';
import {IconLift,IconRun} from './Icons';
export function Milestones({repo,today,version}:{repo:Repo;today:string;version:number}) {
 const [items,setItems]=useState<Milestone[]>([]),[seen,setSeen]=useState<string[]>(()=>{try{const x=JSON.parse(localStorage.getItem('eqfit.milestones:'+repo.db.name)||'[]');return Array.isArray(x)?x.filter(v=>typeof v==='string'):[];}catch{return [];}});
 useEffect(()=>{let live=true;void Promise.all([repo.allSetsWithContext(),repo.activitiesBetween('2000-01-01',today)]).then(([sets,acts])=>{if(live)setItems(milestones(sets,acts,today));}).catch(()=>{if(live)setItems([]);});return()=>{live=false;};},[repo,today,version]);
 const fresh=items.filter(i=>!seen.includes(i.id)).slice(0,3);
 if(!fresh.length)return null;
 function dismiss(id:string){const next=[...seen,id];setSeen(next);try{localStorage.setItem('eqfit.milestones:'+repo.db.name,JSON.stringify(next));}catch{/* Dismissal still works in this session. */}}
 return <section className="milestones" aria-label="Recent achievements"><p className="eyebrow">BUILT BY YOU · BEST IN SAVED HISTORY</p>{fresh.map(m=><div className="milestone" key={m.id}>{m.kind==='lift'?<IconLift/>:<IconRun/>}<div><strong>{m.title}</strong><p>{m.value}</p><small>{m.date}</small></div><button aria-label={`Dismiss ${m.title}`} onClick={()=>dismiss(m.id)}>✓</button></div>)}</section>;
}
