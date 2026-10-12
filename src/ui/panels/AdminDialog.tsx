import { useEffect, useRef, useState } from 'react';
import { listSessions, listUsers, loadStats, PAGE, setUserRole, type SessionFilter, type SessionRow, type Stats, type UserRow } from '../../account/admin.ts';
import { formatDuration } from '../../account/duration.ts';
import { describeAgent } from '../../account/userAgent.ts';
import type { Role } from '../../account/useAccount.ts';
import { t } from '../i18n.ts';
import { Group, Segmented } from './Fields.tsx';

type Tab = 'sessions' | 'users';

const ACTIONS = [
  ['png', 'PNG'],
  ['pdf', 'PDF'],
  ['print', 'actPrint'],
  ['share', 'actShare'],
  ['regenerate', 'actRegenerate'],
] as const;

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="stat">
      <span className="stat-value">{value ?? '–'}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/** Administrators only: usage log and account list. The server enforces this; the UI merely hides it from others. */
export function AdminDialog({ selfId, onClose }: { selfId: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('sessions');
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const request = useRef(0);

  const fail = (e: unknown) => setError(t('error', { m: (e as Error).message }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    void loadStats().then(setStats).catch(fail);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const mine = ++request.current;
    setError(null);
    if (tab === 'sessions') {
      setSessions(null);
      listSessions(filter, 0)
        .then((rows) => { if (mine === request.current) { setSessions(rows); setMore(rows.length === PAGE); } })
        .catch((e) => { if (mine === request.current) { fail(e); setSessions([]); } });
    } else {
      setUsers(null);
      listUsers()
        .then((rows) => { if (mine === request.current) setUsers(rows); })
        .catch((e) => { if (mine === request.current) { fail(e); setUsers([]); } });
    }
  }, [tab, filter]);

  const loadMore = async () => {
    setBusy(true);
    try {
      const rows = await listSessions(filter, sessions?.length ?? 0);
      setSessions((prev) => [...(prev ?? []), ...rows]);
      setMore(rows.length === PAGE);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (u: UserRow, role: Role) => {
    setBusy(true);
    setError(null);
    try {
      await setUserRole(u.id, role);
      setUsers((prev) => (prev ?? []).map((x) => (x.id === u.id ? { ...x, role } : x)));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const actionText = (s: SessionRow) => {
    const parts = ACTIONS.filter(([k]) => (s.summary?.[k] ?? 0) > 0).map(([k, label]) => `${label.startsWith('act') ? t(label as 'actPrint') : label} ${s.summary[k]}`);
    return parts.length ? parts.join(' · ') : t('noActions');
  };
  const who = (s: SessionRow) => (s.user_id ? s.profiles?.email || t('unknownUser') : t('guest'));

  return (
    <div className="auth-backdrop" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-card wide admin" role="dialog" aria-modal="true" aria-label={t('admin')}>
        <div className="auth-head">
          <h2>{t('admin')}</h2>
          <button type="button" className="auth-x" aria-label={t('close')} title={t('close')} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="stats">
          <Stat label={t('statVisits')} value={stats?.visits ?? null} />
          <Stat label={t('statDay')} value={stats?.last24h ?? null} />
          <Stat label={t('statGuests')} value={stats?.guestVisits ?? null} />
          <Stat label={t('statUsers')} value={stats?.users ?? null} />
        </div>

        <Segmented<Tab> kind="tab" className="fill" label={t('admin')} value={tab} onChange={setTab}
          options={[{ value: 'sessions', label: t('adminSessions') }, { value: 'users', label: t('adminUsers') }]} />

        {tab === 'sessions' && (
          <>
            <Segmented<SessionFilter> label={t('adminSessions')} value={filter} onChange={setFilter}
              options={[{ value: 'all', label: t('filterAll') }, { value: 'guest', label: t('filterGuests') }, { value: 'user', label: t('filterSignedIn') }]} />
            {sessions === null && <p className="auth-msg" role="status">{t('loading')}</p>}
            {sessions !== null && sessions.length === 0 && !error && <p className="auth-msg">{t('noSessions')}</p>}
            {sessions !== null && sessions.length > 0 && (
              <Group>
                {sessions.map((s) => (
                  <div key={s.id} className="row admin-row">
                    <div className="admin-line">
                      <span className="admin-who">{who(s)}{s.user_id && s.started_as_guest ? ` · ${t('signedInDuring')}` : ''}</span>
                      <span className="admin-when">{fmt.format(new Date(s.started_at))}</span>
                    </div>
                    <div className="admin-meta">
                      {formatDuration(new Date(s.last_seen_at).getTime() - new Date(s.started_at).getTime())} · {describeAgent(s.user_agent)} · {actionText(s)}
                    </div>
                  </div>
                ))}
              </Group>
            )}
            {more && <button type="button" className="tool soft auth-submit" disabled={busy} onClick={() => void loadMore()}>{t('loadMore')}</button>}
          </>
        )}

        {tab === 'users' && (
          <>
            {users === null && <p className="auth-msg" role="status">{t('loading')}</p>}
            {users !== null && users.length === 0 && !error && <p className="auth-msg">{t('noUsers')}</p>}
            {users !== null && users.length > 0 && (
              <Group>
                {users.map((u) => (
                  <div key={u.id} className="row admin-row user-row">
                    <div className="admin-user">
                      <span className="admin-who">{u.display_name || u.email}</span>
                      <span className="admin-meta">{u.email} · {fmt.format(new Date(u.created_at))}</span>
                    </div>
                    <span className={`badge ${u.role === 'admin' ? '' : 'plain'}`}>{u.role === 'admin' ? t('roleAdmin') : t('roleUser')}</span>
                    <button type="button" className="tool soft small" disabled={busy || u.id === selfId} title={u.id === selfId ? t('cannotChangeSelf') : undefined}
                      onClick={() => void changeRole(u, u.role === 'admin' ? 'user' : 'admin')}>
                      {u.role === 'admin' ? t('makeUser') : t('makeAdmin')}
                    </button>
                  </div>
                ))}
              </Group>
            )}
          </>
        )}

        {error && <p className="auth-msg error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
