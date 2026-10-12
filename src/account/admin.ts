import type { PuzzleType } from './projects.ts';
import type { Role } from './useAccount.ts';
import { supabase } from './supabase.ts';

/** What an approved reset sets the password to. The server does the change; this is only shown. */
export const DEFAULT_PASSWORD = '123456';

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
  must_change_password: boolean;
  project_count: number;
  visit_count: number;
  last_seen_at: string | null;
  last_user_agent: string | null;
}

export interface UserProject {
  id: string;
  name: string;
  puzzle_type: PuzzleType;
  updated_at: string;
}

export interface ResetRequest {
  id: string;
  user_id: string;
  email: string;
  requested_at: string;
  user_agent: string | null;
  status: 'pending' | 'approved' | 'dismissed';
  handled_at: string | null;
}

export interface Stats {
  visits: number;
  last24h: number;
  guestVisits: number;
  users: number;
  pendingRequests: number;
}

export const PAGE = 50;

function client() {
  if (!supabase) throw new Error('Accounts are not available in this build.');
  return supabase;
}

const SESSION_COLUMNS = 'id, user_id, started_as_guest, started_at, last_seen_at, user_agent, summary, profiles(email, display_name)';

/** The server only answers these for administrators (row level security); a normal user gets nothing. */
export async function listSessions(filter: SessionFilter, offset: number, userId?: string): Promise<SessionRow[]> {
  let q = client().from('work_sessions').select(SESSION_COLUMNS).order('started_at', { ascending: false }).range(offset, offset + PAGE - 1);
  if (userId) q = q.eq('user_id', userId);
  else if (filter === 'guest') q = q.is('user_id', null);
  else if (filter === 'user') q = q.not('user_id', 'is', null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SessionRow[];
}

/** Accounts with project and visit counts and the last visit. Trash is not counted. */
export async function listUsers(): Promise<UserRow[]> {
  const { data, error } = await client().rpc('admin_users');
  if (error) throw new Error(error.message);
  return ((data ?? []) as UserRow[]).map((u) => ({ ...u, project_count: Number(u.project_count), visit_count: Number(u.visit_count) }));
}

/** A person's saved projects. Their trash is hidden by the database, not just here. */
export async function listUserProjects(userId: string): Promise<UserProject[]> {
  const { data, error } = await client()
    .from('projects')
    .select('id, name, puzzle_type, updated_at')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as UserProject[];
}

export async function updateUser(id: string, displayName: string, email: string): Promise<void> {
  const { error } = await client().rpc('admin_update_user', { p_user: id, p_display_name: displayName, p_email: email });
  if (error) throw new Error(error.message);
}

export async function setUserRole(id: string, role: Role): Promise<void> {
  const { error } = await client().rpc('set_user_role', { p_user: id, p_role: role });
  if (error) throw new Error(error.message);
}

export async function listRequests(): Promise<ResetRequest[]> {
  const { data, error } = await client()
    .from('password_reset_requests')
    .select('id, user_id, email, requested_at, user_agent, status, handled_at')
    .order('requested_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as ResetRequest[];
}

export async function approveReset(id: string): Promise<void> {
  const { error } = await client().rpc('admin_reset_password', { p_request: id });
  if (error) throw new Error(error.message);
}

export async function dismissRequest(id: string): Promise<void> {
  const { error } = await client().rpc('admin_dismiss_request', { p_request: id });
  if (error) throw new Error(error.message);
}

export async function pendingRequestCount(): Promise<number> {
  const { count, error } = await client().from('password_reset_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function loadStats(): Promise<Stats> {
  const db = client();
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await q;
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [visits, last24h, guestVisits, users, pendingRequests] = await Promise.all([
    count(db.from('work_sessions').select('id', { count: 'exact', head: true })),
    count(db.from('work_sessions').select('id', { count: 'exact', head: true }).gte('started_at', since)),
    count(db.from('work_sessions').select('id', { count: 'exact', head: true }).is('user_id', null)),
    count(db.from('profiles').select('id', { count: 'exact', head: true })),
    pendingRequestCount(),
  ]);
  return { visits, last24h, guestVisits, users, pendingRequests };
}
