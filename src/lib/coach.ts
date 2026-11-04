import type { Session } from './activityPulse';
import type { Exercise } from '../db/types';
import { coachFacts } from './coachFacts';
export type Tone = 'off' | 'friendly' | 'cheeky' | 'filthy';
export type Event = 'visit' | 'run' | 'weights';
export type Expression = 'clipboard' | 'eyebrow' | 'proud' | 'permit' | 'robe' | 'deckchair' | 'trophy';
export interface Joke { topic?: 'sport' | 'culture' | 'everyday'; source?: {title:string;url:string;publishedAt:string}; expiresAt?: string; id: string; text: string; tone: Exclude<Tone,'off'>; event: Event; requiredFacts: string[]; exclusions: string[]; expression: Expression; cooldownDays: number; fallback: string }
// Each tuple is editorial content; metadata is explicit in the compiled catalogue.
const lines: [string, Event, Exclude<Tone,'off'>, Expression, string][] = [
 ['eq-001','visit','friendly','clipboard','Welcome in. The clipboard has no opinions. I have several.'],
 ['eq-002','visit','friendly','deckchair','Rest belongs in the plan. My deckchair has a coaching qualification.'],
 ['eq-003','visit','friendly','eyebrow','No motivational speech today. The whistle is charging.'],
 ['eq-004','visit','friendly','robe','Coach wardrobe update: dressing gown. Still technically a uniform.'],
 ['eq-005','visit','friendly','clipboard','The imaginary excuses department has requested a bigger filing cabinet.'],
 ['eq-006','visit','friendly','proud','Your training, your pace. I can work with that.'],
 ['eq-007','visit','friendly','permit','Schooner approval department: fictional office, very real paperwork.'],
 ['eq-008','visit','friendly','eyebrow','A training diary with eyebrows. Technology has peaked.'],
 ['eq-009','visit','cheeky','clipboard','I bought a clipboard and immediately became difficult to work with.'],
 ['eq-010','visit','cheeky','permit','Schooner permits now require three signatures. All mine. All different.'],
 ['eq-011','visit','cheeky','robe','This dressing gown is performance fabric if you lower your standards.'],
 ['eq-012','visit','cheeky','deckchair','My recovery seminar is just a deckchair facing away from people.'],
 ['eq-013','visit','cheeky','eyebrow','New gear review: still unable to do the session on your behalf.'],
 ['eq-014','visit','cheeky','clipboard','The excuses department is imaginary. Its consultancy fees are outrageous.'],
 ['eq-015','visit','cheeky','eyebrow','A smartwatch and a clipboard walk into a pub. The clipboard requests minutes.'],
 ['eq-016','visit','cheeky','proud','I was going to give a speech. Then I remembered you have buttons to press.'],
 ['eq-017','visit','filthy','clipboard','This is a training diary with a whistle. Somehow I am still under-fucking-qualified.'],
 ['eq-018','visit','filthy','permit','The imaginary schooner department has gone paperless. Same bullshit, new portal.'],
 ['eq-019','visit','filthy','robe','Dressing gown. Whistle. Clipboard. An absolute HR fucking nightmare.'],
 ['eq-020','visit','filthy','deckchair','Recovery department update: the deckchair gives fewer fucks than I do.'],
 ['run-shoe-office','run','friendly','eyebrow','Run recorded. Running shoes have more performance reviews than most employees.'],
 ['eq-022','run','friendly','proud','Run saved. A real entry in your own story. Nice work.'],
 ['eq-023','run','friendly','permit','Run recorded. No imaginary permits were issued in the making of this activity.'],
 ['eq-024','run','friendly','eyebrow','Run saved. Your shoes can now return to being hallway furniture.'],
 ['eq-025','run','cheeky','permit','Run recorded. The imaginary schooner licensing department remains unmoved.'],
 ['eq-026','run','cheeky','clipboard','Run saved. Please allow six imaginary business days for my enthusiastic response.'],
 ['eq-027','run','cheeky','eyebrow','Run logged. The documentary rights remain surprisingly affordable.'],
 ['eq-028','run','cheeky','proud','Run saved. I have filed a small, inconvenient amount of pride.'],
 ['run-route-director','run','cheeky','eyebrow','Run logged. A watch beeping at a wrist has somehow become a management structure.'],
 ['eq-030','run','filthy','permit','Run saved. The imaginary schooner department says: lovely paperwork, still no fucking permit.'],
 ['eq-031','run','filthy','eyebrow','Run logged. No need for a press conference. The fucking numbers are right there.'],
 ['eq-032','run','filthy','proud','Run saved. Good effort getting it recorded. There, a compliment. Weird as fuck.'],
 ['eq-033','weights','friendly','clipboard','Weights logged. The clipboard has discovered resistance training. Mostly resistance to paperwork.'],
 ['eq-034','weights','friendly','proud','Session saved. No joke this time. Good to see you putting the work in.'],
 ['lift-collar-career','weights','friendly','eyebrow','Lifting saved. Barbell collars have one job and somehow look permanently overworked.'],
 ['eq-036','weights','friendly','permit','Lifting saved. The imaginary certificate is in the imaginary post.'],
 ['eq-037','weights','cheeky','eyebrow','Weights logged. The mirror has submitted an invoice for supervision.'],
 ['eq-038','weights','cheeky','clipboard','Lifting recorded. The tiny plates have requested representation on the board.'],
 ['eq-039','weights','cheeky','proud','Session saved. My enthusiasm is internal. Deeply internal.'],
 ['eq-040','weights','cheeky','clipboard','Weights logged. Somewhere, a shaker bottle is preparing its acceptance speech.'],
 ['eq-041','weights','cheeky','permit','Session recorded. The imaginary employee-of-the-week committee is just me in a different hat.'],
 ['eq-042','weights','filthy','eyebrow','Weights saved. The mirror inspection is not a fourth fucking set.'],
 ['eq-043','weights','filthy','clipboard','Lifting logged. The tiny plates do not give a shit about your branding strategy.'],
 ['eq-044','weights','filthy','proud','Session recorded. I would clap, but I am holding this fucking clipboard.'],
 ['visit-smart-socks','visit','friendly','eyebrow','Waiting for smart socks. Finally, a device that can tell me one is missing.'],
 ['eq-046','visit','friendly','eyebrow','My whistle has a silent mode. We are all grateful.'],
 ['eq-047','visit','friendly','trophy','The imaginary trophy budget has been spent on a very small shelf.'],
 ['eq-048','visit','friendly','deckchair','Coach tip: a deckchair does not need a personal best.'],
 ['eq-049','visit','friendly','robe','The dressing gown has pockets for two pens and absolutely no authority.'],
 ['eq-050','visit','friendly','proud','You can keep the numbers and switch me off. Healthy boundaries, inconvenient for my career.'],
 ['eq-051','run','friendly','eyebrow','Run logged. GPS gets satellites. I get a pen on a string.'],
 ['eq-052','run','friendly','clipboard','Run saved. My job is to stand here looking like I organised it.'],
 ['eq-053','run','friendly','permit','Run logged. The souvenir shop is just me selling the same whistle.'],
 ['eq-054','run','friendly','eyebrow','Run saved. Running shoe names sound like classified aircraft now.'],
 ['eq-055','run','friendly','clipboard','Run recorded. I have reviewed the numbers and underlined something for authority.'],
 ['eq-056','run','friendly','proud','Run logged. Yours to be pleased with. No speech required.'],
 ['eq-057','run','friendly','robe','Run saved. My coaching outfit has a belt. Unfortunately, it is a dressing gown.'],
 ['run-watch-review','run','friendly','eyebrow','Run recorded. GPS watches: tiny computers with very strong opinions about circles.'],
 ['eq-059','run','friendly','clipboard','Run saved. The sports desk is a folding table. Budget cuts.'],
 ['eq-060','run','friendly','permit','Run logged. Your imaginary appearance fee is one approving nod.'],
 ['eq-061','weights','friendly','eyebrow','Weights logged. Gym equipment names sound like jobs on a building site.'],
 ['eq-062','weights','friendly','clipboard','Session saved. I supervise gravity. It rarely takes feedback.'],
 ['eq-063','weights','friendly','permit','Lifting logged. My imaginary gym has a dress code: no lanyards near the equipment.'],
 ['eq-064','weights','friendly','eyebrow','Weights saved. A plate tree is a disappointing thing to give a gardener.'],
 ['eq-065','weights','friendly','clipboard','Session recorded. The dumbbells have declined my invitation to a planning meeting.'],
 ['eq-066','weights','friendly','proud','Lifting saved. This is your record of the work. Keep it for yourself.'],
 ['eq-067','weights','friendly','robe','Weights logged. The dressing gown is for coaching, not spotting. HR was very clear.'],
 ['eq-068','weights','friendly','eyebrow','Session saved. Gym mirrors are the only colleagues who attend every meeting.'],
 ['eq-069','weights','friendly','clipboard','Lifting recorded. My clipboard weighs almost nothing. I have checked repeatedly.'],
 ['eq-070','weights','friendly','permit','Weights saved. The imaginary awards dinner is BYO chair. And dinner.'],
];
export const JOKES: Joke[] = lines.map(([id,event,tone,expression,text])=>({id,text,tone,event,requiredFacts:event==='visit'?[]:[`completed:${event}`],exclusions:['tone_above_recipient_limit','cooldown','dismissed'],expression,cooldownDays:14,fallback:'Coach is taking a quiet moment. Your training tools are ready.'}));
const contextual: [string, Event, Exclude<Tone,'off'>, Expression, string, string][] = [
 ['early-run-robe','run','friendly','robe','I have had to put a whistle on my dressing gown.','early'],
 ['early-run-breakfast','run','cheeky','robe','Try getting through breakfast without mentioning the start time. I dare you.','early'],
 ['early-run-union','run','filthy','robe','Even my imaginary coaching union says this is too fucking early.','early'],
 ['early-lift-robe','weights','friendly','robe','The dressing gown is on. The whistle is upside down. I am doing my best.','early'],
 ['early-lift-breakfast','weights','cheeky','robe','A session before six. Breakfast is about to become a press conference.','early'],
 ['rep-trophy-postage','weights','friendly','trophy','More reps at the same weight. I ordered a trophy. It is mostly postage.','more-reps'],
 ['rep-trophy-zoom','weights','cheeky','trophy','More reps. Same weight. Your trophy is pictured here at 400% magnification.','more-reps'],
 ['rep-trophy-budget','weights','filthy','trophy','More reps, same weight. Proper progress. Tiny fucking trophy. Budget is budget.','more-reps'],
 ['steady-run-respect','run','friendly','proud','Three weeks of recorded training. No punchline. That deserves some respect.','steady'],
 ['steady-lift-respect','weights','friendly','proud','Three weeks of recorded training. No punchline. That deserves some respect.','steady'],
];
JOKES.push(...contextual.map(([id,event,tone,expression,text,fact]):Joke=>({id,event,tone,expression,text,requiredFacts:[`completed:${event}`,fact],exclusions:['tone_above_recipient_limit','cooldown','dismissed'],cooldownDays:14,fallback:'Your session is saved.'})));
export interface Context { event: Event; aliases: string[]; key: string; facts?: Record<string,string> }
export function contextFor(session: Session | undefined, today: string, history: Session[] = [], exercises: Exercise[] = []): Context {
 // Old imports are history, not new achievements. No timestamps inferred from workout creation.
 if (!session || session.date!==today) return {event:'visit',aliases:[],key:`visit:${today}`};
 const aliases=[...(session.activity?[`activity:${session.activity.id}`]:[]),...(session.workout?[`workout:${session.workout.id}`]:[])];
 return {event:session.kind,aliases,key:aliases[0]??`session:${session.id}`,facts:coachFacts(session,history,exercises)};
}
export type CoachVote = 'landed' | 'not-funny';
export interface CoachRating { id:string; vote:CoachVote; bucket:string }
export interface CoachState { ratings?:CoachRating[]; topical?:boolean; tone: Tone | null; seen: string[]; recent: {id:string;at:number}[]; dismissed:string[]; current?: {key:string;id:string}; consent:boolean; trial?: {days:string[]; shown:{key:string;id:string;day:string}[]; muted:number}; feedback:{id:string;vote:string;day:string}[] }
export const freshCoach = ():CoachState=>({tone:null,seen:[],recent:[],dismissed:[],consent:false,feedback:[]});
const ranks = {off:0,friendly:1,cheeky:2,filthy:3};
export function eligible(j:Joke,ctx:Context,tone:Tone):boolean { return tone!=='off' && ranks[j.tone]<=ranks[tone] && (j.event===ctx.event || (Boolean(j.source) && j.event==='visit')) && j.requiredFacts.every(f=>f===`completed:${ctx.event}` || Boolean(ctx.facts?.[f])); }
export function choose(state:CoachState,ctx:Context,now:number,another=false,catalogue:readonly Joke[]=JOKES):{state:CoachState;joke?:Joke} {
 if (!state.tone || state.tone==='off') return {state};
 const pool=catalogue.filter(j=>!j.expiresAt || (state.topical!==false && Date.parse(j.expiresAt)>now));
 const preference=(j:Joke)=>{const votes=(state.ratings??[]).filter(r=>r.bucket===humourBucket(j));return votes.reduce((n,r)=>n+(r.vote==='landed'?1:-1),0)/(votes.length+2)+(j.source ? 0.2 : 0);};
 const cached=pool.find(j=>j.id===state.current?.id && state.current.key===ctx.key && !state.dismissed.includes(j.id) && eligible(j,ctx,state.tone!));
 if(!another && cached) return {state:{...state,seen:[...new Set([...state.seen,...ctx.aliases])]},joke:cached};
 const seen=ctx.aliases.some(id=>state.seen.includes(id)) || state.seen.includes(ctx.key);
 if(!another && seen) return {state:{...state,current:undefined,seen:[...new Set([...state.seen,...ctx.aliases])]}};
 const rotation=pool.filter(j=>!(j.source && pool.find(x=>x.id===state.current?.id)?.source));
 let candidates=rotation.filter(j=>eligible(j,ctx,state.tone!)&&!state.dismissed.includes(j.id)&&!state.recent.some(r=>r.id===j.id&&now-r.at<j.cooldownDays*86400000));
 // Prefer the chosen intensity; cycle through lower intensities when its pool is exhausted.
 candidates.sort((a,b)=>b.requiredFacts.length-a.requiredFacts.length||ranks[b.tone]-ranks[a.tone]||preference(b)-preference(a)||a.id.localeCompare(b.id));
 // Explicit requests may recycle the least recently used line after the fresh pool.
 // Automatic visits still honour cooldown. Never revive a dismissed line.
 if(another){
  candidates=candidates.filter(j=>j.id!==state.current?.id);
  if(!candidates.length){
   const lastSeen=(id:string)=>Math.max(0,...state.recent.filter(r=>r.id===id).map(r=>r.at));
   candidates=rotation.filter(j=>eligible(j,ctx,state.tone!)&&!state.dismissed.includes(j.id)&&j.id!==state.current?.id)
    .sort((a,b)=>lastSeen(a.id)-lastSeen(b.id)||a.id.localeCompare(b.id));
  }
 }
 const joke=candidates[0];
 return {joke,state:{...state,seen:[...new Set([...state.seen,ctx.key,...ctx.aliases])],current:joke?{key:ctx.key,id:joke.id}:undefined,recent:joke?[...state.recent.filter(r=>r.id!==joke.id&&now-r.at<14*86400000),{id:joke.id,at:now}]:state.recent}};
}
export function readCoach(key:string):CoachState {
 try { const raw=localStorage.getItem(key); if(!raw)return freshCoach(); const s=JSON.parse(raw) as CoachState;
 if(![null,'off','friendly','cheeky','filthy'].includes(s.tone)||!Array.isArray(s.seen)||!s.seen.every(x=>typeof x==='string')||!Array.isArray(s.recent)||!s.recent.every(x=>typeof x.id==='string'&&Number.isFinite(x.at))||!Array.isArray(s.dismissed)||!Array.isArray(s.feedback)||typeof s.consent!=='boolean')return freshCoach();
 if(s.trial && (!Array.isArray(s.trial.days)||!s.trial.days.every(x=>typeof x==='string')||!Array.isArray(s.trial.shown)||!s.trial.shown.every(x=>typeof x.key==='string'&&typeof x.id==='string'&&typeof x.day==='string')||!Number.isFinite(s.trial.muted)))s.trial=undefined;
 if(!s.trial)s.consent=false;
 s.ratings=Array.isArray(s.ratings)?s.ratings.filter(r=>r&&typeof r.id==='string'&&typeof r.bucket==='string'&&r.bucket.length<60&&['landed','not-funny'].includes(r.vote)).slice(-300):[];
 s.topical=s.topical!==false;
 return s;
 }catch{return freshCoach();}
}
export function saveCoach(key:string,state:CoachState):boolean {try{localStorage.setItem(key,JSON.stringify(state));return true;}catch{return false;}}

/** On-device trial only. Same card on the same day counts once, including rerenders/reopening. */
export function observeCoach(s:CoachState,ctx:Context,id:string|undefined,day:string):CoachState {
 if(!s.consent)return s;
 const t=s.trial??{days:[],shown:[],muted:0};
 const shown=id&&!t.shown.some(x=>x.key===ctx.key&&x.id===id&&x.day===day);
 if(t.days.includes(day)&&!shown)return s;
 return {...s,trial:{...t,days:[...new Set([...t.days,day])].slice(-14),shown:shown?[...t.shown,{key:ctx.key,id:id!,day}].slice(-300):t.shown}};
}

/** Explicit tastes are preferences, separate from opt-in trial measurements. */
export function humourBucket(j:Joke):string {return j.topic?`news:${j.topic}`:`style:${j.expression}`;}
export function rateCoach(s:CoachState,j:Joke,vote:CoachVote,day:string):CoachState {
 const ratings=[...(s.ratings??[]).filter(r=>r.id!==j.id),{id:j.id,vote,bucket:humourBucket(j)}].slice(-300);
 return {...s,ratings,dismissed:vote==='not-funny'?[...new Set([...s.dismissed,j.id])]:s.dismissed.filter(id=>id!==j.id),
 feedback:s.consent?[...s.feedback.filter(f=>!(f.id===j.id&&f.day===day)),{id:j.id,vote,day}].slice(-300):s.feedback};
}
