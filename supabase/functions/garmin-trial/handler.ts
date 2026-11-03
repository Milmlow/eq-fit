// Stateless Garmin-only import. No database, service key, credential cache or request logging.
const ORIGIN = 'https://milmlow.github.io';
const BASE = 'https://personal.connectapi.garmin.com';
const TYPES: Record<string,string> = { running:'Running',trail_running:'Running',track_running:'Running',ultra_run:'Running',treadmill_running:'Treadmill Running',indoor_running:'Treadmill Running' };
export function runRow(value: unknown): string[] | null {
  if (!value || typeof value !== 'object') throw new Error('Invalid activity');
  const a = value as Record<string,unknown>;
  const type = typeof a.activityType === 'object' && a.activityType ? (a.activityType as Record<string,unknown>).typeKey : a.activityType;
  const label = TYPES[String(type).toLowerCase()];
  if (!label) return null;
  const id = String(a.activityId ?? '');
  const date = String(a.startTimeLocal ?? '').replace('T',' ').slice(0,19);
  if (!/^[1-9]\d{0,29}$/.test(id) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date) || !Number.isFinite(Date.parse(date.replace(' ','T')+'Z'))) throw new Error('Invalid activity');
  const number = (key: string, max: number) => { const n = a[key]; if (n == null) return null; if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max) throw new Error('Invalid number'); return n; };
  const distance = number('distance',2_000_000), seconds = number('duration',604800), speed = number('averageSpeed',25), hr = number('averageHR',300);
  const duration = seconds === null ? null : Math.round(seconds);
  const pace = speed ? Math.round(1000/speed) : null;
  return [label,date,String(a.activityName || 'Garmin run').slice(0,120),distance === null ? '' : (distance/1000).toFixed(4),duration === null ? '' : `${Math.floor(duration/3600)}:${String(Math.floor(duration/60)%60).padStart(2,'0')}:${String(duration%60).padStart(2,'0')}`,pace !== null && pace >= 60 && pace <= 3600 ? `${Math.floor(pace/60)}:${String(pace%60).padStart(2,'0')}` : '',id,hr ? String(hr) : ''];
}
export async function handleTrial(req: Request, http: typeof fetch = fetch, now = new Date(), authorizeInvite: (token: string) => Promise<boolean> = async () => false): Promise<Response> {
  const headers = { 'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body),{status,headers});
  if (req.headers.get('origin') !== ORIGIN) return reply(403,{error:'Open the EQ Fit trial link to import.'});
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (req.method !== 'POST') return reply(405,{error:'Use the trial import form.'});
  if (!req.headers.get('content-type')?.startsWith('application/json')) return reply(400,{error:'Invalid request.'});
  const invite = req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!invite || !await authorizeInvite(invite)) return reply(403,{error:'This private trial invite is missing, expired or has reached its 20-import limit.'});
  let key: string;
  try {
    const text = await req.text();
    if (text.length > 4096) return reply(413,{error:'API key is too long.'});
    const body = JSON.parse(text);
    if (typeof body.key !== 'string' || !body.key.trim() || body.key.length > 3000 || /[\r\n]/.test(body.key)) return reply(400,{error:'Paste your Garmin Personal API key.'});
    key = body.key.trim();
  } catch { return reply(400,{error:'Paste your Garmin Personal API key.'}); }
  try {
    const signal = AbortSignal.timeout(45000);
    const auth = await http(BASE+'/personalapitoken-service/personal-api/personal-api-key/token',{method:'POST',headers:{Authorization:'ApiKey '+key,Accept:'*/*'},redirect:'error',signal});
    if (!auth.ok) return reply(auth.status === 401 || auth.status === 403 ? 401 : 502,{error:auth.status === 401 || auth.status === 403 ? 'Garmin rejected this key. Check it is a current Personal API key.' : 'Garmin is unavailable. Try again later.'});
    const token = (await auth.text()).trim();
    if (!token || token.length > 10000 || /[\r\n]/.test(token)) throw new Error('Invalid token');
    const start = new Date(now.getTime()-90*86400000).toISOString().slice(0,10);
    const end = new Date(now.getTime()+86400000).toISOString().slice(0,10);
    const rows = new Map<string,string[]>();
    for (let offset=0; offset<1000; offset+=100) {
      const url = new URL(BASE+'/activitylist-service/activities/search/activities');
      url.search = new URLSearchParams({start:String(offset),limit:'100',startDate:start,endDate:end}).toString();
      const res = await http(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal});
      if (!res.ok) return reply(502,{error:'Garmin could not finish the import. Try again later.'});
      const text = await res.text();
      if (text.length > 4_000_000) throw new Error('Oversize response');
      const page: unknown = JSON.parse(text);
      if (!Array.isArray(page) || page.length>100) throw new Error('Invalid page');
      for (const a of page) { const row=runRow(a); if (row) rows.set(row[6],row); }
      if (page.length < 100) return reply(200,{rows:[...rows.values()],start,end});
    }
    return reply(422,{error:'More than 1,000 activities in 90 days. This trial cannot import the complete range.'});
  } catch { return reply(502,{error:'Import could not finish. Check your connection and try again. Saved history is unchanged.'}); }
}
