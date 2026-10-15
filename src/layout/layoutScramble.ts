import type { ScrambledEntry } from '../core/scramble/scramble.ts';
import type { DrawOp, LayoutWarning, Page } from './drawops.ts';
import type { Measure } from './measure.ts';
import { applyCase } from './fonts.ts';
import { chromeOps, emptyPage, INK, PT_MM, SIDE_MARGIN_MM, type ChromeOptions, type Paper } from './page.ts';
import { fitText } from './fitText.ts';
import type { Scope } from './layoutWordSearch.ts';

export interface ScrambleLayoutOptions extends ChromeOptions {
  paper: Paper;
  /** Print each entry's clue right below its scramble. */
  showClues: boolean;
  answerSuffix: string;
}

export interface ScrambleItem {
  display: string;
  clue?: string;
  scrambled: ScrambledEntry;
}

const TITLE_PT = 24;
const MAX_ROW_MM = 14;
const REF_ROW_MM = 11.26;
const REF_TEXT_PT = 15.96;
const PER_COLUMN = 25;
const FIRST_BASELINE_MM = 38;
const LAST_BASELINE_FROM_BOTTOM_MM = 27.4;
const SLOT_PER_PT = 0.99 * PT_MM; // step between two slot underscores, relative to font size
const MIN_SLOT_MM = 2.6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const scrambledText = (s: ScrambledEntry) => s.tokens.map((t) => t.join('')).join(' ');
/** Number of slots for an entry: one per letter, with an empty slot at word boundaries. */
const slotCount = (s: ScrambledEntry) => s.answer.reduce((n, w) => n + w.length, 0) + Math.max(0, s.answer.length - 1);

interface Block {
  x0: number;
  x1: number;
  single: boolean;
}

function drawBlock(
  ops: DrawOp[],
  items: readonly ScrambleItem[],
  firstNumber: number,
  block: Block,
  W: number,
  rowMm: number,
  firstBaseline: number,
  mode: 'question' | 'answer',
  o: ScrambleLayoutOptions,
  measure: Measure,
  warnings: LayoutWarning[],
): void {
  const withClues = o.showClues && items.some((it) => it.clue);
  // With clue lines each entry takes two lines, so the main line is slightly smaller.
  const textPt = clamp(rowMm * (REF_TEXT_PT / REF_ROW_MM) * (withClues ? 0.8 : 1), 9, 16.5);
  const maxText = items.reduce((m, it) => Math.max(m, measure(applyCase(scrambledText(it.scrambled), o.cases.puzzle), textPt, 400, o.fonts.puzzle)), 0);
  const maxSlots = items.reduce((m, it) => Math.max(m, slotCount(it.scrambled)), 1);
  const numW = measure('00.', textPt, 400, o.fonts.puzzle);

  const numRight = block.single ? W / 2 - 62.3 : block.x0 + numW;
  const textX = numRight + 1.6;
  const dashStart = Math.max(block.single ? W / 2 - 3.1 : 0, textX + maxText + 5);
  const slot = Math.min(SLOT_PER_PT * textPt, (block.x1 - dashStart) / maxSlots);
  if (slot < MIN_SLOT_MM && !warnings.some((w) => w.kind === 'scrambleCramped')) warnings.push({ kind: 'scrambleCramped' });
  const dashLen = 0.66 * slot;
  const dashW = Math.max(0.2, 0.0595 * (1.19 * textPt) * PT_MM);

  items.forEach((it, i) => {
    const y = firstBaseline + i * rowMm;
    const push = (x: number, s: string, weight: 400 | 700, anchor: 'start' | 'middle' | 'end', size = textPt) =>
      ops.push({ t: 'text', x, y, s, size, weight, anchor, font: o.fonts.puzzle, color: INK });
    push(numRight, `${firstNumber + i}.`, 400, 'end');
    push(textX, applyCase(scrambledText(it.scrambled), o.cases.puzzle), 400, 'start');

    let k = 0;
    it.scrambled.answer.forEach((word, wi) => {
      if (wi > 0) k++;
      word.forEach((ch, ci) => {
        const cx = dashStart + k * slot + dashLen / 2;
        ops.push({ t: 'line', x1: cx - dashLen / 2, y1: y + 0.67, x2: cx + dashLen / 2, y2: y + 0.67, w: dashW, color: INK });
        const hinted = it.scrambled.hints[wi]?.[ci] === true;
        if (mode === 'answer') push(cx, applyCase(ch, o.cases.puzzle), 700, 'middle');
        else if (hinted) push(cx, applyCase(ch, o.cases.puzzle), 700, 'middle');
        k++;
      });
    });

    if (withClues && it.clue) {
      const clue = fitText(measure, applyCase(it.clue, o.cases.list), textPt * 0.62, block.x1 - textX, o.fonts.list, 6);
      ops.push({ t: 'text', x: textX, y: y + textPt * 0.62 * PT_MM + 1.6, s: clue.text, size: clue.pt, weight: 400, anchor: 'start', font: o.fonts.list, color: INK });
    }
  });
}

export function layoutScramblePage(
  items: readonly ScrambleItem[],
  firstNumber: number,
  columns: 1 | 2,
  o: ScrambleLayoutOptions,
  measure: Measure,
  mode: 'question' | 'answer',
): { page: Page; warnings: LayoutWarning[] } {
  const page = emptyPage(o.paper);
  const { widthMm: W, heightMm: H } = page;
  const warnings: LayoutWarning[] = [];
  const title = mode === 'answer' && o.answerSuffix ? (o.title ? `${o.title} – ${o.answerSuffix}` : o.answerSuffix) : o.title;
  const { headerBottom } = chromeOps(page, { ...o, title }, TITLE_PT, measure);

  const perCol = Math.ceil(items.length / columns);
  const first = Math.max(FIRST_BASELINE_MM, headerBottom + 9);
  const last = H - LAST_BASELINE_FROM_BOTTOM_MM;
  const rowMm = perCol > 1 ? Math.min(MAX_ROW_MM, (last - first) / (perCol - 1)) : MAX_ROW_MM;

  if (columns === 1) {
    drawBlock(page.ops, items, firstNumber, { x0: SIDE_MARGIN_MM, x1: W - SIDE_MARGIN_MM, single: true }, W, rowMm, first, mode, o, measure, warnings);
  } else {
    const gap = 8;
    const colW = (W - 2 * SIDE_MARGIN_MM - gap) / 2;
    const left = items.slice(0, perCol);
    const right = items.slice(perCol);
    drawBlock(page.ops, left, firstNumber, { x0: SIDE_MARGIN_MM, x1: SIDE_MARGIN_MM + colW, single: false }, W, rowMm, first, mode, o, measure, warnings);
    drawBlock(page.ops, right, firstNumber + perCol, { x0: SIDE_MARGIN_MM + colW + gap, x1: W - SIDE_MARGIN_MM, single: false }, W, rowMm, first, mode, o, measure, warnings);
  }
  // All lines share the first baseline; the chrome does not change per block.
  return { page, warnings };
}

/** Up to 25 entries: one column per page; more than that: two columns, at most 50 entries per page. */
export function layoutScramble(
  items: readonly ScrambleItem[],
  o: ScrambleLayoutOptions,
  measure: Measure,
  scope: Scope,
): { pages: Page[]; warnings: LayoutWarning[] } {
  const columns: 1 | 2 = items.length > PER_COLUMN ? 2 : 1;
  const perPage = PER_COLUMN * columns;
  const pages: Page[] = [];
  const warnings: LayoutWarning[] = [];
  const modes = scope === 'both' ? (['question', 'answer'] as const) : ([scope] as const);
  for (const mode of modes) {
    for (let start = 0; start < Math.max(1, items.length); start += perPage) {
      const r = layoutScramblePage(items.slice(start, start + perPage), start + 1, columns, o, measure, mode);
      pages.push(r.page);
      for (const w of r.warnings) if (!warnings.some((x) => x.kind === w.kind)) warnings.push(w);
    }
  }
  return { pages, warnings };
}
