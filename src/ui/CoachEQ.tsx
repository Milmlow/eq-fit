import { Component, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '../lib/activityPulse';
import { choose, contextFor, JOKES, readCoach, saveCoach, type CoachState, type Expression, type Tone } from '../lib/coach';
import './coach.css';
export function CoachArt({expression='clipboard'}:{expression?:Expression}) {
 const proud=expression==='proud';
 return <svg className="coach-art" viewBox="0 0 160 160" role="img" aria-label={`Coach EQ: ${expression}`}><circle cx="80" cy="80" r="75" fill="var(--paper)"/><g stroke="var(--fg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M29 150 Q30 95 80 97 Q130 95 136 150" fill={expression==='robe'?'var(--blue)':'var(--accent)'}/><path d="M65 101 L80 127 L94 101" fill="none"/><path d="M78 125h12v9H78z" fill="var(--paper)"/><path d="M48 50 Q44 14 81 15 Q118 15 113 50 L109 76 Q99 98 81 98 Q61 96 51 77Z" fill="var(--card)"/><path d="M48 43 Q44 14 81 15 Q114 13 115 43 L85 32Z" fill="var(--fg)"/><path d={proud?'M58 52l13 -2 M89 50l14 2':'M58 50l14 5 M88 47l16 -4'} fill="none"/><circle cx="66" cy="61" r="2" fill="var(--fg)"/><circle cx="97" cy="61" r="2" fill="var(--fg)"/><path d={proud?'M69 80q13 12 26 -1':'M70 82l25 -3'} fill="none"/><path d="M81 62l-3 10h7" fill="none"/>{expression==='deckchair'?<path d="M109 109l26 38m-34 -10h40m-32 -28h25l-9 28m-24 0l-7 12" fill="none"/>:<><rect x="103" y="99" width="39" height="51" rx="3" fill="var(--paper)"/><path d="M114 96h17v8h-17z M111 117h22 M111 127h17 M111 137h12" fill="none"/>{expression==='trophy'&&<path d="M115 116h14v9q-7 8 -14 0z M122 130v9m-6 0h12" fill="var(--warn)"/>}{expression==='permit'&&<path d="M106 109l33 35m0 -35l-33 35" stroke="var(--accent)"/>}</>}</g></svg>;
}
class CoachBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false}; static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p className="muted">Coach is unavailable. Your training tools are ready.</p>:this.props.children;}
}
export function CoachEQ(props:{session?:Session;today:string;scope:string}) {return <CoachBoundary><CoachCard key={props.scope} {...props}/></CoachBoundary>;}
function CoachCard({session,today,scope}:{session?:Session;today:string;scope:string}) {
 const key=`eqfit.coach.v1:${scope}`;
 const [state,setState]=useState(()=>readCoach(key));
 const [preview,setPreview]=useState<Tone>('cheeky');
 const [settings,setSettings]=useState(false);
 const [notice,setNotice]=useState('');
 const ctx=contextFor(session,today);
 const contextKey=JSON.stringify(ctx);
 const persist=(next:CoachState)=>{setState(next);if(!saveCoach(key,next))setNotice('Coach settings cannot be saved here. They last only while this card stays open. Training storage is separate.');};
 useEffect(()=>{
  setState(previous=>{const result=choose(previous,JSON.parse(contextKey),Date.now());if(!saveCoach(key,result.state))setNotice('Coach settings could not be saved. Training storage is separate.');return result.state;});
 },[contextKey,key]);
 const result=choose(state,ctx,Date.now());
 const joke=result.joke;
 const enable=(tone:Tone)=>{persist(choose({...state,tone,current:undefined},ctx,Date.now(),true).state);setSettings(false);};
 function vote(v:string){if(!joke)return;const next={...state,dismissed:v==='not-funny'?[...new Set([...state.dismissed,joke.id])]:state.dismissed,feedback:state.consent?[...state.feedback.filter(f=>!(f.id===joke.id&&f.day===today)),{id:joke.id,vote:v,day:today}].slice(-300):state.feedback};persist(next);setNotice(v==='not-funny'?'Retired from your rotation.':'Noted. Coach will try not to let it go to his head.');}
 const controls=<div className="coach-settings"><label>Tone <select value={preview} onChange={e=>setPreview(e.target.value as Tone)}><option value="off">Off</option><option value="friendly">Friendly</option><option value="cheeky">Cheeky (recommended)</option><option value="filthy">Filthy · explicit language</option></select></label><p className="coach-preview">{preview==='off'?'Quiet coach. All training tools remain available.':JOKES.find(j=>j.event==='visit'&&j.tone===preview)?.text}</p><button onClick={()=>enable(preview)}>{preview==='filthy'?'I’m 18+ · Enable Filthy':preview==='off'?'Keep humour off':'Use this tone'}</button></div>;
 return <aside className="coach-card" aria-label="Coach EQ">
 <div className="coach-heading"><div><p className="eyebrow">COACH EQ · {ctx.event==='visit'?'OFFICE HOURS':'SESSION BANTER'}</p><p className="muted">Training numbers. Optional nonsense.</p></div><button aria-expanded={settings} onClick={()=>{setPreview(state.tone??'cheeky');setSettings(!settings);}}>Tone / privacy</button></div>
 {state.tone===null?<><div className="coach-line"><CoachArt/><div><h3>Meet the clipboard behind the attitude.</h3><p>Optional banter. Real training numbers. Preview your coach:</p></div></div>{controls}</>:state.tone==='off'?<p className="muted">Coach is quiet. Change tone whenever you like.</p>:<><div className="coach-line"><CoachArt expression={joke?.expression??'deckchair'}/><div><p className="coach-joke">{joke?.text??'Coach is taking a quiet moment. Your training tools are ready.'}</p><small className="muted">Coach banter · not a performance verdict</small></div></div><div className="coach-actions"><button onClick={()=>{persist(choose(state,ctx,Date.now(),true).state);setNotice('');}}>Another one</button>{joke&&<><button onClick={()=>vote('landed')}>That landed</button><button onClick={()=>vote('not-funny')}>Not funny</button></>}<button onClick={()=>{persist({...state,tone:'off'});setNotice('Coach muted until you change the tone.');}}>Alright, shut up</button></div></>}
 {settings&&<>{state.tone!==null&&controls}<label className="coach-consent"><input type="checkbox" checked={state.consent} onChange={e=>persist({...state,consent:e.target.checked,feedback:e.target.checked?state.feedback:[]})}/> Keep my joke votes on this device for the adult trial</label><p className="muted">No analytics are sent. Tone, repetition history and votes stay in this browser, separate for each local trial profile. They are not included in training backups. Turning vote collection off clears saved votes.</p>{state.consent&&<p>That landed: {state.feedback.filter(f=>f.vote==='landed').length} · Not funny: {state.feedback.filter(f=>f.vote==='not-funny').length}</p>}</>}
 {notice&&<p role="status" className="muted">{notice}</p>}
 </aside>;
}
