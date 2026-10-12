import { useEffect, useRef, useState } from 'react';
import { listProjects, trashProjects, type ProjectSummary } from '../../account/projects.ts';
import { t } from '../i18n.ts';
import { Group } from './Fields.tsx';

/** The user's saved projects: open one, or select several and move them to the trash. */
export function ProjectsDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => Promise<void> }) {
  const [items, setItems] = useState<ProjectSummary[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const reload = async () => {
    try {
      setItems(await listProjects());
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
      setItems([]);
    }
  };

  useEffect(() => {
    void reload();
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

  const trash = async () => {
    setBusy(true);
    setError(null);
    try {
      await trashProjects([...selected]);
      setSelected(new Set());
      await reload();
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="auth-backdrop" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-card wide" role="dialog" aria-modal="true" aria-label={t('myProjects')}>
        <div className="auth-head">
          <h2>{t('myProjects')}</h2>
          <button type="button" className="auth-x" aria-label={t('close')} title={t('close')} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {items === null && <p className="auth-msg" role="status">{t('loading')}</p>}
        {items !== null && items.length === 0 && !error && <p className="auth-msg">{t('noProjects')}</p>}
        {items !== null && items.length > 0 && (
          <Group>
            {items.map((p) => (
              <div key={p.id} className="row project-row">
                <input type="checkbox" className="project-check" aria-label={p.name} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                <button type="button" className="project-main" disabled={busy} onClick={() => void open(p.id)}>
                  <span className="project-name">{p.name || t('untitled')}</span>
                  <span className="project-meta">{p.puzzle_type === 'ws' ? t('tabWordSearch') : t('tabScramble')} · {fmt.format(new Date(p.updated_at))}</span>
                </button>
              </div>
            ))}
          </Group>
        )}

        {error && <p className="auth-msg error" role="alert">{error}</p>}

        {items !== null && items.length > 0 && (
          <button type="button" className="tool soft auth-submit" disabled={busy || selected.size === 0} onClick={() => void trash()}>
            {selected.size > 0 ? t('moveToTrashN', { n: selected.size }) : t('moveToTrash')}
          </button>
        )}
      </div>
    </div>
  );
}
