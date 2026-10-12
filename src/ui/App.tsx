import { useEffect, useState } from 'react';
import { loadProject, saveProject } from '../account/projects.ts';
import { fromSaved, toSaved } from '../account/projectState.ts';
import { track } from '../account/sessionLog.ts';
import { useAccount } from '../account/useAccount.ts';
import { APP_NAME, MAX_WORDS } from '../core/constants.ts';
import { randomSeed } from '../core/rng.ts';
import type { Issue } from '../core/text.ts';
import type { LayoutWarning } from '../layout/drawops.ts';
import type { Scope } from '../layout/layoutWordSearch.ts';
import { t } from './i18n.ts';
import { Actions } from './panels/Actions.tsx';
import { Group, Segmented } from './panels/Fields.tsx';
import { ScrambleOptions, SharedOptions, WordSearchOptions } from './panels/Options.tsx';
import { AccountMenu } from './panels/AccountMenu.tsx';
import { AuthDialog } from './panels/AuthDialog.tsx';
import { ProjectPanel, type SaveStatus } from './panels/ProjectPanel.tsx';
import { ProjectsDialog } from './panels/ProjectsDialog.tsx';
import { AppearanceMenu } from './panels/Menu.tsx';
import { Preview } from './panels/Preview.tsx';
import { Slider } from './panels/Fields.tsx';
import { initialState, type AppState, type Theme } from './state.ts';
import { usePuzzle } from './usePuzzle.ts';
import { withViewTransition } from './viewTransition.ts';

function issueText(i: Issue): string {
  switch (i.kind) {
    case 'duplicates': return t('dupes', { n: i.count });
    case 'overLimit': return t('overLimit', { n: i.count, max: MAX_WORDS });
    case 'tooShort': return t('tooShort', { w: i.word });
    case 'tooLong': return t('tooLong', { w: i.word });
    case 'unplaced': return t('unplaced', { w: i.words.join(', ') });
    case 'unchanged': return t('unchanged', { w: i.words.join(', ') });
  }
}

function warningText(w: LayoutWarning): string {
  switch (w.kind) {
    case 'smallFont': return t(w.level === 'severe' ? 'smallFontSevere' : 'smallFont', { pt: w.pt.toFixed(1) });
    case 'listTooLarge': return t('listTooLarge');
    case 'scrambleCramped': return t('scrambleCramped');
  }
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = { width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
  if (theme === 'light') return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  if (theme === 'dark') return <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></svg>;
}

function NoticeIcon({ level }: { level: 'warn' | 'info' }) {
  return level === 'warn' ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8 22 20.5H2L12 2.8zm-1 6.7v5h2v-5h-2zm0 6.4v2h2v-2h-2z" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v2h-2V7zm0 4h2v6h-2v-6z" /></svg>
  );
}

export function App() {
  const [s, setS] = useState<AppState>(initialState);
  const [view, setView] = useState<'input' | 'preview'>('input');
  const account = useAccount();
  const [authOpen, setAuthOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  /** What the guest asked for before being sent to sign in; it runs as soon as they are in. */
  const [pending, setPending] = useState<'save' | 'projects' | null>(null);
  const set = (patch: Partial<AppState>) => setS((prev) => ({ ...prev, ...patch }));
  const switchTab = (tab: AppState['tab']) => withViewTransition(() => set({ tab }));
  const view$ = usePuzzle(s);

  const doSave = async () => {
    if (!account.user) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const name = projectName.trim() || s.title.trim() || t('untitled');
      const id = await saveProject({ id: projectId, ownerId: account.user.id, name, type: s.tab, state: toSaved(s) });
      setProjectId(id);
      setProjectName(name);
      setSaveStatus({ level: 'info', text: t('savedOk') });
    } catch (e) {
      setSaveStatus({ level: 'warn', text: t('error', { m: (e as Error).message }) });
    } finally {
      setSaving(false);
    }
  };

  const ask = (what: 'save' | 'projects') => {
    if (!account.user) {
      setPending(what);
      setAuthOpen(true);
    } else if (what === 'save') void doSave();
    else setProjectsOpen(true);
  };

  useEffect(() => {
    if (!pending || !account.user) return;
    setPending(null);
    if (pending === 'save') void doSave();
    else setProjectsOpen(true);
  }, [pending, account.user]);

  useEffect(() => {
    // A different account (or none) must not keep pointing at someone else's project.
    setProjectId(null);
    setSaveStatus(null);
  }, [account.user?.id]);

  const openProject = async (id: string) => {
    const p = await loadProject(id);
    setS((prev) => fromSaved(p.state, prev));
    setProjectId(id);
    setProjectName(p.name);
    setSaveStatus(null);
    setProjectsOpen(false);
  };

  useEffect(() => {
    // Changing the compact view changes the backdrop without scrolling it.
    window.dispatchEvent(new Event('lg-refresh'));
  }, [view]);

  // The theme lives in memory only: 'system' follows the device, or pick light/dark by hand.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = s.theme === 'system' ? (mq.matches ? 'dark' : 'light') : s.theme;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [s.theme]);

  useEffect(() => {
    document.documentElement.dataset.glass = s.glassStyle;
  }, [s.glassStyle]);

  const themeLabel = t(s.theme === 'system' ? 'themeSystem' : s.theme === 'light' ? 'themeLight' : 'themeDark');

  const notices: { level: 'warn' | 'info'; text: string }[] = [
    ...view$.issues.map((i) => ({ level: i.kind === 'unplaced' ? ('warn' as const) : ('info' as const), text: issueText(i) })),
    ...(view$.unchanged.length ? [{ level: 'info' as const, text: issueText({ kind: 'unchanged', words: view$.unchanged }) }] : []),
    ...view$.warnings.map((w) => ({ level: 'warn' as const, text: warningText(w) })),
  ];
  const clueRelevant = s.tab === 'ws' ? s.listMode === 'clues' || s.listMode === 'both' : s.scrambleClues;
  if (clueRelevant && view$.wordCount > 0 && !view$.hasClues) notices.push({ level: 'warn', text: t('noClues') });

  const busyText = view$.busy ? t('generating', { placed: view$.progress?.placed ?? 0, total: view$.progress?.total ?? view$.wordCount }) : null;

  return (
    <div className={`window view-${view}`}>
      <div className="wallpaper" aria-hidden="true"><i /><i /><i /><i /></div>
      <main className="content" aria-label={t('viewPreview')}>
        <div className="scope-mobile">
          <Segmented<Scope> label={t('scope')} value={s.scope} onChange={(scope) => set({ scope })} options={[{ value: 'question', label: t('scopePuzzle') }, { value: 'answer', label: t('scopeAnswer') }, { value: 'both', label: t('scopeBoth') }]} />
        </div>
        <Preview pages={view$.pages} empty={view$.pages.length === 0 && !view$.busy} copies={s.copies} seed={s.seed} zoom={s.zoom} />
      </main>
      <div className="scroll-edge top" aria-hidden="true" />
      <div className="scroll-edge bottom" aria-hidden="true" />

      <aside className="sidebar" aria-label={t('viewInput')} data-blob="self" data-blob-spec="panel">
        <header className="sidebar-head">
          <h1><span className="app-icon" aria-hidden="true" />{APP_NAME}</h1>
          <div className="head-actions">
            <AccountMenu account={account} onSignIn={() => setAuthOpen(true)} />
            <AppearanceMenu theme={s.theme} glass={s.glassStyle} setTheme={(theme) => set({ theme })} setGlass={(glassStyle) => set({ glassStyle })} icon={<ThemeIcon theme={s.theme} />} label={themeLabel} />
          </div>
        </header>
        <div className="sidebar-scroll">
          <Segmented<AppState['tab']> kind="tab" className="fill" label={APP_NAME} value={s.tab} onChange={switchTab} options={[{ value: 'ws', label: t('tabWordSearch') }, { value: 'scramble', label: t('tabScramble') }]} />
          {account.enabled && (
            <ProjectPanel name={projectName} setName={setProjectName} saving={saving} status={saveStatus} signedIn={account.user !== null} onSave={() => ask('save')} onOpenList={() => ask('projects')} />
          )}
          <Group title={t('words')}>
            <div className="row row-wide">
              <textarea className="words" value={s.text} placeholder={t('wordsHint')} spellCheck={false} onChange={(e) => set({ text: e.target.value })} aria-label={t('words')} />
            </div>
            <div className="row count">{t('wordCount', { n: view$.wordCount })}</div>
          </Group>
          {notices.length > 0 && (
            <Group title={t('issues')}>
              {notices.map((n, i) => (
                <div key={i} className={`row notice ${n.level}`}><NoticeIcon level={n.level} /><span>{n.text}</span></div>
              ))}
            </Group>
          )}
          {view$.error && <p className="row notice warn" role="alert">{t('error', { m: view$.error })}</p>}
          {s.tab === 'ws' ? <WordSearchOptions s={s} set={set} /> : <ScrambleOptions s={s} set={set} />}
          <SharedOptions s={s} set={set} />
        </div>
      </aside>

      {view$.pages.length > 0 && (
        <div className="zoom" data-blob="self" data-adapt>
          <span>{t('zoom')}</span>
          <Slider label={t('zoom')} min={0} max={200} step={10} value={s.zoom} onChange={(zoom) => set({ zoom })} />
          <span className="zoom-value">{s.zoom === 0 ? t('fit') : `${s.zoom}%`}</span>
          {busyText && <span className="zoom-busy" role="status">{busyText}</span>}
        </div>
      )}

      <Actions s={s} set={set} pages={view$.pages} entries={view$.entries} measure={view$.measure} regenerate={() => { track('regenerate'); set({ seed: randomSeed() }); }} />

      <nav className="tabbar" aria-label="View" data-blob=".seg-glass" data-adapt>
        <Segmented<'input' | 'preview'> glass label="View" value={view} onChange={setView} options={[{ value: 'input', label: t('viewInput') }, { value: 'preview', label: t('viewPreview') }]} />
      </nav>

      {(authOpen || account.recovering) && account.enabled && <AuthDialog account={account} onClose={() => { setAuthOpen(false); if (!account.user) setPending(null); }} />}
      {projectsOpen && account.user && <ProjectsDialog onClose={() => setProjectsOpen(false)} onOpen={openProject} />}
    </div>
  );
}
