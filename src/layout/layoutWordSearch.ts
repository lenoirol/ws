import { DIR_VECTORS, type Grid, type Placement } from '../core/wordsearch/types.ts';
import type { DrawOp, LayoutWarning, Page } from './drawops.ts';
import { applyCase, fontInfo } from './fonts.ts';
import type { Measure } from './measure.ts';
import { fitText } from './fitText.ts';
import { alignTitleTo, alignX, ANCHOR, chromeOps, emptyPage, INK, PT_MM, SIDE_MARGIN_MM, type ChromeOptions, type Paper } from './page.ts';

export interface WordSearchStyle {
  frame: boolean;
  cellLines: boolean;
  boldLetters: boolean;
}

export type ListMode = 'words' | 'clues' | 'both' | 'none';

export interface WordSearchLayoutOptions extends ChromeOptions {
  paper: Paper;
  /** Word list shows words, clues, both, or is hidden. The answer page always shows words. */
  listMode: ListMode;
  /** Number of columns 1–6, or 'auto' to choose by text length. */
  listColumns: number | 'auto';
  style: WordSearchStyle;
  /** Suffix added to the answer page title, e.g. "Answer". */
  answerSuffix: string;
}

export interface WordSearchLayoutInput {
  grid: Grid;
  /** Placed words, in input order. The word list prints only these words. */
  placements: readonly Placement[];
}

export const DEFAULT_STYLE: WordSearchStyle = { frame: true, cellLines: false, boldLetters: false };

const TITLE_PT = 26;
const LIST_MAX_PT = 25;
const LIST_MIN_PT = 7;
const LIST_BUDGETS = [0.2, 0.35];
const MAX_CELL_MM = 18;
const MAX_FIT_COLUMNS_MARGIN_MM = 8;
const SMALL_WARN_PT = 6;
const SMALL_SEVERE_PT = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Line spacing factor: generous with large text, tighter when the list is long. */
const pitchFactor = (pt: number) => (pt >= 14 ? 2 : pt >= 10 ? 1.7 : 1.4);

interface ListPlan {
  pt: number;
  rows: number;
  cols: number;
  pitchMm: number;
  fits: boolean;
}

function planFor(words: readonly string[], cols: number, W: number, H: number, font: string, measure: Measure): ListPlan {
  const rows = Math.ceil(words.length / cols);
  const colPitch = (W - 2 * SIDE_MARGIN_MM) / cols;
  for (const budget of LIST_BUDGETS) {
    for (let pt = LIST_MAX_PT; pt >= LIST_MIN_PT; pt -= 0.5) {
      const pitchMm = pitchFactor(pt) * pt * PT_MM;
      const widest = words.reduce((m, w) => Math.max(m, measure(w, pt, 400, font)), 0);
      if (widest <= colPitch - 4 && rows * pitchMm <= budget * H) return { pt, rows, cols, pitchMm, fits: true };
    }
  }
  const pt = LIST_MIN_PT;
  return { pt, rows, cols, pitchMm: pitchFactor(pt) * pt * PT_MM, fits: false };
}

function planList(words: readonly string[], columns: number | 'auto', clueMode: boolean, W: number, H: number, font: string, measure: Measure): ListPlan {
  if (columns !== 'auto') return planFor(words, clamp(Math.round(columns), 1, 6), W, H, font, measure);
  // Words only: 4 columns as in the sample. With clues (longer): try 3, 2, 1 columns and take the option with the largest text.
  const candidates = clueMode ? [3, 2, 1] : [Math.max(1, Math.min(4, words.length))];
  const plans = candidates.map((c) => planFor(words, c, W, H, font, measure));
  return plans.reduce((best, p) => (p.fits !== best.fits ? (p.fits ? p : best) : p.pt > best.pt ? p : best));
}

const entryLabel = (display: string, clue: string | undefined, mode: ListMode): string => {
  if (mode === 'clues') return clue || display;
  if (mode === 'both') return clue ? `${display} – ${clue}` : display;
  return display;
};

/** Text-to-cell ratio interpolated from two samples: 8.3 mm cell -> 0.68; 15.4 mm cell -> 0.60. */
const letterRatio = (cellMm: number) => clamp(0.68 - (cellMm - 8.3) * 0.0113, 0.58, 0.7);

export function layoutWordSearchPage(
  input: WordSearchLayoutInput,
  o: WordSearchLayoutOptions,
  measure: Measure,
  mode_: 'question' | 'answer',
): { page: Page; warnings: LayoutWarning[] } {
  const page = emptyPage(o.paper);
  const { widthMm: W, heightMm: H } = page;
  const warnings: LayoutWarning[] = [];
  const rows = input.grid.length;
  const cols = (input.grid[0] ?? []).length;
  const title = mode_ === 'answer' && o.answerSuffix ? (o.title ? `${o.title} – ${o.answerSuffix}` : o.answerSuffix) : o.title;
  const { headerBottom, titleOp } = chromeOps(page, { ...o, title }, TITLE_PT, measure);

  // The word list determines the height left for the grid.
  const mode: ListMode = mode_ === 'answer' && o.listMode === 'clues' ? 'both' : o.listMode;
  const words = mode === 'none' ? [] : input.placements.map((p) => applyCase(entryLabel(p.entry.display, p.entry.clue, mode), o.cases.list));
  const list = words.length ? planList(words, o.listColumns, mode !== 'words', W, H, o.fonts.list, measure) : null;
  if (list && !list.fits) warnings.push({ kind: 'listTooLarge' });
  const lastBaselineLimit = H - (o.footer ? 24.6 : 15);
  const listBlock = list ? list.pitchMm * (0.9 + (list.rows - 1)) : 0;
  const areaH = lastBaselineLimit - listBlock - headerBottom;

  const margin = (W - 2 * SIDE_MARGIN_MM) / cols < MAX_FIT_COLUMNS_MARGIN_MM ? SIDE_MARGIN_MM : 0.115 * W;
  const cell = Math.min((W - 2 * margin) / cols, areaH / rows, MAX_CELL_MM);
  const gridW = cell * cols;
  const gridH = cell * rows;
  const x0 = (W - gridW) / 2;
  const y0 = headerBottom;
  alignTitleTo(titleOp, o.titleAlign, x0, x0 + gridW, W, measure);

  const letterPt = (letterRatio(cell) * cell) / PT_MM;
  if (letterPt < SMALL_SEVERE_PT) warnings.push({ kind: 'smallFont', pt: letterPt, level: 'severe' });
  else if (letterPt < SMALL_WARN_PT) warnings.push({ kind: 'smallFont', pt: letterPt, level: 'warn' });

  const ops: DrawOp[] = page.ops;
  const sw = Math.max(0.25, 0.098 * letterPt * PT_MM);

  if (o.style.cellLines) {
    const w = Math.max(0.1, sw / 4);
    for (let i = 1; i < cols; i++) ops.push({ t: 'line', x1: x0 + i * cell, y1: y0, x2: x0 + i * cell, y2: y0 + gridH, w, color: INK });
    for (let j = 1; j < rows; j++) ops.push({ t: 'line', x1: x0, y1: y0 + j * cell, x2: x0 + gridW, y2: y0 + j * cell, w, color: INK });
  }
  if (o.style.frame) ops.push({ t: 'rect', x: x0, y: y0, w: gridW, h: gridH, stroke: INK, sw });

  const weight = o.style.boldLetters ? 700 : 400;
  input.grid.forEach((row, r) => {
    row.forEach((ch, c) => {
      ops.push({
        t: 'text',
        x: x0 + (c + 0.5) * cell,
        y: y0 + (r + 0.5) * cell + fontInfo(o.fonts.puzzle).capHalf * letterPt * PT_MM,
        s: applyCase(ch, o.cases.puzzle),
        size: letterPt,
        weight,
        anchor: 'middle',
        font: o.fonts.puzzle,
        color: INK,
      });
    });
  });

  if (mode_ === 'answer') {
    for (const p of input.placements) {
      const [dr, dc] = DIR_VECTORS[p.dir];
      const n = p.entry.letters.length;
      const cx = (c: number) => x0 + (c + 0.5) * cell;
      const cy = (r: number) => y0 + (r + 0.5) * cell;
      ops.push({
        t: 'capsule',
        x1: cx(p.col),
        y1: cy(p.row),
        x2: cx(p.col + dc * (n - 1)),
        y2: cy(p.row + dr * (n - 1)),
        thickness: 0.85 * cell,
        stroke: INK,
        sw: Math.max(0.15, 0.04 * cell),
      });
      // Dot marking the first letter, set back toward the capsule's tail so it does not overlap the letter.
      const len = Math.hypot(dr, dc);
      ops.push({ t: 'dot', x: cx(p.col) - (dc / len) * 0.3 * cell, y: cy(p.row) - (dr / len) * 0.3 * cell, r: 0.07 * cell, fill: INK });
    }
  }

  if (list) {
    // The list sits under the frame, so its columns share the frame's edges.
    const colPitch = gridW / list.cols;
    const firstBaseline = y0 + gridH + 0.9 * list.pitchMm;
    words.forEach((w, i) => {
      const fit = fitText(measure, w, list.pt, colPitch - 4, o.fonts.list, LIST_MIN_PT);
      ops.push({
        t: 'text',
        x: alignX(o.listAlign, x0 + (i % list.cols) * colPitch, x0 + (i % list.cols) * colPitch + colPitch - 4),
        y: firstBaseline + Math.floor(i / list.cols) * list.pitchMm,
        s: fit.text,
        size: fit.pt,
        weight: 400,
        anchor: ANCHOR[o.listAlign],
        font: o.fonts.list,
        color: INK,
      });
    });
  }
  return { page, warnings };
}

export type Scope = 'question' | 'answer' | 'both';

export function layoutWordSearch(
  input: WordSearchLayoutInput,
  o: WordSearchLayoutOptions,
  measure: Measure,
  scope: Scope,
): { pages: Page[]; warnings: LayoutWarning[] } {
  const pages: Page[] = [];
  let warnings: LayoutWarning[] = [];
  for (const mode of ['question', 'answer'] as const) {
    if (scope !== 'both' && scope !== mode) continue;
    const r = layoutWordSearchPage(input, o, measure, mode);
    pages.push(r.page);
    if (mode === 'question' || scope === 'answer') warnings = r.warnings;
  }
  return { pages, warnings };
}

