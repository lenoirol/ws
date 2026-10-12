import { useEffect, useRef, useState } from 'react';
import { listProjects, purgeProjects, restoreProjects, trashProjects, type ProjectSummary } from '../../account/projects.ts';
import { t } from '../i18n.ts';
import { Group, Segmented } from './Fields.tsx';

type View = 'active' | 'trash';

/** Saved projects and the trash. Both lists allow selecting several rows and acting on them together. */
export function ProjectsDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => Promise<void> }) {
  const [view, setView] = useState<View>('active');
  const [items, setItems] = useState<ProjectSummary[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const inTrash = view === 'trash';

  // The latest request wins, so a slow answer for the tab the user just left is dropped.
  const requestId = useRef(0);
  const load = async (which: View) => {
    const mine = ++requestId.current;
    try {
      const rows = await listProjects(which === 'trash');
      if (mine === requestId.current) setItems(rows);
    } catch (e) {
      if (mine !== requestId.current) return;
      setError(t('error', { m: (e as Error).message }));
      setItems([]);
    }
  };

  useEffect(() => {
    setItems(null);
    setSelected(new Set());
    setConfirming(false);
    setError(null);
    void load(view);
  }, [view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const allSelected = items !== null && items.length > 0 && selected.size === items.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set((items ?? []).map((p) => p.id)));

  const act = async (fn: (ids: string[]) => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn([...selected]);
      setSelected(new Set());
      setConfirming(false);
      await load(view);
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const open = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await onOpen(id);
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
      setBusy(false);
    }
  };

  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const n = selected.size;
  const typeLabel = (p: ProjectSummary) => (p.puzzle_type === 'ws' ? t('tabWordSearch') : t('tabScramble'));

  return (
    <div className="auth-backdrop" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-card wide" role="dialog" aria-modal="true" aria-label={t('myProjects')}>
        <div className="auth-head">
          <h2>{t('myProjects')}</h2>
          <button type="button" className="auth-x" aria-label={t('close')} title={t('close')} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <Segmented<View> kind="tab" className="fill" label={t('myProjects')} value={view} onChange={setView}
          options={[{ value: 'active', label: t('tabProjects') }, { value: 'trash', label: t('tabTrash') }]} />

        {inTrash && <p className="auth-msg">{t('trashHint')}</p>}
        {items === null && <p className="auth-msg" role="status">{t('loading')}</p>}
        {items !== null && items.length === 0 && !error && <p className="auth-msg">{inTrash ? t('trashEmpty') : t('noProjects')}</p>}

        {items !== null && items.length > 0 && (
          <>
            <div className="auth-links list-tools">
              <button type="button" onClick={toggleAll}>{allSelected ? t('selectNone') : t('selectAll')}</button>
            </div>
            <Group>
              {items.map((p) => (
                <div key={p.id} className="row project-row">
                  <input type="checkbox" className="project-check" aria-label={p.name || t('untitled')} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  {inTrash ? (
                    <label className="project-main static">
                      <span className="project-name">{p.name || t('untitled')}</span>
                      <span className="project-meta">{typeLabel(p)} · {t('deletedOn', { when: fmt.format(new Date(p.deleted_at ?? p.updated_at)) })}</span>
                    </label>
                  ) : (
                    <button type="button" className="project-main" disabled={busy} onClick={() => void open(p.id)}>
                      <span className="project-name">{p.name || t('untitled')}</span>
                      <span className="project-meta">{typeLabel(p)} · {fmt.format(new Date(p.updated_at))}</span>
                    </button>
                  )}
                </div>
              ))}
            </Group>
          </>
        )}

        {error && <p className="auth-msg error" role="alert">{error}</p>}

        {items !== null && items.length > 0 && !inTrash && (
          <button type="button" className="tool soft auth-submit" disabled={busy || n === 0} onClick={() => void act(trashProjects)}>
            {n > 0 ? t('moveToTrashN', { n }) : t('moveToTrash')}
          </button>
        )}

        {items !== null && items.length > 0 && inTrash && !confirming && (
          <div className="row btn-row bare">
            <button type="button" className="tool soft" disabled={busy || n === 0} onClick={() => void act(restoreProjects)}>{n > 0 ? t('restoreN', { n }) : t('restore')}</button>
            <button type="button" className="tool soft danger-text" disabled={busy || n === 0} onClick={() => setConfirming(true)}>{n > 0 ? t('deleteForeverN', { n }) : t('deleteForever')}</button>
          </div>
        )}

        {inTrash && confirming && (
          <div className="confirm-box" role="alertdialog" aria-label={t('deleteForever')}>
            <p className="auth-msg error">{t('confirmPurge', { n })}</p>
            <div className="row btn-row bare">
              <button type="button" className="tool soft" disabled={busy} onClick={() => setConfirming(false)}>{t('cancel')}</button>
              <button type="button" className="tool danger" disabled={busy} onClick={() => void act(purgeProjects)}>{t('deleteForeverN', { n })}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
