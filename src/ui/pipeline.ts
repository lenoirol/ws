import { generateCrossword, type CrosswordResult } from '../core/crossword/generate.ts';
import { copySeed, mulberry32 } from '../core/rng.ts';
import { scrambleAll } from '../core/scramble/scramble.ts';
import type { Entry } from '../core/text.ts';
import type { GenerateOptions, WordSearchResult } from '../core/wordsearch/types.ts';
import type { LayoutWarning, Page } from '../layout/drawops.ts';
import { layoutCrossword } from '../layout/layoutCrossword.ts';
import { layoutScramble, type ScrambleItem } from '../layout/layoutScramble.ts';
import { layoutWordSearch, type Scope } from '../layout/layoutWordSearch.ts';
import type { Measure } from '../layout/measure.ts';
import { FONT_FAMILY } from '../layout/page.ts';
import type { GeneratorClient } from './generatorClient.ts';
import { t } from './i18n.ts';
import { kindsOf, type AppState, type Kind } from './state.ts';

const ANSWER_SUFFIX = 'Answer';

export function generateOptions(s: AppState, seed: number): Omit<GenerateOptions, 'onProgress'> {
  return {
    size: s.sizeMode === 'auto' ? { mode: 'auto' } : { mode: 'manual', rows: s.rows, cols: s.cols },
    dirs: s.dirs.length ? s.dirs : ['E'],
    allowOverlap: s.allowOverlap,
    fillMode: s.fillMode,
    seed,
  };
}

export function scrambleItemsFor(entries: readonly Entry[], s: AppState, seed: number): ScrambleItem[] {
  const usable = entries.filter((e) => e.letters.length > 0);
  const scr = scrambleAll(mulberry32(seed), usable, {
    firstLetter: s.firstLetter,
    hint: s.hintKind === 'random' ? { kind: 'random', count: s.hintCount } : { kind: s.hintKind },
  });
  return usable.map((e, i) => ({ display: e.display, ...(e.clue ? { clue: e.clue } : {}), scrambled: scr[i]! }));
}

/** The generated material for each kind. A kind the current mode does not use stays empty. */
export interface Built {
  ws: WordSearchResult | null;
  items: ScrambleItem[];
  cw: CrosswordResult | null;
}

export const NOTHING: Built = { ws: null, items: [], cw: null };

const KIND_LABEL: Record<Kind, () => string> = {
  ws: () => t('tabWordSearch'),
  scramble: () => t('tabScramble'),
  crossword: () => t('tabCrossword'),
};

function layoutKind(kind: Kind, s: AppState, b: Built, measure: Measure, scope: Scope): { pages: Page[]; warnings: LayoutWarning[] } | null {
  const common = { paper: s.paper, title: s.title, showName: s.showName, nameLabel: s.nameLabel, footer: s.footer, font: FONT_FAMILY, answerSuffix: ANSWER_SUFFIX };
  if (kind === 'ws') {
    if (!b.ws) return null;
    return layoutWordSearch(
      { grid: b.ws.grid, placements: b.ws.placements },
      { ...common, listMode: s.listMode, listColumns: s.listColumns, style: { frame: s.frame, cellLines: s.cellLines, boldLetters: s.boldLetters } },
      measure,
      scope,
    );
  }
  if (kind === 'scramble') {
    if (b.items.length === 0) return null;
    return layoutScramble(b.items, { ...common, showClues: s.scrambleClues }, measure, scope);
  }
  if (!b.cw || b.cw.placements.length === 0) return null;
  return layoutCrossword(
    b.cw,
    { ...common, showLength: s.cwShowLength, wordBank: s.cwWordBank, labels: { across: t('cwAcross'), down: t('cwDown'), bank: t('cwBank') } },
    measure,
    scope,
  );
}

/**
 * Lays out the pages for the current mode. When two kinds are combined, all question pages come first
 * (kind A, then kind B) followed by all answer pages in the same order, so the sheets for students
 * and the key for the teacher each stay together. Nothing is shown until every kind has its material.
 */
export function layoutFor(s: AppState, built: Built, measure: Measure): { pages: Page[]; warnings: LayoutWarning[] } {
  const kinds = kindsOf(s);
  const scopes: Scope[] = s.scope === 'both' ? ['question', 'answer'] : [s.scope];
  const pages: Page[] = [];
  const warnings: LayoutWarning[] = [];
  for (const scope of scopes) {
    for (const kind of kinds) {
      const r = layoutKind(kind, s, built, measure, scope);
      if (!r) return { pages: [], warnings: [] };
      if (kinds.length > 1) for (const p of r.pages) p.label = KIND_LABEL[kind]();
      pages.push(...r.pages);
      for (const w of r.warnings) if (!warnings.some((x) => x.kind === w.kind && ('level' in x && 'level' in w ? x.level === w.level : true))) warnings.push(w);
    }
  }
  return { pages, warnings };
}

/** Generates what the current mode needs for one seed. */
export async function buildFor(s: AppState, entries: readonly Entry[], seed: number, client: GeneratorClient): Promise<Built> {
  const kinds = kindsOf(s);
  return {
    ws: kinds.includes('ws') ? await client.run([...entries], generateOptions(s, seed), () => {}) : null,
    items: kinds.includes('scramble') ? scrambleItemsFor(entries, s, seed) : [],
    cw: kinds.includes('crossword') ? generateCrossword(entries, { seed }) : null,
  };
}

/** Builds every page of `s.copies` copies, one seed each (copy 1 matches the preview). */
export async function buildAllPages(
  s: AppState,
  entries: readonly Entry[],
  measure: Measure,
  client: GeneratorClient,
  onProgress: (done: number, total: number) => void,
): Promise<Page[]> {
  const pages: Page[] = [];
  for (let i = 0; i < s.copies; i++) {
    onProgress(i, s.copies);
    const built = await buildFor(s, entries, copySeed(s.seed, i), client);
    pages.push(...layoutFor(s, built, measure).pages);
  }
  onProgress(s.copies, s.copies);
  return pages;
}
