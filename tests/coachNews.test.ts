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

describe('news event variety',()=>{
 const newsLine=(id:string,storyKey:string,topic:Joke['topic']='sport',url=`https://abc.net.au/${id}`):Joke=>({...line(id,'eyebrow'),storyKey,topic,source:{...entry.source,url},expiresAt:entry.expiresAt});
 it('blocks different wording and publishers covering the same event for 24 hours, including recycling',()=>{
  const first=newsLine('a','melbourne-cup-2026');
  const second=newsLine('b','melbourne-cup-2026');
  let s=choose({...freshCoach(),tone:'cheeky'},ctx,now,true,[first]).state;
  s=choose(s,ctx,now,true,[first,line('plain','robe')]).state;
  // Feed regeneration removed the old joke: persisted event identity still blocks it.
  expect(choose(s,ctx,now+1000,true,[second]).joke).toBeUndefined();
  expect(choose(s,ctx,now+86400001,true,[{...second,expiresAt:'2026-11-07T00:00:00Z'}]).joke?.id).toBe('b');
 });
 it('blocks same-source relabelling and supports older history without event metadata',()=>{
  const first=newsLine('a','melbourne-cup-2026');
  const second=newsLine('b','racing-2026','sport',first.source!.url);
  const s={...freshCoach(),tone:'cheeky' as const,recent:[{id:first.id,at:now}]};
  expect(choose(s,ctx,now+1,true,[first,second]).joke).toBeUndefined();
 });
 it('prefers an unseen category over highly liked sport at the same tone',()=>{
  const sport=newsLine('a','cricket-2026'),politics=newsLine('z','press-conference-2026','politics');
  const s={...freshCoach(),tone:'cheeky' as const,recent:[{id:'old',at:now-1000,topic:'sport' as const}],ratings:[{id:'liked',bucket:'news:sport',vote:'landed' as const}]};
  expect(choose(s,ctx,now,true,[sport,politics]).joke?.id).toBe('z');
 });
 it('accepts politics and new trusted publishers but rejects malformed event keys',()=>{
  for(const host of ['sbs.com.au','theguardian.com'])expect(parseCoachNews({...batch,jokes:[{...entry,topic:'politics',storyKey:'press-conference-2026',source:{...entry.source,url:`https://${host}/news/example`}}]},now)).toHaveLength(1);
  for(const storyKey of [12,'x','bad key','x'.repeat(101)])expect(parseCoachNews({...batch,jokes:[{...entry,storyKey}]},now)).toEqual([]);
 });
});
