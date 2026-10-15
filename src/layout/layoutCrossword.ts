import type { CrosswordResult, CwPlacement } from '../core/crossword/generate.ts';
import type { DrawOp, LayoutWarning, Page } from './drawops.ts';
import { applyCase, fontInfo, type TextCase } from './fonts.ts';
import type { Measure } from './measure.ts';
import { alignTitleTo, alignX, ANCHOR, chromeOps, emptyPage, INK, PT_MM, SIDE_MARGIN_MM, type ChromeOptions, type Paper } from './page.ts';
import type { Scope } from './layoutWordSearch.ts';

export interface CrosswordLayoutOptions extends ChromeOptions {
  paper: Paper;
  /** Print the number of letters after each clue, as in "(5)". */
  showLength: boolean;
  /** Print the answers alphabetically under the clues. Used automatically when no clue was typed. */
  wordBank: boolean;
  answerSuffix: string;
  labels: { across: string; down: string; bank: string };
}

const TITLE_PT = 26;
const MAX_CELL_MM = 14;
const CLUE_PTS = [11, 10, 9.5, 9, 8.5, 8, 7.5, 7];
const GAP_MM = 6;
const COLUMN_GAP_MM = 8;
/** Below this the numbers and letters are hard to read, so the clues move to a second page. */
const MIN_CELL_MM = 5;
const LINE = 1.3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Greedy word wrap. A single word wider than the line is left on its own line. */
function wrap(text: string, pt: number, maxW: number, font: string, measure: Measure): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(next, pt, 400, font) > maxW) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** One heading, or one clue with its wrapped lines. */
interface Block {
  heading?: string;
  num?: string;
  lines: string[];
  h: number;
  /** Heading of the list this clue belongs to, repeated when a column starts mid-list. */
  under?: string;
}

interface CluePlan {
  pt: number;
  colW: number;
  columns: Block[][];
  bank: string[];
  /** Height of the clue columns plus the word bank, in mm. */
  height: number;
  /** Height of the tallest clue column alone. */
  columnsHeight: number;
}

const clueText = (p: CwPlacement, showLength: boolean): string => {
  const len = p.entry.letters.length;
  if (p.entry.clue) return showLength ? `${p.entry.clue} (${len})` : p.entry.clue;
  return `(${len})`;
};

function cluePlan(cw: CrosswordResult, o: CrosswordLayoutOptions, bank: boolean, pt: number, ncols: number, W: number, measure: Measure): CluePlan {
  const colW = (W - 2 * SIDE_MARGIN_MM - COLUMN_GAP_MM * (ncols - 1)) / ncols;
  const numW = measure('00. ', pt, 400, o.fonts.list);
  const lineH = pt * PT_MM * LINE;

  const sections: Block[][] = [];
  for (const dir of ['across', 'down'] as const) {
    const list = cw.placements.filter((p) => p.dir === dir);
    if (list.length === 0) continue;
    const heading = applyCase(dir === 'across' ? o.labels.across : o.labels.down, o.cases.list);
    const section: Block[] = [{ heading, lines: [], h: lineH * 1.6 }];
    for (const p of list) {
      const lines = wrap(applyCase(clueText(p, o.showLength), o.cases.list), pt, colW - numW, o.fonts.list, measure);
      section.push({ num: `${p.number}.`, lines, h: lines.length * lineH + 0.25 * lineH, under: heading });
    }
    sections.push(section);
  }

  let columns: Block[][];
  if (ncols === 2 && sections.length <= 2) {
    // Two columns: Across on the left, Down on the right, so each list reads on its own.
    columns = sections.length ? sections : [[]];
  } else {
    // More columns: fill top to bottom, breaking between clues. A column that starts in the middle of
    // a list repeats that list's heading, and a heading never ends a column.
    const blocks = sections.flat();
    const target = blocks.reduce((n, b) => n + b.h, 0) / ncols;
    columns = [[]];
    let used = 0;
    for (const b of blocks) {
      const cur = columns[columns.length - 1] as Block[];
      if (columns.length < ncols && cur.length > 0 && used + b.h > target * 1.02) {
        const next: Block[] = [];
        const orphan = cur[cur.length - 1];
        if (orphan?.heading) {
          cur.pop();
          next.push(orphan);
          used = orphan.h;
        } else {
          used = 0;
          if (b.under) {
            next.push({ heading: b.under, lines: [], h: lineH * 1.6 });
            used = lineH * 1.6;
          }
        }
        columns.push(next);
      }
      (columns[columns.length - 1] as Block[]).push(b);
      used += b.h;
    }
  }
  const columnsHeight = Math.max(...columns.map((c) => c.reduce((n, b) => n + b.h, 0)));

  const words = bank ? cw.placements.map((p) => applyCase(p.entry.display, o.cases.list)).sort((a, b) => a.localeCompare(b)) : [];
  const bankLines = words.length ? wrap(words.join('   '), pt, W - 2 * SIDE_MARGIN_MM, o.fonts.list, measure) : [];
  const bankH = bankLines.length ? GAP_MM * 0.6 + lineH * 1.6 + bankLines.length * lineH : 0;
  return { pt, colW, columns, bank: bankLines, height: columnsHeight + bankH, columnsHeight };
}

function drawClues(ops: DrawOp[], plan: CluePlan, top: number, W: number, o: CrosswordLayoutOptions, measure: Measure): void {
  const lineH = plan.pt * PT_MM * LINE;
  const numW = measure('00. ', plan.pt, 400, o.fonts.list);
  plan.columns.forEach((col, k) => {
    const x = SIDE_MARGIN_MM + k * (plan.colW + COLUMN_GAP_MM);
    let y = top;
    for (const b of col) {
      if (b.heading) {
        y += lineH * 1.3;
        ops.push({ t: 'text', x, y, s: b.heading, size: plan.pt + 1, weight: 700, anchor: 'start', font: o.fonts.list, color: INK });
        y += lineH * 0.3;
        continue;
      }
      b.lines.forEach((line, i) => {
        y += lineH;
        if (i === 0 && b.num) ops.push({ t: 'text', x: x + numW - 1, y, s: b.num, size: plan.pt, weight: 700, anchor: 'end', font: o.fonts.list, color: INK });
        ops.push({ t: 'text', x: x + numW, y, s: line, size: plan.pt, weight: 400, anchor: 'start', font: o.fonts.list, color: INK });
      });
      y += 0.25 * lineH;
    }
  });
  if (plan.bank.length) {
    let y = top + plan.columnsHeight + GAP_MM * 0.6 + lineH * 1.3;
    ops.push({ t: 'text', x: SIDE_MARGIN_MM, y, s: applyCase(o.labels.bank, o.cases.list), size: plan.pt + 1, weight: 700, anchor: 'start', font: o.fonts.list, color: INK });
    y += lineH * 0.3;
    for (const line of plan.bank) {
      y += lineH;
      ops.push({ t: 'text', x: alignX(o.listAlign, SIDE_MARGIN_MM, W - SIDE_MARGIN_MM), y, s: line, size: plan.pt, weight: 400, anchor: ANCHOR[o.listAlign], font: o.fonts.list, color: INK });
    }
  }
}

function drawGrid(ops: DrawOp[], cw: CrosswordResult, cell: number, W: number, y0: number, mode: 'question' | 'answer', font: string, letterCase: TextCase): void {
  const x0 = (W - cell * cw.cols) / 2;
  const sw = clamp(cell * 0.035, 0.2, 0.4);
  const numPt = clamp((cell * 0.3) / PT_MM, 4, 9);
  const letterPt = clamp((cell * 0.56) / PT_MM, 6, 26);
  for (let r = 0; r < cw.rows; r++) {
    for (let c = 0; c < cw.cols; c++) {
      const ch = (cw.grid[r] as string[])[c] as string;
      if (!ch) continue;
      const x = x0 + c * cell;
      const y = y0 + r * cell;
      ops.push({ t: 'rect', x, y, w: cell, h: cell, stroke: INK, sw });
      const n = (cw.numbers[r] as number[])[c] as number;
      if (n) ops.push({ t: 'text', x: x + cell * 0.07, y: y + cell * 0.07 + numPt * PT_MM * 0.78, s: String(n), size: numPt, weight: 400, anchor: 'start', font, color: INK });
      if (mode === 'answer') {
        ops.push({ t: 'text', x: x + cell / 2, y: y + cell * 0.58 + fontInfo(font).capHalf * letterPt * PT_MM, s: applyCase(ch, letterCase), size: letterPt, weight: 700, anchor: 'middle', font, color: INK });
      }
    }
  }
}

/**
 * One sheet when grid and clues fit together with a readable cell. Otherwise two: the grid on its own
 * page, then the clues in two or three columns on the next, so nothing is squeezed or cut off.
 */
export function layoutCrosswordPages(
  cw: CrosswordResult,
  o: CrosswordLayoutOptions,
  measure: Measure,
  mode: 'question' | 'answer',
): { pages: Page[]; warnings: LayoutWarning[] } {
  const title = mode === 'answer' && o.answerSuffix ? (o.title ? `${o.title} – ${o.answerSuffix}` : o.answerSuffix) : o.title;
  const chrome = { ...o, title };
  const first = emptyPage(o.paper);
  const { widthMm: W, heightMm: H } = first;
  const { headerBottom, titleOp } = chromeOps(first, chrome, TITLE_PT, measure);
  const alignToGrid = (cell: number) => alignTitleTo(titleOp, o.titleAlign, (W - cell * cw.cols) / 2, (W + cell * cw.cols) / 2, W, measure);
  const warnings: LayoutWarning[] = [];
  if (cw.rows === 0 || cw.cols === 0) return { pages: [first], warnings };

  // Without clues the puzzle cannot be solved, so the word bank is printed whatever the setting says.
  const bank = o.wordBank || !cw.placements.some((p) => p.entry.clue);
  const bottom = H - (o.footer ? 24.6 : 15);
  const ideal = Math.min(MAX_CELL_MM, (W - 2 * SIDE_MARGIN_MM) / cw.cols);

  // Everything on one page: the largest clue text that leaves the grid near the size the width allows.
  let chosen: { p: CluePlan; cell: number } | null = null;
  let best: { p: CluePlan; cell: number } | null = null;
  for (const pt of CLUE_PTS) {
    const p = cluePlan(cw, o, bank, pt, 2, W, measure);
    const cell = clamp(Math.min(ideal, (bottom - headerBottom - GAP_MM - p.height) / cw.rows), 0, MAX_CELL_MM);
    if (!best || cell > best.cell) best = { p, cell };
    if (cell >= ideal * 0.85) {
      chosen = { p, cell };
      break;
    }
  }
  const single = chosen ?? (best as { p: CluePlan; cell: number });

  if (single.cell >= MIN_CELL_MM || single.cell >= ideal * 0.85) {
    const y0 = headerBottom + 1;
    if (single.cell < MIN_CELL_MM) warnings.push({ kind: 'crosswordCramped' });
    alignToGrid(single.cell);
    drawGrid(first.ops, cw, single.cell, W, y0, mode, o.fonts.puzzle, o.cases.puzzle);
    drawClues(first.ops, single.p, y0 + single.cell * cw.rows + GAP_MM, W, o, measure);
    return { pages: [first], warnings };
  }

  // Two pages. The grid takes the whole first page; its size is limited only by the paper.
  const gridCell = clamp(Math.min(ideal, (bottom - headerBottom - 1) / cw.rows), 0, MAX_CELL_MM);
  if (gridCell < MIN_CELL_MM) warnings.push({ kind: 'crosswordCramped' });
  alignToGrid(gridCell);
  drawGrid(first.ops, cw, gridCell, W, headerBottom + 1, mode, o.fonts.puzzle, o.cases.puzzle);

  const second = emptyPage(o.paper);
  const top2 = chromeOps(second, chrome, TITLE_PT, measure).headerBottom + 4;
  let plan: CluePlan | null = null;
  search: for (const ncols of [2, 3]) {
    for (const pt of CLUE_PTS) {
      const p = cluePlan(cw, o, bank, pt, ncols, W, measure);
      if (top2 + p.height <= bottom) {
        plan = p;
        break search;
      }
    }
  }
  plan ??= cluePlan(cw, o, bank, CLUE_PTS[CLUE_PTS.length - 1] as number, 3, W, measure);
  drawClues(second.ops, plan, top2, W, o, measure);
  return { pages: [first, second], warnings };
}

export function layoutCrossword(
  cw: CrosswordResult,
  o: CrosswordLayoutOptions,
  measure: Measure,
  scope: Scope,
): { pages: Page[]; warnings: LayoutWarning[] } {
  const pages: Page[] = [];
  const warnings: LayoutWarning[] = [];
  for (const mode of ['question', 'answer'] as const) {
    if (scope !== 'both' && scope !== mode) continue;
    const r = layoutCrosswordPages(cw, o, measure, mode);
    pages.push(...r.pages);
    for (const w of r.warnings) if (!warnings.some((x) => x.kind === w.kind)) warnings.push(w);
  }
  return { pages, warnings };
}
