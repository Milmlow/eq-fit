import { Component, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Exercise } from '../db/types';
import type { Session } from '../lib/activityPulse';
import { choose, contextFor, JOKES, readCoach, saveCoach, observeCoach, type CoachState, type Tone } from '../lib/coach';
import './coach.css';
import { CoachArt } from './CoachArt';
class CoachBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false}; static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p className="muted">Coach is unavailable. Your training tools are ready.</p>:this.props.children;}
}
export function CoachEQ(props:CoachProps) {return <CoachBoundary><CoachCard key={props.scope} {...props}/></CoachBoundary>;}
interface CoachProps {session?:Session;today:string;scope:string;history?:Session[];exercises?:Exercise[]}
function CoachCard({session,today,scope,history=[],exercises=[]}:CoachProps) {
 const key=`eqfit.coach.v1:${scope}`;
 const [state,setState]=useState(()=>readCoach(key));
 const [preview,setPreview]=useState<Tone>('cheeky');
 const [settings,setSettings]=useState(false);
 const [notice,setNotice]=useState('');
 const ctx=contextFor(session,today,history,exercises);
 const cardRef=useRef<HTMLElement>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{if(!cardRef.current || typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>setVisible((entries[0]?.intersectionRatio??0)>=0.5),{threshold:0.5});observer.observe(cardRef.current);return()=>observer.disconnect();},[]);
 const contextKey=JSON.stringify(ctx);
 const persist=(next:CoachState)=>setState(next);
 useEffect(()=>{setState(previous=>choose(previous,JSON.parse(contextKey),Date.now()).state);},[contextKey]);
 useEffect(()=>{if(!saveCoach(key,state))setNotice('Coach settings cannot be saved here. Training storage is separate.');},[key,state]);
 const result=choose(state,ctx,Date.now());
 const joke=result.joke;
 useEffect(()=>{if(visible)setState(previous=>observeCoach(previous,JSON.parse(contextKey),joke?.id,today));},[visible,contextKey,joke?.id,today,state.consent]);
 const evidence=joke?.requiredFacts.filter(f=>ctx.facts?.[f]).map(f=>ctx.facts![f])??[];
 const mute=()=>{persist({...state,tone:'off',trial:state.consent?{...(state.trial??{days:[],shown:[],muted:0}),muted:(state.trial?.muted??0)+(state.tone==='off'?0:1)}:state.trial});setNotice('Coach muted until you change the tone.');};
 const enable=(tone:Tone)=>{if(tone==='off'){mute();setSettings(false);return;}persist(choose({...state,tone,current:undefined},ctx,Date.now(),true).state);setSettings(false);};
 function vote(v:string){if(!joke)return;const next={...state,dismissed:v==='not-funny'?[...new Set([...state.dismissed,joke.id])]:state.dismissed,feedback:state.consent?[...state.feedback.filter(f=>!(f.id===joke.id&&f.day===today)),{id:joke.id,vote:v,day:today}].slice(-300):state.feedback};persist(next);setNotice(v==='not-funny'?'Retired from your rotation.':'Noted. Coach will try not to let it go to his head.');}
 const controls=<div className="coach-settings"><label>Tone <select value={preview} onChange={e=>setPreview(e.target.value as Tone)}><option value="off">Off</option><option value="friendly">Friendly</option><option value="cheeky">Cheeky (recommended)</option><option value="filthy">Filthy · explicit language</option></select></label><p className="coach-preview">{preview==='off'?'Quiet coach. All training tools remain available.':JOKES.find(j=>j.event==='visit'&&j.tone===preview)?.text}</p><button onClick={()=>enable(preview)}>{preview==='filthy'?'I’m 18+ · Enable Filthy':preview==='off'?'Keep humour off':'Use this tone'}</button></div>;
 return <aside ref={cardRef} className="coach-card" aria-label="Coach EQ">
 <div className="coach-heading"><div><p className="eyebrow">COACH EQ · {ctx.event==='visit'?'OFFICE HOURS':'SESSION BANTER'}</p><p className="muted">Training numbers. Optional nonsense.</p></div><button aria-expanded={settings} onClick={()=>{setPreview(state.tone??'cheeky');setSettings(!settings);}}>Tone / privacy</button></div>
 {state.tone===null?<><div className="coach-line"><CoachArt/><div><h3>Meet the clipboard behind the attitude.</h3><p>Optional banter. Real training numbers. Preview your coach:</p></div></div>{controls}</>:state.tone==='off'?<p className="muted">Coach is quiet. Change tone whenever you like.</p>:<><div className="coach-line"><CoachArt expression={joke?.expression??'deckchair'}/><div><p className="coach-joke">{joke?.text??'Coach is taking a quiet moment. Your training tools are ready.'}</p><small className="muted">Coach banter</small>{evidence.length>0&&<details className="coach-evidence"><summary>Based on your record</summary>{evidence.map(f=><p key={f}>{f}</p>)}</details>}</div></div><details className="coach-tools"><summary>Banter controls</summary><div className="coach-actions"><button onClick={()=>{persist(choose(state,ctx,Date.now(),true).state);setNotice('');}}>Another one</button>{joke&&<><button onClick={()=>vote('landed')}>That landed</button><button onClick={()=>vote('not-funny')}>Not funny</button></>}<button onClick={mute}>Alright, shut up</button></div></details></>}
 {settings&&<>{state.tone!==null&&controls}<label className="coach-consent"><input type="checkbox" checked={state.consent} onChange={e=>persist({...state,consent:e.target.checked,feedback:e.target.checked&&state.trial?state.feedback:[],trial:e.target.checked?(state.trial??{days:[],shown:[],muted:0}):undefined})}/> Count visible jokes, Coach-view days, votes and mutes on this device</label><p className="muted">No analytics are sent. First enabling these expanded counts starts a fresh trial; older vote-only consent does not enable them. Tone, repetition history and votes stay in this browser, separate for each local trial profile. They are not included in training backups. Turning collection off clears votes and trial counts. No activity details are exported. Counts are capped at 300 visible joke cards; repeated views of the same joke for the same event on the same day count once. Coach-view days are not a measure of exercise adherence.</p>{state.consent&&<p>Visible joke cards: {state.trial?.shown.length??0} · Coach-view days (up to 14): {state.trial?.days.length??0} · Mutes: {state.trial?.muted??0} · That landed: {state.feedback.filter(f=>f.vote==='landed').length} · Not funny: {state.feedback.filter(f=>f.vote==='not-funny').length}</p>}</>}
 {notice&&<p role="status" className="muted">{notice}</p>}
 </aside>;
}
