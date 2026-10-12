import type { Role } from './useAccount.ts';
import { supabase } from './supabase.ts';

export type SessionFilter = 'all' | 'guest' | 'user';

export interface SessionRow {
  id: string;
  user_id: string | null;
  started_as_guest: boolean;
  started_at: string;
  last_seen_at: string;
  user_agent: string | null;
  summary: Record<string, number>;
  profiles: { email: string | null; display_name: string | null } | null;
}

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  created_at: string;
}

export interface Stats {
  visits: number;
  last24h: number;
  guestVisits: number;
  users: number;
}

export const PAGE = 50;

function client() {
  if (!supabase) throw new Error('Accounts are not available in this build.');
  return supabase;
}

/** The server only answers these for administrators (row level security); a normal user gets nothing. */
export async function listSessions(filter: SessionFilter, offset: number): Promise<SessionRow[]> {
  let q = client()
    .from('work_sessions')
    .select('id, user_id, started_as_guest, started_at, last_seen_at, user_agent, summary, profiles(email, display_name)')
    .order('started_at', { ascending: false })
    .range(offset, offset + PAGE - 1);
  if (filter === 'guest') q = q.is('user_id', null);
  if (filter === 'user') q = q.not('user_id', 'is', null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SessionRow[];
}

export async function listUsers(): Promise<UserRow[]> {
  const { data, error } = await client().from('profiles').select('id, email, display_name, role, created_at').order('created_at', { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as UserRow[];
}

export async function setUserRole(id: string, role: Role): Promise<void> {
  const { error } = await client().rpc('set_user_role', { p_user: id, p_role: role });
  if (error) throw new Error(error.message);
}

export async function loadStats(): Promise<Stats> {
  const db = client();
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await q;
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [visits, last24h, guestVisits, users] = await Promise.all([
    count(db.from('work_sessions').select('id', { count: 'exact', head: true })),
    count(db.from('work_sessions').select('id', { count: 'exact', head: true }).gte('started_at', since)),
    count(db.from('work_sessions').select('id', { count: 'exact', head: true }).is('user_id', null)),
    count(db.from('profiles').select('id', { count: 'exact', head: true })),
  ]);
  return { visits, last24h, guestVisits, users };
}
