import { Component, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Exercise } from '../db/types';
import type { Session } from '../lib/activityPulse';
import { choose, contextFor, JOKES, readCoach, saveCoach, observeCoach, rateCoach, type CoachVote, type Joke, type CoachState, type Tone } from '../lib/coach';
import './coach.css';
import { loadCoachNews } from '../lib/coachNews';
import { CoachArt } from './CoachArt';
class CoachBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false}; static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<p className="muted">Coach is unavailable. Your training tools are ready.</p>:this.props.children;}
}
export function CoachEQ(props:CoachProps) {return <CoachBoundary><CoachCard key={props.scope} {...props}/></CoachBoundary>;}
interface CoachProps {session?:Session;today:string;scope:string;history?:Session[];exercises?:Exercise[];share?:boolean}
function CoachCard({session,today,scope,history=[],exercises=[],share=false}:CoachProps) {
 const key=`eqfit.coach.v1:${scope}`;
 const [state,setState]=useState(()=>readCoach(key));
 const [news,setNews]=useState<Joke[]>();
 const [undo,setUndo]=useState<CoachState>();
 useEffect(()=>{const controller=new AbortController();const refresh=()=>{if(document.visibilityState==='visible')void loadCoachNews(controller.signal).then(setNews);};refresh();document.addEventListener('visibilitychange',refresh);return()=>{controller.abort();document.removeEventListener('visibilitychange',refresh);};},[]);
 const catalogue=[...JOKES,...(news??[])];
 const [preview,setPreview]=useState<Tone>('cheeky');
 const [settings,setSettings]=useState(false);
 const [notice,setNotice]=useState('');
 const [sledgeCount,setSledgeCount]=useState(0);
 const ctx=contextFor(session,today,history,exercises);
 const cardRef=useRef<HTMLElement>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{if(!cardRef.current || typeof IntersectionObserver==='undefined')return;const observer=new IntersectionObserver(entries=>setVisible((entries[0]?.intersectionRatio??0)>=0.5),{threshold:0.5});observer.observe(cardRef.current);return()=>observer.disconnect();},[]);
 const contextKey=JSON.stringify(ctx);
 const persist=(next:CoachState)=>setState(next);
 useEffect(()=>{if(news)setState(previous=>choose(previous,JSON.parse(contextKey),Date.now(),false,[...JOKES,...news]).state);},[contextKey,news]);
 useEffect(()=>{if(!saveCoach(key,state))setNotice('Coach settings cannot be saved here. Training storage is separate.');},[key,state]);
 const result=choose(state,ctx,Date.now(),false,catalogue);
 const joke=result.joke;
 useEffect(()=>{if(visible)setState(previous=>observeCoach(previous,JSON.parse(contextKey),joke?.id,today));},[visible,contextKey,joke?.id,today,state.consent]);
 const evidence=joke?.requiredFacts.filter(f=>ctx.facts?.[f]).map(f=>ctx.facts![f])??[];
 const mute=()=>{persist({...state,tone:'off',trial:state.consent?{...(state.trial??{days:[],shown:[],muted:0}),muted:(state.trial?.muted??0)+(state.tone==='off'?0:1)}:state.trial});setNotice('Coach muted until you change the tone.');};
 const enable=(tone:Tone)=>{if(tone==='off'){mute();setSettings(false);return;}persist(choose({...state,tone,current:undefined},ctx,Date.now(),true,catalogue).state);setSettings(false);};
 function vote(v:CoachVote){if(!joke)return;setUndo(state);persist(rateCoach(state,joke,v,today));setNotice(v==='not-funny'?'Retired. Less of that style.':'Noted. More of that style.');}
 const selectedVote=state.ratings?.find(r=>r.id===joke?.id)?.vote;

 const controls=<div className="coach-settings"><label>Tone <select value={preview} onChange={e=>setPreview(e.target.value as Tone)}><option value="off">Off</option><option value="friendly">Friendly</option><option value="cheeky">Cheeky (recommended)</option><option value="filthy">Filthy · explicit language</option></select></label><p className="coach-preview">{preview==='off'?'Quiet coach. All training tools remain available.':JOKES.find(j=>j.event==='visit'&&j.tone===preview)?.text}</p><button onClick={()=>enable(preview)}>{preview==='filthy'?'I’m 18+ · Enable Filthy':preview==='off'?'Keep humour off':'Use this tone'}</button></div>;
 return <aside ref={cardRef} className={`coach-card ${visible ? 'coach-visible' : ''}`} aria-label="Coach EQ">
 <div className="coach-heading"><div><p className="eyebrow">COACH EQ · {ctx.event==='visit'?'OFFICE HOURS':'SESSION BANTER'}</p><p className="muted">Training numbers. Optional nonsense.</p></div><button aria-label="Coach settings" aria-expanded={settings} onClick={()=>{setPreview(state.tone??'cheeky');setSettings(!settings);}}>⚙</button></div>
 {state.tone===null?<><div className="coach-line"><CoachArt/><div><h3>Meet the clipboard behind the attitude.</h3><p>Optional banter. Real training numbers. Preview your coach:</p></div></div>{controls}</>:state.tone==='off'?<p className="muted">Coach is quiet. Change tone whenever you like.</p>:<><div key={sledgeCount} className="coach-line coach-delivery"><CoachArt expression={joke?.expression??'deckchair'}/><div><p className="coach-joke" aria-live="polite" aria-atomic="true">{joke?.text??'Coach is taking a quiet moment. Your training tools are ready.'}</p>{joke?.source&&<a className="coach-source" href={joke.source.url} target="_blank" rel="noopener noreferrer">In the news · {joke.source.title}</a>}{joke&&<div className="coach-feedback" role="group" aria-label="Rate this sledge"><button aria-label="Funny — more like this" title="More like this" aria-pressed={selectedVote==='landed'} onClick={()=>vote('landed')}><span aria-hidden="true">👍</span></button><button aria-label="Not funny — less like this" title="Less like this" aria-pressed={selectedVote==='not-funny'} onClick={()=>vote('not-funny')}><span aria-hidden="true">👎</span></button></div>}{evidence.length>0&&<details className="coach-evidence"><summary>Based on your record</summary>{evidence.map(f=><p key={f}>{f}</p>)}</details>}</div></div><button className="coach-sledge" onClick={()=>{
 const next=choose(state,ctx,Date.now(),true,catalogue);
 if(next.joke){persist(next.state);setSledgeCount(n=>n+1);setNotice('');setUndo(undefined);}
 else setNotice('No more lines in this tone. Change tone for a fresh batch.');
}}>Sledge me again <span aria-hidden="true">↻</span></button>
 {state.topical!==false&&!!news?.length&&<button className="coach-news-button" onClick={()=>{
   const next=choose(state,ctx,Date.now(),true,news.filter(j=>j.id!==state.current?.id));
   if(next.joke){persist(next.state);setSledgeCount(n=>n+1);setNotice('');setUndo(undefined);}
   else setNotice('No more news sledges available in your tone. Try again after the next news refresh.');
 }}>News sledge · current headlines</button>}</>}
 {share && joke && state.tone !== null && state.tone !== 'off' && <button onClick={async () => {
   try {
     if (navigator.share) await navigator.share({ title: 'Coach EQ', text: `${joke.text}\n— Coach EQ` });
     else if (navigator.clipboard) { await navigator.clipboard.writeText(`${joke.text}\n— Coach EQ`); setNotice('Sledge copied. Choose where to share it.'); }
     else setNotice('Sharing is unavailable here.');
   } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) setNotice('Could not share. Your session is saved.'); }
 }}>Share the sledge</button>}
 {settings&&<><div className="coach-actions"><button onClick={mute}>Alright, shut up</button></div>{state.tone!==null&&controls}<p className="muted">Thumbs tune the styles and news topics you see on this device. Votes are not sent anywhere.</p><button onClick={()=>{persist({...state,ratings:[],dismissed:[]});setUndo(undefined);setNotice('Humour preferences reset.');}}>Reset humour preferences</button><label className="coach-consent"><input type="checkbox" checked={state.topical!==false} onChange={e=>persist({...state,topical:e.target.checked})}/> Mix in news: sport, culture, everyday life & politics</label><p className="muted">{news?.length?'Fresh sourced lines available.':'No fresh news batch available. Coach uses the usual lines.'}</p><label className="coach-consent"><input type="checkbox" checked={state.consent} onChange={e=>persist({...state,consent:e.target.checked,feedback:e.target.checked&&state.trial?state.feedback:[],trial:e.target.checked?(state.trial??{days:[],shown:[],muted:0}):undefined})}/> Count visible jokes, Coach-view days, votes and mutes on this device</label><p className="muted">No analytics are sent. First enabling these expanded counts starts a fresh trial; older vote-only consent does not enable them. Tone, repetition history and votes stay in this browser, separate for each local trial profile. They are not included in training backups. Turning collection off clears trial votes and counts; thumbs preferences remain until reset. No activity details are exported. Counts are capped at 300 visible joke cards; repeated views of the same joke for the same event on the same day count once. Coach-view days are not a measure of exercise adherence.</p>{state.consent&&<p>Visible joke cards: {state.trial?.shown.length??0} · Coach-view days (up to 14): {state.trial?.days.length??0} · Mutes: {state.trial?.muted??0} · That landed: {state.feedback.filter(f=>f.vote==='landed').length} · Not funny: {state.feedback.filter(f=>f.vote==='not-funny').length}</p>}</>}
 {notice&&<p role="status" className="muted">{notice} {undo&&<button onClick={()=>{persist({...state,ratings:undo.ratings,dismissed:undo.dismissed,feedback:state.consent?undo.feedback:state.feedback});setUndo(undefined);setNotice('Vote undone.');}}>Undo</button>}</p>}
 </aside>;
}
