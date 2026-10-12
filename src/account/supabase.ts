import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when the build has no backend configured: accounts and session logging are then switched off. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const backend = url && anonKey ? { url, anonKey } : null;
