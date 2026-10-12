import { backend, supabase } from './supabase.ts';

/**
 * One row per visit in work_sessions (guests included): a heartbeat plus a few counters.
 * Nothing the user typed (words, titles) is ever sent.
 */
export type Action = 'png' | 'pdf' | 'print' | 'share' | 'regenerate';

const counts: Partial<Record<Action, number>> = {};
let sessionId: string | null = null;
let accessToken: string | null = null;
let started = false;

export function track(action: Action): void {
  counts[action] = (counts[action] ?? 0) + 1;
}

export const snapshot = (): Partial<Record<Action, number>> => ({ ...counts });

/** The signed-in user's token, kept so the final beat on page hide can still be attributed. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Sends a heartbeat now. Signing in mid-visit attaches the session to the account on the server. */
export async function beat(): Promise<void> {
  if (!supabase || !sessionId) return;
  await supabase.rpc('touch_session', { p_id: sessionId, p_summary: snapshot(), p_end: false });
}

/** Same call, but able to finish while the page is being closed. */
function beatOnExit(): void {
  if (!backend || !sessionId) return;
  void fetch(`${backend.url}/rest/v1/rpc/touch_session`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: backend.anonKey, Authorization: `Bearer ${accessToken ?? backend.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: sessionId, p_summary: snapshot(), p_end: false }),
  }).catch(() => undefined);
}

export async function startSessionLog(): Promise<void> {
  if (!supabase || started) return;
  started = true;
  try {
    const { data, error } = await supabase.rpc('start_session', { p_user_agent: navigator.userAgent });
    if (error || typeof data !== 'string') return;
    sessionId = data;
  } catch {
    return; // logging must never get in the way of the app
  }
  setInterval(() => {
    if (document.visibilityState === 'visible') void beat().catch(() => undefined);
  }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') beatOnExit();
  });
  window.addEventListener('pagehide', beatOnExit);
}
