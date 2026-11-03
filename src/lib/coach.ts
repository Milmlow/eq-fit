import type { Session } from './activityPulse';
export type Tone = 'off' | 'friendly' | 'cheeky' | 'filthy';
export type Event = 'visit' | 'run' | 'weights';
export type Expression = 'clipboard' | 'eyebrow' | 'proud' | 'permit' | 'robe' | 'deckchair' | 'trophy';
export interface Joke { id: string; text: string; tone: Exclude<Tone,'off'>; event: Event; requiredFacts: string[]; exclusions: string[]; expression: Expression; cooldownDays: number; fallback: string }
// Each tuple is editorial content; metadata is explicit in the compiled catalogue.
const lines: [Event, Exclude<Tone,'off'>, Expression, string][] = [
 ['visit','friendly','clipboard','Welcome in. The clipboard has no opinions. I have several.'],
 ['visit','friendly','deckchair','Rest belongs in the plan. My deckchair has a coaching qualification.'],
 ['visit','friendly','eyebrow','No motivational speech today. The whistle is charging.'],
 ['visit','friendly','robe','Coach wardrobe update: dressing gown. Still technically a uniform.'],
 ['visit','friendly','clipboard','The imaginary excuses department has requested a bigger filing cabinet.'],
 ['visit','friendly','proud','Your training, your pace. I can work with that.'],
 ['visit','friendly','permit','Schooner approval department: fictional office, very real paperwork.'],
 ['visit','friendly','eyebrow','A training diary with eyebrows. Technology has peaked.'],
 ['visit','cheeky','clipboard','I bought a clipboard and immediately became difficult to work with.'],
 ['visit','cheeky','permit','Schooner permits now require three signatures. All mine. All different.'],
 ['visit','cheeky','robe','This dressing gown is performance fabric if you lower your standards.'],
 ['visit','cheeky','deckchair','My recovery seminar is just a deckchair facing away from people.'],
 ['visit','cheeky','eyebrow','New gear review: still unable to do the session on your behalf.'],
 ['visit','cheeky','clipboard','The excuses department is imaginary. Its consultancy fees are outrageous.'],
 ['visit','cheeky','eyebrow','A smartwatch and a clipboard walk into a pub. The clipboard requests minutes.'],
 ['visit','cheeky','proud','I was going to give a speech. Then I remembered you have buttons to press.'],
 ['visit','filthy','clipboard','This is a training diary with a whistle. Somehow I am still under-fucking-qualified.'],
 ['visit','filthy','permit','The imaginary schooner department has gone paperless. Same bullshit, new portal.'],
 ['visit','filthy','robe','Dressing gown. Whistle. Clipboard. An absolute HR fucking nightmare.'],
 ['visit','filthy','deckchair','Recovery department update: the deckchair gives fewer fucks than I do.'],
 ['run','friendly','clipboard','Run recorded. The clipboard has finally been useful.'],
 ['run','friendly','proud','Run saved. A real entry in your own story. Nice work.'],
 ['run','friendly','permit','Run recorded. No imaginary permits were issued in the making of this activity.'],
 ['run','friendly','eyebrow','Run saved. Your shoes can now return to being hallway furniture.'],
 ['run','cheeky','permit','Run recorded. The imaginary schooner licensing department remains unmoved.'],
 ['run','cheeky','clipboard','Run saved. Please allow six imaginary business days for my enthusiastic response.'],
 ['run','cheeky','eyebrow','Run logged. The documentary rights remain surprisingly affordable.'],
 ['run','cheeky','proud','Run saved. I have filed a small, inconvenient amount of pride.'],
 ['run','cheeky','clipboard','Run recorded. The clipboard would applaud, but it is a clipboard.'],
 ['run','filthy','permit','Run saved. The imaginary schooner department says: lovely paperwork, still no fucking permit.'],
 ['run','filthy','eyebrow','Run logged. No need for a press conference. The fucking numbers are right there.'],
 ['run','filthy','proud','Run saved. Good effort getting it recorded. There, a compliment. Weird as fuck.'],
 ['weights','friendly','clipboard','Weights logged. The clipboard has discovered resistance training. Mostly resistance to paperwork.'],
 ['weights','friendly','proud','Session saved. No joke this time. Good to see you putting the work in.'],
 ['weights','friendly','eyebrow','Weights recorded. A small administrative victory for heavy objects.'],
 ['weights','friendly','permit','Lifting saved. The imaginary certificate is in the imaginary post.'],
 ['weights','cheeky','eyebrow','Weights logged. The mirror has submitted an invoice for supervision.'],
 ['weights','cheeky','clipboard','Lifting recorded. The tiny plates have requested representation on the board.'],
 ['weights','cheeky','proud','Session saved. My enthusiasm is internal. Deeply internal.'],
 ['weights','cheeky','clipboard','Weights logged. Somewhere, a shaker bottle is preparing its acceptance speech.'],
 ['weights','cheeky','permit','Session recorded. The imaginary employee-of-the-week committee is just me in a different hat.'],
 ['weights','filthy','eyebrow','Weights saved. The mirror inspection is not a fourth fucking set.'],
 ['weights','filthy','clipboard','Lifting logged. The tiny plates do not give a shit about your branding strategy.'],
 ['weights','filthy','proud','Session recorded. I would clap, but I am holding this fucking clipboard.'],
 ['visit','friendly','clipboard','The clipboard has a clipboard. That is how management happens.'],
 ['visit','friendly','eyebrow','My whistle has a silent mode. We are all grateful.'],
 ['visit','friendly','trophy','The imaginary trophy budget has been spent on a very small shelf.'],
 ['visit','friendly','deckchair','Coach tip: a deckchair does not need a personal best.'],
 ['visit','friendly','robe','The dressing gown has pockets for two pens and absolutely no authority.'],
 ['visit','friendly','proud','You can keep the numbers and switch me off. Healthy boundaries, inconvenient for my career.'],
];
export const JOKES: Joke[] = lines.map(([event,tone,expression,text],i)=>({id:`eq-${String(i+1).padStart(3,'0')}`,text,tone,event,requiredFacts:event==='visit'?[]:[`completed:${event}`],exclusions:['tone_above_recipient_limit','cooldown','dismissed'],expression,cooldownDays:14,fallback:'Coach is taking a quiet moment. Your training tools are ready.'}));
export interface Context { event: Event; aliases: string[]; key: string }
export function contextFor(session: Session | undefined, today: string): Context {
 // Old imports are history, not new achievements. No timestamps inferred from workout creation.
 if (!session || session.date!==today) return {event:'visit',aliases:[],key:`visit:${today}`};
 const aliases=[...(session.activity?[`activity:${session.activity.id}`]:[]),...(session.workout?[`workout:${session.workout.id}`]:[])];
 return {event:session.kind,aliases,key:aliases[0]??`session:${session.id}`};
}
export interface CoachState { tone: Tone | null; seen: string[]; recent: {id:string;at:number}[]; dismissed:string[]; current?: {key:string;id:string}; consent:boolean; feedback:{id:string;vote:string;day:string}[] }
export const freshCoach = ():CoachState=>({tone:null,seen:[],recent:[],dismissed:[],consent:false,feedback:[]});
const ranks = {off:0,friendly:1,cheeky:2,filthy:3};
export function eligible(j:Joke,ctx:Context,tone:Tone):boolean { return tone!=='off' && ranks[j.tone]<=ranks[tone] && j.event===ctx.event; }
export function choose(state:CoachState,ctx:Context,now:number,another=false):{state:CoachState;joke?:Joke} {
 if (!state.tone || state.tone==='off') return {state};
 const cached=JOKES.find(j=>j.id===state.current?.id && state.current.key===ctx.key && eligible(j,ctx,state.tone!));
 if(!another && cached) return {state:{...state,seen:[...new Set([...state.seen,...ctx.aliases])]},joke:cached};
 const seen=ctx.aliases.some(id=>state.seen.includes(id)) || state.seen.includes(ctx.key);
 if(!another && seen) return {state:{...state,current:undefined,seen:[...new Set([...state.seen,...ctx.aliases])]}};
 const candidates=JOKES.filter(j=>eligible(j,ctx,state.tone!)&&!state.dismissed.includes(j.id)&&!state.recent.some(r=>r.id===j.id&&now-r.at<j.cooldownDays*86400000));
 // Prefer the chosen intensity; cycle through lower intensities when its pool is exhausted.
 candidates.sort((a,b)=>ranks[b.tone]-ranks[a.tone]||a.id.localeCompare(b.id));
 const joke=candidates[0];
 return {joke,state:{...state,seen:[...new Set([...state.seen,ctx.key,...ctx.aliases])],current:joke?{key:ctx.key,id:joke.id}:undefined,recent:joke?[...state.recent.filter(r=>now-r.at<14*86400000),{id:joke.id,at:now}]:state.recent}};
}
export function readCoach(key:string):CoachState {
 try { const raw=localStorage.getItem(key); if(!raw)return freshCoach(); const s=JSON.parse(raw) as CoachState;
 if(![null,'off','friendly','cheeky','filthy'].includes(s.tone)||!Array.isArray(s.seen)||!s.seen.every(x=>typeof x==='string')||!Array.isArray(s.recent)||!s.recent.every(x=>typeof x.id==='string'&&Number.isFinite(x.at))||!Array.isArray(s.dismissed)||!Array.isArray(s.feedback)||typeof s.consent!=='boolean')return freshCoach();
 return s;
 }catch{return freshCoach();}
}
export function saveCoach(key:string,state:CoachState):boolean {try{localStorage.setItem(key,JSON.stringify(state));return true;}catch{return false;}}
