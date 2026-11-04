import {useEffect,useRef,useState} from 'react';
import type {Repo} from '../db/repo';
import type {Exercise} from '../db/types';
import {exerciseKey,formatSet} from '../lib/training';
import {loadMode} from '../lib/strengthProgress';
import {MovementArt} from './MovementArt';
export interface QuickMovement {name:string;equipment:string;muscles:string[]}
export function NumberPicker({label,value,onChange,step,min,max,optional=false}:{label:string;value:string;onChange:(v:string)=>void;step:number;min:number;max:number;optional?:boolean}) {
 function change(by:number){const current=Number(value);onChange(String(Math.round(Math.min(max,Math.max(min,(Number.isFinite(current)?current:0)+by))*100)/100));}
 return <label className="number-picker"><span>{label}</span><span className="picker-control"><button type="button" aria-label={`Decrease ${label}`} onClick={()=>change(-step)}>−</button><input aria-label={label} type="number" inputMode={step===1?'numeric':'decimal'} min={min} max={max} step={step===1?1:'any'} required={!optional} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" aria-label={`Increase ${label}`} onClick={()=>change(step)}>+</button></span></label>;
}
export function QuickLift({repo,today,movement,exercises,onClose,onSaved,checkIn=false}:{repo:Repo;today:string;movement:QuickMovement;exercises:Exercise[];onClose:()=>void;onSaved:(workout:string,count:number)=>void;checkIn?:boolean}) {
 const exact=exercises.find(ex=>ex.exercise_key===exerciseKey(movement.name,movement.equipment));
 const [exerciseId,setExerciseId]=useState(exact?.id??''),[weight,setWeight]=useState(''),[reps,setReps]=useState('8'),[sets,setSets]=useState(checkIn?'1':'3'),[warmup,setWarmup]=useState(false),[previous,setPrevious]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false);
 const exercise=exercises.find(ex=>ex.id===exerciseId),mode=loadMode(exercise??movement);
 const weightLabel=mode==='bodyweight'?'Added weight (kg)':mode==='assisted'?'Assistance (kg)':'Weight (kg)';
 useEffect(()=>{const d=dialog.current!;d.showModal();return()=>d.close();},[]);
 useEffect(()=>{let live=true;setLoading(true);setError('');setWeight('');setReps('8');setSets(checkIn?'1':'3');setPrevious('');setWarmup(false);
  const read=async()=>{if(!exerciseId)return;const history=await repo.exerciseHistory(exerciseId);const last=history.filter(s=>s.workout.date<=today).at(-1);const work=last?.sets.filter(s=>!s.warmup)??[];if(live&&work.length){const set=work.at(-1)!;setWeight(set.load_kg?.toString()??'');setReps(set.reps?.toString()??'');setSets(checkIn?'1':String(Math.min(20,work.length)));setPrevious(`${last!.workout.date} · ${formatSet(set)}`);}};
  void read().catch(()=>{if(live)setError('Previous values unavailable. Enter your sets below.');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};
 },[repo,exerciseId,today,checkIn]);
 async function save(e:React.FormEvent){e.preventDefault();if(lock.current||loading)return;lock.current=true;setBusy(true);setError('');try{
  const count=Number(sets),load=weight.trim()===''?null:Number(weight),rep=Number(reps);
  if(load===null&&mode!=='bodyweight')throw new Error('Enter the weight or assistance used.');
  const {workout}=await repo.quickLogLift(today,movement,exerciseId||null,{load_kg:load,reps:rep,rir:null,warmup,pain_note:null},count,checkIn);
  onSaved(workout.id,count);
 }catch(e){setError(e instanceof Error?e.message:'Sets were not saved. Please retry.');}finally{lock.current=false;setBusy(false);}}
 return <dialog ref={dialog} className="quick-lift-dialog" aria-labelledby="quick-lift-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><div className="quick-lift-heading"><MovementArt name={movement.name}/><div><p className="eyebrow">{checkIn?'PROGRESS CHECK-IN':'QUICK LOG'}</p><h2 id="quick-lift-title">{exercise?.name??movement.name}</h2><small>{exercise?.equipment??movement.equipment}</small></div><button type="button" aria-label="Close quick log" disabled={busy} onClick={onClose}>×</button></div>
 <form onSubmit={e=>void save(e)}><fieldset disabled={busy||loading} className="quick-lift-fields"><legend className="muted small">{loading?'Loading previous values…':'Log sets you have completed.'}</legend>
 {previous&&<p className="muted small">Last time: {previous}</p>}
 <NumberPicker label={weightLabel} value={weight} onChange={setWeight} step={2.5} min={0} max={1000} optional={mode==='bodyweight'}/>
 {mode==='bodyweight'&&<p className="muted small">Leave added weight blank for bodyweight only.</p>}
 <div className="quick-reps-sets"><NumberPicker label="Reps" value={reps} onChange={setReps} step={1} min={1} max={1000}/>{!checkIn&&<NumberPicker label="Sets" value={sets} onChange={setSets} step={1} min={1} max={20}/>}</div>
 {!checkIn&&<label className="check"><input type="checkbox" checked={warmup} onChange={e=>setWarmup(e.target.checked)}/>Warm-up sets</label>}
 <details><summary>Exercise / equipment</summary><label className="field">Use exercise<select value={exerciseId} onChange={e=>setExerciseId(e.target.value)}><option value="">{movement.name} · {movement.equipment}</option>{exercises.map(ex=><option key={ex.id} value={ex.id}>{ex.name} · {ex.equipment||'unspecified'}</option>)}</select></label></details>
 <p className="quick-total">{sets||'—'} × {reps||'—'} <span>{weight!==''?`@ ${weight} kg`:mode==='bodyweight'?'bodyweight':''}</span></p>
 <button className="primary log-set" type="submit">{busy?'Saving…':`Save ${sets||'…'} ${warmup?'warm-up':'completed'} ${sets==='1'?'set':'sets'} ✓`}</button>
 </fieldset>{error&&<p className="error" role="alert">{error}</p>}</form></dialog>;
}
