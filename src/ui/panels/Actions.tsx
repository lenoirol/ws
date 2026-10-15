import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { track } from '../../account/sessionLog.ts';
import { APP_NAME } from '../../core/constants.ts';
import { pagesToPngFile } from '../../export/png.ts';
import { pagesToPdfSmart } from '../../export/pdf.ts';
import { printPages } from '../../export/print.ts';
import { canShareFile, downloadBlob, shareBlob } from '../../export/share.ts';
import type { Entry } from '../../core/text.ts';
import type { Page } from '../../layout/drawops.ts';
import type { Measure } from '../../layout/measure.ts';
import type { Scope } from '../../layout/layoutWordSearch.ts';
import { loadPageFonts } from '../fontLoader.ts';
import { GeneratorClient } from '../generatorClient.ts';
import { t } from '../i18n.ts';
import { Segmented } from './Fields.tsx';
import { buildAllPages } from '../pipeline.ts';
import type { AppState } from '../state.ts';

type Props = { s: AppState; set: (patch: Partial<AppState>) => void; pages: Page[]; entries: Entry[]; measure: Measure; regenerate: () => void };
type Job = { blob: Blob; filename: string };

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ICONS = {
  image: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 16l5-5 4 4 3-3 6 6M9 9.5a.5.5 0 1 0 0 .01',
  doc: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6',
  print: 'M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
  share: 'M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1',
} as const;

/** The toolbar uses icons; accessible names and tooltips identify each action. */
function Ico({ d }: { d: string }) {
  return (
    <svg className="ico" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function ShareMenu({ disabled, onShare }: { disabled: boolean; onShare: (format: 'pdf' | 'png') => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') setOpen(false);
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 :
      (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div ref={root} className="pill share-control" data-blob="self" data-adapt>
      <button ref={trigger} type="button" className="tool icon" disabled={disabled} aria-label={t('share')} title={t('share')}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}
        onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}>
        <Ico d={ICONS.share} />
      </button>
      {open && (
        <div ref={menu} className="share-menu" role="menu" aria-label={t('share')} data-blob="self" data-blob-spec="panel" onKeyDown={onKeyDown}>
          <button type="button" role="menuitem" onClick={() => { close(); onShare('pdf'); }}><Ico d={ICONS.doc} /><span>PDF</span></button>
          <button type="button" role="menuitem" onClick={() => { close(); onShare('png'); }}><Ico d={ICONS.image} /><span>PNG</span></button>
        </div>
      )}
    </div>
  );
}

export function Actions({ s, set, pages, entries, measure, regenerate }: Props) {
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const empty = pages.length === 0;
  const base = `${slug(APP_NAME)}-${{ ws: 'wordsearch', scramble: 'scramble', crossword: 'crossword', combo: s.combo.replace('+', '-') }[s.tab]}-${s.seed}${s.copies > 1 ? `-x${s.copies}` : ''}`;

  useEffect(() => {
    setCanShare(canShareFile(new Blob([''], { type: 'application/pdf' }), 'x.pdf'));
  }, []);

  /** One copy reuses the pages on screen; several copies are generated one by one. */
  const allPages = async (): Promise<Page[]> => {
    if (s.copies <= 1) return pages;
    const client = new GeneratorClient();
    try {
      return await buildAllPages(s, entries, measure, client, (n, total) => setStep(t('workingCopy', { n: Math.min(n + 1, total), total })));
    } finally {
      client.cancel();
    }
  };

  const run = async (kind: 'png' | 'pdf', action: 'save' | 'share') => {
    setWorking(true);
    setErr(null);
    setNote(null);
    try {
      const all = await allPages();
      await loadPageFonts(all);
      setStep(null);
      let job: Job;
      if (kind === 'png') job = await pagesToPngFile(all, s.dpi, base);
      else {
        const r = await pagesToPdfSmart(all, s.dpi, s.title || APP_NAME);
        if (!r.vector) setNote(t('pdfRaster'));
        job = { blob: r.blob, filename: `${base}.pdf` };
      }
      if (action === 'share') await shareBlob(job.blob, job.filename);
      else downloadBlob(job.blob, job.filename);
      track(action === 'share' ? 'share' : kind);
    } catch (e) {
      setErr(t('error', { m: (e as Error).message }));
    } finally {
      setWorking(false);
      setStep(null);
    }
  };

  const doPrint = async () => {
    setWorking(true);
    setErr(null);
    try {
      printPages(await allPages());
      track('print');
    } catch (e) {
      setErr(t('error', { m: (e as Error).message }));
    } finally {
      setWorking(false);
      setStep(null);
    }
  };

  const busy = empty || working;
  const message = err ?? note ?? (working ? step ?? t('working') : null);

  return (
    <>
      <div className="toolbar" role="toolbar" aria-label="Actions">
        <div className="pill" data-blob="self" data-adapt>
          <button type="button" className="tool icon" onClick={regenerate} aria-label={t('regenerate')} title={t('regenerate')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" /><path d="M20.5 3.5v4.5H16" /></svg>
          </button>
        </div>
        <div className="scope-control" data-blob="self" data-adapt>
        <Segmented<Scope>
          glass
          label={t('scope')}
          value={s.scope}
          onChange={(scope) => set({ scope })}
          options={[{ value: 'question', label: t('scopePuzzle') }, { value: 'answer', label: t('scopeAnswer') }, { value: 'both', label: t('scopeBoth') }]}
        />
        </div>
        <div className="pill" data-blob="self" data-adapt>
          <button type="button" className="tool icon" disabled={busy} onClick={() => void run('png', 'save')} aria-label={t('savePng')} title={t('savePng')}>
            <Ico d={ICONS.image} />
          </button>
          <button type="button" className="tool icon prominent" disabled={busy} onClick={() => void run('pdf', 'save')} aria-label={t('savePdf')} title={t('savePdf')}>
            <Ico d={ICONS.doc} />
          </button>
          <button type="button" className="tool icon" disabled={busy} onClick={() => void doPrint()} aria-label={t('print')} title={t('print')}>
            <Ico d={ICONS.print} />
          </button>
        </div>
        {canShare && <ShareMenu disabled={busy} onShare={format => void run(format, 'share')} />}
      </div>
      {message && (
        <div className={`toast ${err ? 'err' : ''}`} role={err ? 'alert' : 'status'} data-blob="self" data-adapt>
          <span>{message}</span>
        </div>
      )}
    </>
  );
}
