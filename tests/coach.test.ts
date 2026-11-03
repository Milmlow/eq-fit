import { describe,it,expect } from 'vitest';
import { choose,contextFor,freshCoach,JOKES,eligible,readCoach,saveCoach,type Context } from '../src/lib/coach';
import type { Session } from '../src/lib/activityPulse';
const now=1800000000000;
const run:Context={event:'run',aliases:['activity:a'],key:'activity:a'};
describe('Coach isolated humour policy',()=>{
 it('requires a tone choice and respects off',()=>{expect(choose(freshCoach(),run,now).joke).toBeUndefined();expect(choose({...freshCoach(),tone:'off'},run,now).joke).toBeUndefined();});
 it('never exceeds tone ceiling',()=>{for(const tone of ['friendly','cheeky'] as const){let state={...freshCoach(),tone};for(let n=0;n<50;n++){const r=choose(state,run,now,true);expect(r.joke?.tone).not.toBe('filthy');if(tone==='friendly')expect(r.joke?.tone??'friendly').toBe('friendly');state=r.state as typeof state;}}});
 it('reopen and sync preserve the exact joke without recording another impression',()=>{const first=choose({...freshCoach(),tone:'cheeky'},run,now);expect(choose(first.state,run,now+1000)).toEqual(first);});
 it('linking an activity to a workout does not celebrate twice',()=>{let state=choose({...freshCoach(),tone:'cheeky'},run,now).state;const linked={event:'weights' as const,key:'activity:a',aliases:['activity:a','workout:b']};const r=choose(state,linked,now);expect(r.joke).toBeUndefined();state=r.state;expect(choose(state,{event:'weights',key:'workout:b',aliases:['workout:b']},now).joke).toBeUndefined();});
 it('same-kind linking remembers both aliases even when retaining the joke',()=>{const state=choose({...freshCoach(),tone:'cheeky'},run,now).state;const linked=choose(state,{...run,aliases:['activity:a','workout:b']},now);expect(linked.state.seen).toContain('workout:b');expect(choose(linked.state,{event:'run',key:'workout:b',aliases:['workout:b']},now).joke).toBeUndefined();});
 it('a historical correction removes an ineligible line',()=>{const state=choose({...freshCoach(),tone:'cheeky'},run,now).state;expect(choose(state,{...run,event:'weights'},now).joke).toBeUndefined();});
 it('Another one exhausts the pool without breaking cooldown',()=>{let state={...freshCoach(),tone:'filthy' as const};const ids=new Set();for(let i=0;i<50;i++){const r=choose(state,run,now,true);if(r.joke){expect(ids.has(r.joke.id)).toBe(false);ids.add(r.joke.id);}state=r.state as typeof state;}expect(ids.size).toBe(JOKES.filter(j=>j.event==='run').length);});
 it('retired jokes never return, even after cooldown',()=>{const state={...freshCoach(),tone:'cheeky' as const,dismissed:JOKES.map(j=>j.id)};expect(choose(state,run,now,true).joke).toBeUndefined();});
 it('old imports and empty history yield only visit context',()=>{expect(contextFor(undefined,'2026-11-03').event).toBe('visit');expect(contextFor({date:'2026-11-02'} as Session,'2026-11-03').event).toBe('visit');});
 it('date and activity title edits do not define event identity',()=>{const a={date:'2026-11-03',id:'a',kind:'run',activity:{id:'a'}} as Session;expect(contextFor(a,a.date).key).toBe(contextFor({...a,title:'new'},a.date).key);});
 it('does not depend on browser storage availability',()=>{expect(readCoach('missing')).toEqual(freshCoach());expect(saveCoach('missing',freshCoach())).toBe(false);});
 it('catalogue has stable unique IDs and full editorial metadata',()=>{expect(new Set(JOKES.map(j=>j.id)).size).toBe(JOKES.length);for(const j of JOKES){expect(j.cooldownDays).toBe(14);expect(j.fallback).toBeTruthy();expect(j.exclusions.length).toBeGreaterThan(0);expect(eligible(j,{...run,event:j.event},'off')).toBe(false);}});
});
