/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const cloudOwner = import.meta.env.VITE_EQFIT_OWNER_ID as string | undefined;
// Reject privileged key formats. Only the modern publishable key is accepted in browser builds.
export const cloud = url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && key?.startsWith('sb_publishable_') && cloudOwner
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null;

export interface SyncState { last_success: string | null; status: 'ok' | 'failed' }
export function parseSyncState(value: unknown): SyncState | null {
  if (value === null) return null;
  if (typeof value !== 'object' || !value) throw new Error('Invalid sync state.');
  const s = value as Record<string, unknown>;
  if (s.status !== 'ok' && s.status !== 'failed') throw new Error('Invalid sync state.');
  if (s.last_success !== null && (typeof s.last_success !== 'string' || !Number.isFinite(Date.parse(s.last_success)))) throw new Error('Invalid sync time.');
  return { status: s.status, last_success: s.last_success as string | null };
}
