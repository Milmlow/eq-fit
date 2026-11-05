import type { Joke } from './coach';
const DAY=86400000;
const sources=['abc.net.au','sbs.com.au','theguardian.com','bbc.com','bbc.co.uk','reuters.com','apnews.com','cricket.com.au','afl.com.au','nrl.com'];
export function parseCoachNews(raw:unknown,now=Date.now()):Joke[] {
 if(!raw || typeof raw!=='object')return [];
 const data=raw as Record<string,unknown>;
 const generated=typeof data.generatedAt==='string'?Date.parse(data.generatedAt):NaN;
 if(data.version!==1 || !Number.isFinite(generated) || generated>now+300000 || now-generated>2*DAY || !Array.isArray(data.jokes) || data.jokes.length>12)return [];
 const result:Joke[]=[];
 for(const entry of data.jokes){
  if(!entry || typeof entry!=='object')continue;
  const j=entry as Record<string,unknown>, source=j.source as Record<string,unknown>|undefined;
  if(typeof j.id!=='string'||!/^news-[a-f0-9]{16}$/.test(j.id)||result.some(x=>x.id===j.id)||typeof j.text!=='string'||j.text.length<10||j.text.length>280||!['friendly','cheeky','filthy'].includes(String(j.tone))||!['sport','culture','everyday','politics'].includes(String(j.topic))||typeof j.expiresAt!=='string'||!source||typeof source.url!=='string'||typeof source.title!=='string'||source.title.length>140||typeof source.publishedAt!=='string')continue;
  if(j.storyKey!==undefined&&(typeof j.storyKey!=='string'||j.storyKey.length>100||!/^[a-z0-9]+(?:-[a-z0-9]+){1,15}$/.test(j.storyKey)))continue;
  const expiry=Date.parse(j.expiresAt),published=Date.parse(source.publishedAt);
  if(!Number.isFinite(expiry)||expiry<=now||expiry>generated+2*DAY||!Number.isFinite(published)||published>generated+300000||generated-published>2*DAY)continue;
  try {const u=new URL(source.url);if(u.protocol!=='https:'||u.username||u.password||!sources.some(d=>u.hostname===d||u.hostname.endsWith(`.${d}`)))continue;}catch{continue;}
  result.push({storyKey:j.storyKey as string|undefined,id:j.id,text:j.text,tone:j.tone as Joke['tone'],topic:j.topic as Joke['topic'],source:{title:source.title,url:source.url,publishedAt:source.publishedAt},expiresAt:j.expiresAt,event:'visit',expression:'eyebrow',requiredFacts:[],exclusions:[],cooldownDays:14,fallback:'Your training tools are ready.'});
 }
 return result;
}
export async function loadCoachNews(signal:AbortSignal):Promise<Joke[]> {
 const timeout=new AbortController();const timer=setTimeout(()=>timeout.abort(),4000);
 const abort=()=>timeout.abort();signal.addEventListener('abort',abort,{once:true});
 try {if(signal.aborted)return [];const r=await fetch(`${import.meta.env.BASE_URL}coach-news.json`,{signal:timeout.signal,cache:'no-store',credentials:'omit'});if(!r.ok)return [];const text=await r.text();return text.length>30000?[]:parseCoachNews(JSON.parse(text));}catch{return [];}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
}
