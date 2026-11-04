import { describe,it,expect } from 'vitest';
import { parseCoachNews } from '../src/lib/coachNews';
import { choose,freshCoach,rateCoach,type Joke } from '../src/lib/coach';
const now=Date.parse('2026-11-05T00:00:00Z');
const entry={id:'news-0123456789abcdef',text:'A fictional test line about a sporting event.',tone:'cheeky',topic:'sport',source:{title:'Example result',url:'https://www.abc.net.au/news/sport/example',publishedAt:'2026-11-04T12:00:00Z'},expiresAt:'2026-11-06T00:00:00Z'};
const batch={version:1,generatedAt:'2026-11-05T00:00:00Z',jokes:[entry]};
const ctx={event:'visit' as const,key:'visit:today',aliases:[]};
const line=(id:string,expression:Joke['expression']):Joke=>({id,expression,text:id,tone:'cheeky',event:'visit',requiredFacts:[],exclusions:[],cooldownDays:14,fallback:''});
describe('topical coach',()=>{
 it('accepts bounded fresh sources and keeps news free of workout-specific facts',()=>{const j=parseCoachNews(batch,now)[0];expect(j.event).toBe('visit');expect(j.requiredFacts).toEqual([]);expect(j.source?.url).toBe(entry.source.url);});
 it('rejects expired, future, malformed, duplicated and untrusted input',()=>{
  expect(parseCoachNews(batch,now+3*86400000)).toEqual([]);
  expect(parseCoachNews({...batch,generatedAt:'2026-12-01'},now)).toEqual([]);
  expect(parseCoachNews(null,now)).toEqual([]);
  for(const url of ['javascript:alert(1)','https://abc.net.au.evil.test/a','https://user:pass@abc.net.au/a'])expect(parseCoachNews({...batch,jokes:[{...entry,source:{...entry.source,url}}]},now)).toEqual([]);
  expect(parseCoachNews({...batch,jokes:[entry,entry]},now)).toHaveLength(1);
  expect(parseCoachNews({...batch,jokes:[{...entry,expiresAt:'2027-01-01'}]},now)).toEqual([]);
 });
 it('does not display expired cached news or exceed the tone ceiling',()=>{
  const pool=parseCoachNews(batch,now),s={...freshCoach(),tone:'cheeky' as const,current:{key:ctx.key,id:entry.id},seen:[ctx.key]};
  expect(choose(s,ctx,now,false,pool).joke?.id).toBe(entry.id);
  expect(choose(s,ctx,now+2*86400000,false,pool).joke).toBeUndefined();
  expect(choose({...s,topical:false},ctx,now,false,pool).joke).toBeUndefined();
  expect(choose({...s,tone:'friendly'},ctx,now,false,pool).joke).toBeUndefined();
 });
 it('allows sourced news after workouts and alternates with usual lines',()=>{
  const pool=[...parseCoachNews(batch,now),line('plain','clipboard')],s={...freshCoach(),tone:'cheeky' as const};
  const first=choose(s,ctx,now,true,pool);expect(first.joke?.id).toBe(entry.id);
  expect(choose(first.state,ctx,now,true,pool).joke?.id).toBe('plain');
  expect(choose(s,{...ctx,event:'run'},now,true,pool).joke?.id).toBe(entry.id);
  expect(choose({...s,topical:false},{...ctx,event:'run'},now,true,pool).joke).toBeUndefined();
 });
});
describe('explicit humour preferences',()=>{
 it('learns style without enabling analytics, caps votes, and deduplicates repeat taps',()=>{
  const liked=line('z-liked','robe'),same=line('z-same','robe'),other=line('a-other','clipboard');
  let s=rateCoach({...freshCoach(),tone:'cheeky'},liked,'landed','2026-11-05');
  s=rateCoach(s,liked,'landed','2026-11-05');expect(s.ratings).toHaveLength(1);expect(s.feedback).toEqual([]);expect(s.consent).toBe(false);
  expect(choose(s,ctx,now,true,[same,other]).joke?.id).toBe('z-same');
  for(let n=0;n<350;n++)s=rateCoach(s,line(String(n),'robe'),'landed','2026-11-05');
  expect(s.ratings).toHaveLength(300);
 });
 it('retires a dislike permanently and changing vote restores eligibility',()=>{
  const j=line('test','robe');let s=rateCoach({...freshCoach(),tone:'cheeky'},j,'not-funny','2026-11-05');
  expect(choose(s,ctx,now,true,[j]).joke).toBeUndefined();
  s=rateCoach(s,j,'landed','2026-11-05');expect(s.dismissed).toEqual([]);expect(s.ratings).toHaveLength(1);expect(choose(s,ctx,now,true,[j]).joke?.id).toBe(j.id);
 });
});
