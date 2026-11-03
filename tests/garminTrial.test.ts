import { describe,it,expect,vi } from 'vitest';
import { handleTrial,runRow } from '../supabase/functions/garmin-trial/handler';
import { trialDatabaseName } from '../src/ui/Trial';
const origin='https://milmlow.github.io';
const request=(key='test-key')=>new Request('https://example.test',{method:'POST',headers:{origin,Authorization:'Bearer '+'a'.repeat(43),'Content-Type':'application/json'},body:JSON.stringify({key})});
const allowed=async()=>true;
const now=new Date('2026-11-03T00:00:00Z');
const run={activityId:123,startTimeLocal:'2026-11-02T05:00:00',activityType:{typeKey:'running'},distance:5000,duration:1800,averageSpeed:5000/1800,averageHR:140};
describe('stateless mate trial',()=>{
 it('requires a validated private invite before sending any key upstream',async()=>{ const http=vi.fn(); expect((await handleTrial(request(),http)).status).toBe(403); expect(http).not.toHaveBeenCalled(); });
 it('converts running units and leaves missing values unknown',()=>{
  expect(runRow(run)).toEqual(['Running','2026-11-02 05:00:00','Garmin run','5.0000','0:30:00','6:00','123','140']);
  expect(runRow({...run,distance:null,duration:null,averageSpeed:null,averageHR:null})?.slice(3)).toEqual(['','','','123','']);
  expect(runRow({...run,activityType:'cycling'})).toBeNull();
  expect(()=>runRow({...run,distance:-1})).toThrow();
 });
 it('rejects other origins and malformed credentials without contacting Garmin',async()=>{
  const http=vi.fn();
  expect((await handleTrial(new Request('https://example.test',{method:'POST'}),http)).status).toBe(403);
  expect((await handleTrial(request(''),http,now,allowed)).status).toBe(400);
  expect((await handleTrial(request('bad\nkey'),http,now,allowed)).status).toBe(400);
  expect(http).not.toHaveBeenCalled();
 });
 it('authenticates only to fixed Garmin hosts and never returns credentials',async()=>{
  const http=vi.fn().mockResolvedValueOnce(new Response('private-token')).mockResolvedValueOnce(Response.json([run]));
  const result=await handleTrial(request(),http,now,allowed);
  expect(result.status).toBe(200);
  const body=await result.text();
  expect(body).not.toContain('private-token'); expect(body).not.toContain('test-key');
  expect(JSON.parse(body).rows).toHaveLength(1);
  expect(http.mock.calls.every(c=>String(c[0]).startsWith('https://personal.connectapi.garmin.com/'))).toBe(true);
  expect(http.mock.calls[0][1].headers.Authorization).toBe('ApiKey test-key');
  expect(http.mock.calls[1][1].headers.Authorization).toBe('Bearer private-token');
  expect(result.headers.get('cache-control')).toBe('no-store');
 });
 it('sanitizes upstream errors and aborts failed pages without returning partial rows',async()=>{
  const http=vi.fn().mockResolvedValueOnce(new Response('secret upstream detail',{status:401}));
  const response=await handleTrial(request(),http,now,allowed);
  expect(response.status).toBe(401); expect(await response.text()).not.toContain('secret');
  const paging=vi.fn().mockResolvedValueOnce(new Response('token')).mockResolvedValueOnce(Response.json(Array(100).fill(run))).mockResolvedValueOnce(new Response('secret',{status:500}));
  const fail=await handleTrial(request(),paging,now,allowed);
  expect(fail.status).toBe(502); expect(await fail.text()).not.toContain('rows');
 });
 it('separates trial data by key and from the owner database',async()=>{
  const a=await trialDatabaseName('one'),b=await trialDatabaseName('two');
  expect(a).not.toBe(b); expect(a).not.toBe('recomp');
  expect(await trialDatabaseName(' one ')).toBe(a); expect(a).not.toContain('one');
 });
});
