import { useEffect, useState } from 'react';
import { relativeTime } from '../../account/duration.ts';
import { listProjects, purgeProjects, restoreProjects, trashProjects, type ProjectSummary } from '../../account/projects.ts';
import { Icon, type IconName } from '../icons.tsx';
import { t } from '../i18n.ts';
import { Segmented } from './Fields.tsx';
import { Dialog, useDialogClose } from './Dialog.tsx';
import { Banner, EmptyState, Skeleton } from './Form.tsx';

type View = 'active' | 'trash';

const TYPE_ICON: Record<ProjectSummary['puzzle_type'], IconName> = { ws: 'grid', scramble: 'shuffle', crossword: 'crossword', combo: 'layers' };
const typeLabel = (p: ProjectSummary): string =>
  ({ ws: t('tabWordSearch'), scramble: t('tabScramble'), crossword: t('tabCrossword'), combo: t('tabCombo') })[p.puzzle_type];
type Lists = { active: ProjectSummary[]; trash: ProjectSummary[] };

/** Saved projects and the trash, with multi-select and a contextual action bar. */
export function ProjectsDialog({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => Promise<void> }) {
  return (
    <Dialog title={t('myProjects')} size="md" onClose={onClose}>
      <ProjectsBody onOpen={onOpen} />
    </Dialog>
  );
}

function ProjectsBody({ onOpen }: { onOpen: (id: string) => Promise<void> }) {
  const close = useDialogClose();
  const [view, setView] = useState<View>('active');
  const [lists, setLists] = useState<Lists | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Both lists are fetched together, so switching tabs is instant and the tab labels can show counts.
  const refresh = async () => {
    try {
      const [active, trash] = await Promise.all([listProjects(false), listProjects(true)]);
      setLists({ active, trash });
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
      setLists((prev) => prev ?? { active: [], trash: [] });
    }
  };
  useEffect(() => { void refresh(); }, []);

  const inTrash = view === 'trash';
  const items = lists ? (inTrash ? lists.trash : lists.active) : null;
  const n = selected.size;

  const switchView = (next: View) => {
    setView(next);
    setSelected(new Set());
    setConfirming(false);
    setError(null);
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const allSelected = !!items && items.length > 0 && n === items.length;

  const act = async (fn: (ids: string[]) => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn([...selected]);
      setSelected(new Set());
      setConfirming(false);
      await refresh();
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
      close();
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
      setBusy(false);
    }
  };

  const withCount = (label: string, count: number | undefined) => (count === undefined ? label : t('tabWithCount', { label, n: count }));

  return (
    <>
      <Segmented<View> kind="tab" className="fill" label={t('myProjects')} value={view} onChange={switchView}
        options={[{ value: 'active', label: withCount(t('tabProjects'), lists?.active.length) }, { value: 'trash', label: withCount(t('tabTrash'), lists?.trash.length) }]} />

      <div className="view-swap" key={view}>
        {items === null && <Skeleton />}
        {items !== null && items.length === 0 && (
          inTrash
            ? <EmptyState icon="trash" title={t('trashEmptyTitle')} hint={t('trashHint')} />
            : <EmptyState icon="folder" title={t('noProjectsTitle')} hint={t('noProjects')} />
        )}
        {items !== null && items.length > 0 && (
          <>
            <div className="list-head">
              <span>{inTrash ? t('trashHint') : t('projectsCount', { n: items.length })}</span>
              <button type="button" className="btn text" onClick={() => setSelected(allSelected ? new Set() : new Set(items.map((p) => p.id)))}>
                {allSelected ? t('selectNone') : t('selectAll')}
              </button>
            </div>
            <div className="pj-list">
              {items.map((p, i) => {
                const on = selected.has(p.id);
                const when = new Date(inTrash ? p.deleted_at ?? p.updated_at : p.updated_at).getTime();
                const body = (
                  <>
                    <span className={`pj-icon ${p.puzzle_type}`}><Icon name={TYPE_ICON[p.puzzle_type]} size={20} /></span>
                    <span className="pj-text">
                      <span className="pj-name">{p.name || t('untitled')}</span>
                      <span className="pj-meta">{typeLabel(p)} · {inTrash ? t('deletedOn', { when: relativeTime(when) }) : relativeTime(when)}</span>
                    </span>
                    {!inTrash && <Icon name="chevron" size={18} className="pj-go" />}
                  </>
                );
                return (
                  <div key={p.id} className="pj-row" data-selected={on ? '1' : '0'} style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
                    <button type="button" role="checkbox" aria-checked={on} aria-label={p.name || t('untitled')} className="pj-check" onClick={() => toggle(p.id)}>
                      <Icon name="check" size={14} />
                    </button>
                    <button type="button" className="pj-main" disabled={busy} onClick={() => (inTrash ? toggle(p.id) : void open(p.id))}>{body}</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {error && <Banner kind="error">{error}</Banner>}

      <div className="sel-wrap" data-open={n > 0 ? '1' : '0'}>
        <div className="sel-inner">
          {confirming ? (
            <div className="sel-bar confirm" role="alertdialog" aria-label={t('deleteForever')}>
              <span className="sel-count">{t('confirmPurge', { n })}</span>
              <button type="button" className="btn sm" disabled={busy} onClick={() => setConfirming(false)}>{t('cancel')}</button>
              <button type="button" className="btn sm danger" disabled={busy} onClick={() => void act(purgeProjects)}>{t('deleteForever')}</button>
            </div>
          ) : (
            <div className="sel-bar">
              <span className="sel-count">{t('selectedN', { n })}</span>
              {inTrash ? (
                <>
                  <button type="button" className="btn sm" disabled={busy} onClick={() => void act(restoreProjects)}><Icon name="restore" size={17} />{t('restore')}</button>
                  <button type="button" className="btn sm danger-soft" disabled={busy} onClick={() => setConfirming(true)}><Icon name="trash" size={17} />{t('deleteForever')}</button>
                </>
              ) : (
                <button type="button" className="btn sm danger-soft" disabled={busy} onClick={() => void act(trashProjects)}><Icon name="trash" size={17} />{t('moveToTrash')}</button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
