import { useEffect, useMemo, useState } from 'react';
import { listSessions, listUserProjects, listUsers, PAGE, setUserRole, updateUser, type SessionRow, type UserProject, type UserRow } from '../../account/admin.ts';
import { relativeTime } from '../../account/duration.ts';
import { checkCredentials } from '../../account/validate.ts';
import type { Role } from '../../account/useAccount.ts';
import { Icon, type IconName } from '../icons.tsx';
import { t } from '../i18n.ts';
import { Segmented } from '../panels/Fields.tsx';
import { Banner, EmptyState, Skeleton, Spinner, TextField } from '../panels/Form.tsx';
import { formatWhen } from './format.ts';
import { Avatar, DeviceLabel, SessionItem } from './parts.tsx';

const TYPE_ICON: Record<UserProject['puzzle_type'], IconName> = { ws: 'grid', scramble: 'shuffle', crossword: 'crossword', combo: 'layers' };
const typeName = (p: UserProject['puzzle_type']) => ({ ws: t('tabWordSearch'), scramble: t('tabScramble'), crossword: t('tabCrossword'), combo: t('tabCombo') })[p];

/** The account list, and one person's page: details to edit, their projects, and their visits. */
export function UsersPanel({ selfId, onOpenProject, onChanged }: { selfId: string; onOpenProject: (id: string, owner: string) => Promise<void>; onChanged: () => void }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setUsers(await listUsers());
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
      setUsers([]);
    }
  };
  useEffect(() => { void reload(); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter((u) => !q || `${u.display_name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q));
  }, [users, query]);

  const open = users?.find((u) => u.id === openId) ?? null;
  if (open) {
    return <UserPage user={open} selfId={selfId} onBack={() => setOpenId(null)} onOpenProject={onOpenProject}
      onSaved={async () => { await reload(); onChanged(); }} />;
  }

  return (
    <div className="view-swap">
      <div className="field-box search">
        <Icon name="search" size={18} />
        <input type="search" value={query} placeholder={t('searchUsers')} aria-label={t('searchUsers')} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {users === null && <Skeleton rows={4} />}
      {users !== null && shown.length === 0 && !error && <EmptyState icon="user" title={t('noUsers')} />}
      {shown.length > 0 && (
        <div className="pj-list">
          {shown.map((u, i) => (
            <button key={u.id} type="button" className="ad-row user-btn" style={{ '--i': Math.min(i, 8) } as React.CSSProperties} onClick={() => setOpenId(u.id)}>
              <Avatar text={u.display_name || u.email || ''} />
              <span className="ad-text">
                <span className="ad-who">{u.display_name || u.email}</span>
                <span className="ad-meta">{u.email}</span>
                <span className="ad-meta">
                  {u.last_seen_at ? <>{t('lastSeen', { when: formatWhen(u.last_seen_at) })} · <DeviceLabel ua={u.last_user_agent} /></> : t('neverSeen')}
                </span>
              </span>
              <span className="user-side">
                <span className={`role ${u.role}`}>{u.role === 'admin' ? t('roleAdmin') : t('roleUser')}</span>
                <span className="ad-meta">{u.project_count === 1 ? t('projectsCountOne') : t('projectsCount', { n: u.project_count })}</span>
              </span>
              <Icon name="chevron" size={18} className="pj-go" />
            </button>
          ))}
        </div>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </div>
  );
}

function UserPage({ user, selfId, onBack, onOpenProject, onSaved }: {
  user: UserRow;
  selfId: string;
  onBack: () => void;
  onOpenProject: (id: string, owner: string) => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const label = user.display_name || user.email || '';
  const [name, setName] = useState(user.display_name ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [role, setRole] = useState<Role>(user.role);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [badEmail, setBadEmail] = useState(false);
  const [projects, setProjects] = useState<UserProject[] | null>(null);
  const [visits, setVisits] = useState<SessionRow[] | null>(null);
  const [moreVisits, setMoreVisits] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const isSelf = user.id === selfId;
  const dirty = name.trim() !== (user.display_name ?? '') || email.trim().toLowerCase() !== (user.email ?? '').toLowerCase() || role !== user.role;

  useEffect(() => {
    let live = true;
    listUserProjects(user.id).then((p) => live && setProjects(p)).catch((e: Error) => live && (setProjects([]), setMsg({ kind: 'error', text: t('error', { m: e.message }) })));
    listSessions('all', 0, user.id).then((v) => { if (live) { setVisits(v); setMoreVisits(v.length === PAGE); } }).catch(() => live && setVisits([]));
    return () => { live = false; };
  }, [user.id]);

  const save = async () => {
    setMsg(null);
    setBadEmail(false);
    if (checkCredentials(email, 'x'.repeat(8)) === 'email') {
      setBadEmail(true);
      setMsg({ kind: 'error', text: t('authEmail') });
      return;
    }
    setSaving(true);
    try {
      await updateUser(user.id, name, email);
      if (role !== user.role && !isSelf) await setUserRole(user.id, role);
      await onSaved();
      setMsg({ kind: 'ok', text: t('changesSaved') });
    } catch (e) {
      setMsg({ kind: 'error', text: t('error', { m: (e as Error).message }) });
    } finally {
      setSaving(false);
    }
  };

  const openCopy = async (id: string) => {
    setOpening(id);
    try {
      await onOpenProject(id, label);
    } catch (e) {
      setMsg({ kind: 'error', text: t('error', { m: (e as Error).message }) });
      setOpening(null);
    }
  };

  const loadMoreVisits = async () => {
    const more = await listSessions('all', visits?.length ?? 0, user.id);
    setVisits((prev) => [...(prev ?? []), ...more]);
    setMoreVisits(more.length === PAGE);
  };

  return (
    <div className="view-swap">
      <button type="button" className="btn text back" onClick={onBack}><Icon name="back" size={18} />{t('backToUsers')}</button>

      <div className="user-head">
        <Avatar text={label} size={56} />
        <div className="ad-text">
          <span className="user-name">{label}</span>
          <span className="ad-meta">{user.email}</span>
          <span className="ad-meta">{t('joinedOn', { when: formatWhen(user.created_at) })}</span>
        </div>
        <span className={`role ${user.role}`}>{user.role === 'admin' ? t('roleAdmin') : t('roleUser')}</span>
      </div>
      {user.must_change_password && <Banner kind="info" icon="key">{t('mustChangeBadge')}</Banner>}

      <h3 className="sec-title">{t('userDetails')}</h3>
      <div className="fields">
        <TextField label={t('displayName')} value={name} onChange={setName} autoComplete="off" />
        <TextField label={t('email')} type="email" inputMode="email" value={email} onChange={setEmail} invalid={badEmail} autoComplete="off" />
        <div className="field">
          <span className="field-label">{t('roleLabel')}</span>
          <Segmented<Role> label={t('roleLabel')} value={role} onChange={(r) => !isSelf && setRole(r)} className="fill"
            options={[{ value: 'user', label: t('roleUser') }, { value: 'admin', label: t('roleAdmin') }]} />
          {isSelf && <span className="field-hint">{t('cannotChangeSelf')}</span>}
        </div>
      </div>
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <button type="button" className="btn primary block" disabled={saving || !dirty} onClick={() => void save()}>
        {saving && <Spinner />}<span>{t('saveChanges')}</span>
      </button>

      <h3 className="sec-title">{t('userProjects')}</h3>
      <p className="dlg-sub">{t('userProjectsHint')}</p>
      {projects === null && <Skeleton rows={2} />}
      {projects !== null && projects.length === 0 && <EmptyState icon="folder" title={t('noUserProjects')} />}
      {projects !== null && projects.length > 0 && (
        <div className="pj-list">
          {projects.map((p, i) => (
            <div key={p.id} className="pj-row" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
              <span className={`pj-icon ${p.puzzle_type}`}><Icon name={TYPE_ICON[p.puzzle_type]} size={20} /></span>
              <span className="pj-text">
                <span className="pj-name">{p.name || t('untitled')}</span>
                <span className="pj-meta">{typeName(p.puzzle_type)} · {relativeTime(new Date(p.updated_at).getTime())}</span>
              </span>
              <button type="button" className="btn sm" disabled={opening !== null} onClick={() => void openCopy(p.id)}>
                {opening === p.id && <Spinner />}<span>{t('openCopy')}</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <h3 className="sec-title">{t('userVisits')} · {user.visit_count}</h3>
      {visits === null && <Skeleton rows={2} />}
      {visits !== null && visits.length === 0 && <EmptyState icon="info" title={t('noVisits')} />}
      {visits !== null && visits.length > 0 && <div className="pj-list">{visits.map((s, i) => <SessionItem key={s.id} s={s} i={i} showWho={false} />)}</div>}
      {moreVisits && <button type="button" className="btn block" onClick={() => void loadMoreVisits()}>{t('loadMore')}</button>}
    </div>
  );
}
