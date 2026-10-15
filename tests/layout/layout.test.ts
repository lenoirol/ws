import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/core/rng.ts';
import { scrambleAll } from '../../src/core/scramble/scramble.ts';
import { parseEntries } from '../../src/core/text.ts';
import { generateWordSearch } from '../../src/core/wordsearch/generate.ts';
import { findWord } from '../../src/core/wordsearch/solve.ts';
import { ALL_DIRS, DIR_PRESETS, type Dir } from '../../src/core/wordsearch/types.ts';
import type { DrawOp, Page } from '../../src/layout/drawops.ts';
import { DEFAULT_STYLE, layoutWordSearch, type WordSearchLayoutOptions } from '../../src/layout/layoutWordSearch.ts';
import { layoutScramble, type ScrambleLayoutOptions } from '../../src/layout/layoutScramble.ts';
import { approxMeasure } from '../../src/layout/measure.ts';
import { DEFAULT_FONTS } from '../../src/layout/fonts.ts';
import { DEFAULT_CHROME } from '../../src/layout/page.ts';
import { PT_MM, SIDE_MARGIN_MM, type Paper } from '../../src/layout/page.ts';
import { renderSvg } from '../../src/render/svg.ts';
import { GRID_A, GRID_B, WORDS_A, WORDS_B, toGrid } from '../fixtures/samples.ts';

const a4: Paper = { id: 'A4', orientation: 'portrait' };
const ws = (over: Partial<WordSearchLayoutOptions> = {}): WordSearchLayoutOptions => ({
  paper: a4, title: 'Halloween', showName: true, nameLabel: 'Name', footer: 'footer', ...DEFAULT_CHROME, listAlign: 'left', fonts: DEFAULT_FONTS,
  listMode: 'words', listColumns: 4, style: DEFAULT_STYLE, answerSuffix: 'Answer', ...over,
});
const sc = (over: Partial<ScrambleLayoutOptions> = {}): ScrambleLayoutOptions => ({
  paper: a4, showClues: false, title: 'Halloween', showName: true, nameLabel: 'Name', footer: 'footer', ...DEFAULT_CHROME, listAlign: 'left', fonts: DEFAULT_FONTS, answerSuffix: 'Answer', ...over,
});

function sample(words: string[], rows: string[], dirs: readonly Dir[]) {
  const grid = toGrid(rows);
  const placements = parseEntries(words.join('\n')).entries.map((entry, entryIndex) => {
    const occ = findWord(grid, entry.letters, dirs)[0]!;
    return { entryIndex, entry, ...occ };
  });
  return { grid, placements };
}
const A = sample(WORDS_A, GRID_A, ALL_DIRS);
const B = sample(WORDS_B, GRID_B, DIR_PRESETS.easy);

/** Bounding box (mm) of a draw op; text is estimated with approxMeasure. */
function bounds(op: DrawOp): [number, number, number, number] {
  switch (op.t) {
    case 'text': {
      const w = approxMeasure(op.s, op.size, op.weight, op.font);
      const x0 = op.anchor === 'start' ? op.x : op.anchor === 'middle' ? op.x - w / 2 : op.x - w;
      return [x0, op.y - 0.75 * op.size * PT_MM, x0 + w, op.y + 0.25 * op.size * PT_MM];
    }
    case 'line': return [Math.min(op.x1, op.x2), Math.min(op.y1, op.y2), Math.max(op.x1, op.x2), Math.max(op.y1, op.y2)];
    case 'rect': return [op.x, op.y, op.x + op.w, op.y + op.h];
    case 'capsule': {
      const r = op.thickness / 2;
      return [Math.min(op.x1, op.x2) - r, Math.min(op.y1, op.y2) - r, Math.max(op.x1, op.x2) + r, Math.max(op.y1, op.y2) + r];
    }
    case 'dot': return [op.x - op.r, op.y - op.r, op.x + op.r, op.y + op.r];
  }
}

function expectInsideMargins(page: Page, label: string) {
  for (const op of page.ops) {
    const [x0, y0, x1, y1] = bounds(op);
    expect(x0, `${label} left ${JSON.stringify(op).slice(0, 80)}`).toBeGreaterThanOrEqual(SIDE_MARGIN_MM - 0.01);
    expect(x1, `${label} right`).toBeLessThanOrEqual(page.widthMm - SIDE_MARGIN_MM + 0.01);
    expect(y0, `${label} top`).toBeGreaterThanOrEqual(8);
    expect(y1, `${label} bottom`).toBeLessThanOrEqual(page.heightMm - 8);
  }
}

const rowsOf = (page: Page, words: string[]) => {
  const byY = new Map<number, number>();
  for (const op of page.ops) if (op.t === 'text' && words.includes(op.s) && op.anchor === 'start' && op.weight === 400) byY.set(op.y, (byY.get(op.y) ?? 0) + 1);
  return [...byY.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
};

describe('layout Word Search', () => {
  it('20 words make 5 rows × 4 columns; 10 words make rows of 4, 4, 2', () => {
    const a = layoutWordSearch(A, ws(), approxMeasure, 'question').pages[0]!;
    expect(rowsOf(a, WORDS_A)).toEqual([4, 4, 4, 4, 4]);
    const b = layoutWordSearch(B, ws(), approxMeasure, 'question').pages[0]!;
    expect(rowsOf(b, WORDS_B)).toEqual([4, 4, 2]);
  });

  it('all draw ops stay inside the margins (question and answer, A4 and Letter, A3)', () => {
    for (const paper of [a4, { id: 'Letter', orientation: 'portrait' } as Paper, { id: 'A3', orientation: 'landscape' } as Paper]) {
      for (const s of [A, B]) {
        const { pages } = layoutWordSearch(s, ws({ paper }), approxMeasure, 'both');
        expect(pages).toHaveLength(2);
        pages.forEach((p, i) => expectInsideMargins(p, `${paper.id} ${i}`));
      }
    }
  });

  it('block order from top to bottom: Name, title, grid, list, footer', () => {
    const p = layoutWordSearch(A, ws(), approxMeasure, 'question').pages[0]!;
    const y = (pred: (o: DrawOp) => boolean) => (p.ops.find(pred) as { y: number }).y;
    const name = y((o) => o.t === 'text' && o.s === 'Name');
    const title = y((o) => o.t === 'text' && o.s === 'Halloween' && o.weight === 700);
    const frame = y((o) => o.t === 'rect');
    const list = y((o) => o.t === 'text' && o.s === 'Orange');
    const footer = y((o) => o.t === 'text' && o.s === 'footer');
    expect(name).toBeLessThan(title);
    expect(title).toBeLessThan(frame);
    expect(frame).toBeLessThan(list);
    expect(list).toBeLessThan(footer);
  });

  it('grid has all letters and square cells; the answer has one capsule and one dot per word', () => {
    const q = layoutWordSearch(A, ws(), approxMeasure, 'question').pages[0]!;
    const letters = q.ops.filter((o) => o.t === 'text' && o.s.length === 1 && o.weight === 400 && o.size < 30);
    expect(letters).toHaveLength(400);
    const ans = layoutWordSearch(A, ws(), approxMeasure, 'answer').pages[0]!;
    expect(ans.ops.filter((o) => o.t === 'capsule')).toHaveLength(20);
    expect(ans.ops.filter((o) => o.t === 'dot')).toHaveLength(20);
    const frame = q.ops.find((o) => o.t === 'rect') as Extract<DrawOp, { t: 'rect' }>;
    expect(frame.w).toBeCloseTo(frame.h, 6);
    expect(frame.x + frame.w / 2).toBeCloseTo(a4.id === 'A4' ? 105 : 0, 6);
  });

  it('non-square grid keeps square cells; title/Name/footer/list are not printed when turned off', () => {
    const wide = layoutWordSearch({ grid: A.grid.map((r) => r.slice(0, 12)), placements: [] }, ws({ title: '', showName: false, footer: '', listMode: 'none' }), approxMeasure, 'question').pages[0]!;
    const frame = wide.ops.find((o) => o.t === 'rect') as Extract<DrawOp, { t: 'rect' }>;
    expect(frame.w / frame.h).toBeCloseTo(12 / 20, 6);
    expect(wide.ops.filter((o) => o.t === 'text' && o.weight === 700)).toHaveLength(0);
    expect(wide.ops.some((o) => o.t === 'text' && o.s === 'Name')).toBe(false);
  });

  it('small-text warning: 64×64 on A4 at ~5pt gives a yellow warning; 100×100 a strong one', () => {
    const words = Array.from({ length: 20 }, (_, i) => `WORD${String.fromCharCode(65 + i)}${i}X`.replace(/\d/g, 'Q'));
    const { entries } = parseEntries(words.join('\n'));
    const opts = (n: number) => generateWordSearch(entries, { size: { mode: 'manual', rows: n, cols: n }, dirs: ALL_DIRS, allowOverlap: true, fillMode: 'uniform', seed: 1 });
    const w64 = layoutWordSearch(opts(64), ws({ listMode: 'none' }), approxMeasure, 'question');
    expect(w64.warnings).toContainEqual(expect.objectContaining({ kind: 'smallFont', level: 'warn' }));
    const w100 = layoutWordSearch(opts(100), ws({ listMode: 'none' }), approxMeasure, 'question');
    expect(w100.warnings).toContainEqual(expect.objectContaining({ kind: 'smallFont', level: 'severe' }));
    const a3 = layoutWordSearch(opts(64), ws({ listMode: 'none', paper: { id: 'A3', orientation: 'portrait' } }), approxMeasure, 'question');
    expect(a3.warnings.some((w) => w.kind === 'smallFont')).toBe(false);
  });

  it('SVG: one svg tag per page, exact mm size, special characters escaped', () => {
    const p = layoutWordSearch(A, ws({ title: 'A & B <x>' }), approxMeasure, 'question').pages[0]!;
    const svg = renderSvg(p);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="210mm"');
    expect(svg).toContain('A &amp; B &lt;x&gt;');
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });
});

describe('clue mode', () => {
  const withClues = (list: typeof A) => ({
    grid: list.grid,
    placements: list.placements.map((p, i) => ({ ...p, entry: { ...p.entry, clue: `Clue number ${i + 1}` } })),
  });
  const texts = (page: Page) => page.ops.filter((o): o is Extract<DrawOp, { t: 'text' }> => o.t === 'text').map((o) => o.s);

  it('list shows clues instead of words; shows both; the answer page always has words', () => {
    const c = withClues(A);
    const clues = layoutWordSearch(c, ws({ listMode: 'clues' }), approxMeasure, 'both').pages;
    expect(texts(clues[0]!)).toContain('Clue number 1');
    expect(texts(clues[0]!)).not.toContain('Orange');
    expect(texts(clues[1]!).some((t) => t.startsWith('Orange – '))).toBe(true);
    const both = layoutWordSearch(c, ws({ listMode: 'both' }), approxMeasure, 'question').pages[0]!;
    expect(texts(both)).toContain('Halloween – Clue number 1');
  });

  it('clue mode within margins, no word missing; without clues, words are used', () => {
    const c = layoutWordSearch(withClues(A), ws({ listMode: 'clues', listColumns: 'auto' }), approxMeasure, 'question').pages[0]!;
    expectInsideMargins(c, 'clue');
    expect(texts(c).filter((t) => t.startsWith('Clue number'))).toHaveLength(20);
    const none = layoutWordSearch(A, ws({ listMode: 'clues' }), approxMeasure, 'question').pages[0]!;
    expect(texts(none)).toContain('Orange');
  });

  it('an overlong clue is shrunk then truncated with "…" and still stays inside the margins', () => {
    const long = { grid: B.grid, placements: B.placements.map((p) => ({ ...p, entry: { ...p.entry, clue: 'x'.repeat(200) } })) };
    const page = layoutWordSearch(long, ws({ listMode: 'clues', listColumns: 2 }), approxMeasure, 'question').pages[0]!;
    expect(texts(page).some((t) => t.endsWith('…'))).toBe(true);
    expectInsideMargins(page, 'long');
  });

  it('scramble: clue printed below the scramble, all entries present, inside margins', () => {
    const { entries } = parseEntries(WORDS_A.map((w, i) => `${w} | Clue ${i + 1}`).join('\n'));
    const sc2 = scrambleAll(mulberry32(1), entries, { firstLetter: 'free', hint: { kind: 'none' } });
    const items = entries.map((e, i) => ({ display: e.display, clue: e.clue!, scrambled: sc2[i]! }));
    const on = layoutScramble(items, { ...sc(), showClues: true }, approxMeasure, 'question').pages[0]!;
    for (let i = 1; i <= 20; i++) expect(texts(on)).toContain(`Clue ${i}`);
    expectInsideMargins(on, 'scramble clue');
    const off = layoutScramble(items, sc(), approxMeasure, 'question').pages[0]!;
    expect(texts(off).some((t) => t.startsWith('Clue '))).toBe(false);
  });
});

describe('layout Scramble', () => {
  const { entries } = parseEntries(WORDS_A.join('\n'));
  const items = (list = entries) => {
    const sc2 = scrambleAll(mulberry32(1), list, { firstLetter: 'free', hint: { kind: 'none' } });
    return list.map((e, i) => ({ display: e.display, scrambled: sc2[i]! }));
  };

  it('20 entries make one page of 20 lines; underscore count equals letter count', () => {
    const { pages } = layoutScramble(items(), sc(), approxMeasure, 'question');
    expect(pages).toHaveLength(1);
    const nums = pages[0]!.ops.filter((o) => o.t === 'text' && /^\d+\.$/.test(o.s));
    expect(nums.map((o) => (o as { s: string }).s)).toEqual(Array.from({ length: 20 }, (_, i) => `${i + 1}.`));
    const dashes = pages[0]!.ops.filter((o) => o.t === 'line' && o.w < 0.5 && o.y1 > 30);
    expect(dashes).toHaveLength(entries.reduce((n, e) => n + e.letters.length, 0));
    expectInsideMargins(pages[0]!, 'scramble');
  });

  it('word boundary leaves an empty slot (line "Jack O Lantern": 4, 1, 7)', () => {
    const { pages } = layoutScramble(items(), sc(), approxMeasure, 'question');
    const row = pages[0]!.ops.find((o) => o.t === 'text' && o.s === '9.') as { y: number };
    const xs = pages[0]!.ops.filter((o) => o.t === 'line' && Math.abs(o.y1 - (row.y + 0.67)) < 1e-6).map((o) => (o as { x1: number }).x1).sort((a, b) => a - b);
    const step = xs[1]! - xs[0]!;
    expect(xs).toHaveLength(12);
    const gaps = xs.slice(1).map((x, i) => Math.round((x - xs[i]!) / step));
    expect(gaps).toEqual([1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1]);
  });

  it('more than 25 entries: two columns, several pages; the answer fills bold letters', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ display: `Word${'abcdefghij'[i % 10]}${'klmnopqrst'[(i / 10) | 0]}`, letters: Array.from(`WORD${'ABCDEFGHIJ'[i % 10]}${'KLMNOPQRST'[(i / 10) | 0]}`) }));
    const q = layoutScramble(items(many), sc(), approxMeasure, 'question');
    expect(q.pages).toHaveLength(2);
    q.pages.forEach((p, i) => expectInsideMargins(p, `p${i}`));
    const all = layoutScramble(items(many), sc(), approxMeasure, 'both');
    expect(all.pages).toHaveLength(4);
    const bold = all.pages[2]!.ops.filter((o) => o.t === 'text' && o.weight === 700 && o.s.length === 1);
    expect(bold).toHaveLength(50 * 6);
  });
});
