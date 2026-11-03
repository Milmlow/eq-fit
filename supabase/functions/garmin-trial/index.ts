import { createClient } from 'npm:@supabase/supabase-js@2.99.1';
import { handleTrial } from './handler.ts';
const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(req => handleTrial(req,fetch,new Date(),async token => {
  try {
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    const hash = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const {data,error} = await db.rpc('eqfit_claim_trial',{p_hash:hash});
    return !error && data === true;
  } catch { return false; }
}));
