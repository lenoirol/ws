import { useEffect, useRef, useState } from 'react';
import { listSessions, listUsers, loadStats, PAGE, setUserRole, type SessionFilter, type SessionRow, type Stats, type UserRow } from '../../account/admin.ts';
import { formatDuration, relativeTime } from '../../account/duration.ts';
import { describeAgent } from '../../account/userAgent.ts';
import type { Role } from '../../account/useAccount.ts';
import { Icon } from '../icons.tsx';
import { t } from '../i18n.ts';
import { Segmented } from './Fields.tsx';
import { Dialog } from './Dialog.tsx';
import { Banner, EmptyState, Skeleton, Spinner } from './Form.tsx';

type Tab = 'sessions' | 'users';

const ACTIONS = [
  ['png', 'PNG'],
  ['pdf', 'PDF'],
  ['print', 'actPrint'],
  ['share', 'actShare'],
  ['regenerate', 'actRegenerate'],
] as const;

function hue(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function Avatar({ text, guest = false }: { text: string; guest?: boolean }) {
  if (guest) return <span className="av guest"><Icon name="user" size={18} /></span>;
  return <span className="av" style={{ background: `hsl(${hue(text)} 52% 50%)` }}>{(text || '?').charAt(0).toUpperCase()}</span>;
}

function Stat({ label, value, i }: { label: string; value: number | null; i: number }) {
  return (
    <div className="stat" style={{ '--i': i } as React.CSSProperties}>
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
  const request = useRef(0);

  const fail = (e: unknown) => setError(t('error', { m: (e as Error).message }));

  useEffect(() => {
    void loadStats().then(setStats).catch(fail);
  }, []);

  // The latest request wins, so a slow answer for a filter the user just left is dropped.
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

  const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const actionLabel = (label: string) => (label.startsWith('act') ? t(label as 'actPrint') : label);

  return (
    <Dialog title={t('admin')} size="lg" onClose={onClose}>
      <div className="stats">
        <Stat i={0} label={t('statVisits')} value={stats?.visits ?? null} />
        <Stat i={1} label={t('statDay')} value={stats?.last24h ?? null} />
        <Stat i={2} label={t('statGuests')} value={stats?.guestVisits ?? null} />
        <Stat i={3} label={t('statUsers')} value={stats?.users ?? null} />
      </div>

      <Segmented<Tab> kind="tab" className="fill" label={t('admin')} value={tab} onChange={setTab}
        options={[{ value: 'sessions', label: t('adminSessions') }, { value: 'users', label: t('adminUsers') }]} />

      {tab === 'sessions' && (
        <div className="view-swap" key="sessions">
          <Segmented<SessionFilter> label={t('adminSessions')} value={filter} onChange={setFilter} className="fill"
            options={[{ value: 'all', label: t('filterAll') }, { value: 'guest', label: t('filterGuests') }, { value: 'user', label: t('filterSignedIn') }]} />
          {sessions === null && <Skeleton rows={4} />}
          {sessions !== null && sessions.length === 0 && !error && <EmptyState icon="info" title={t('noSessions')} />}
          {sessions !== null && sessions.length > 0 && (
            <div className="pj-list">
              {sessions.map((s, i) => {
                const label = s.user_id ? s.profiles?.email || t('unknownUser') : t('guest');
                const chips = ACTIONS.filter(([k]) => (s.summary?.[k] ?? 0) > 0);
                const started = new Date(s.started_at);
                return (
                  <div key={s.id} className="ad-row" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
                    <Avatar text={label} guest={!s.user_id} />
                    <div className="ad-text">
                      <span className="ad-who">{label}{s.user_id && s.started_as_guest ? <em> · {t('signedInDuring')}</em> : null}</span>
                      <span className="ad-meta">
                        {formatDuration(new Date(s.last_seen_at).getTime() - started.getTime())} · {describeAgent(s.user_agent)}
                      </span>
                      <span className="chips-s">
                        {chips.length === 0 ? <span className="chip-s none">{t('noActions')}</span> : chips.map(([k, l]) => <span key={k} className="chip-s">{actionLabel(l)} {s.summary[k]}</span>)}
                      </span>
                    </div>
                    <time className="ad-when" dateTime={s.started_at} title={full.format(started)}>{relativeTime(started.getTime())}</time>
                  </div>
                );
              })}
            </div>
          )}
          {more && (
            <button type="button" className="btn block" disabled={busy} onClick={() => void loadMore()}>
              {busy && <Spinner />}<span>{t('loadMore')}</span>
            </button>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="view-swap" key="users">
          {users === null && <Skeleton rows={4} />}
          {users !== null && users.length === 0 && !error && <EmptyState icon="user" title={t('noUsers')} />}
          {users !== null && users.length > 0 && (
            <div className="pj-list">
              {users.map((u, i) => (
                <div key={u.id} className="ad-row user-row" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
                  <Avatar text={u.display_name || u.email || ''} />
                  <div className="ad-text">
                    <span className="ad-who">{u.display_name || u.email}</span>
                    <span className="ad-meta">{u.email} · {full.format(new Date(u.created_at))}</span>
                  </div>
                  <span className={`role ${u.role}`}>{u.role === 'admin' ? t('roleAdmin') : t('roleUser')}</span>
                  <button type="button" className="btn sm" disabled={busy || u.id === selfId} title={u.id === selfId ? t('cannotChangeSelf') : undefined}
                    onClick={() => void changeRole(u, u.role === 'admin' ? 'user' : 'admin')}>
                    {u.role === 'admin' ? t('makeUser') : t('makeAdmin')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <Banner kind="error">{error}</Banner>}
    </Dialog>
  );
}
