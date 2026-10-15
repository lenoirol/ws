import { describe, expect, it } from 'vitest';
import { generateCrossword } from '../../src/core/crossword/generate.ts';
import { parseEntries } from '../../src/core/text.ts';
import type { DrawOp, Page } from '../../src/layout/drawops.ts';
import { layoutCrossword, type CrosswordLayoutOptions } from '../../src/layout/layoutCrossword.ts';
import { DEFAULT_FONTS } from '../../src/layout/fonts.ts';
import { DEFAULT_CHROME } from '../../src/layout/page.ts';
import { approxMeasure } from '../../src/layout/measure.ts';

const opts = (over: Partial<CrosswordLayoutOptions> = {}): CrosswordLayoutOptions => ({
  paper: { id: 'A4', orientation: 'portrait' },
  title: 'Animals', showName: true, nameLabel: 'Name', footer: '', ...DEFAULT_CHROME, listAlign: 'left', fonts: DEFAULT_FONTS,
  showLength: true, wordBank: false, answerSuffix: 'Answer',
  labels: { across: 'Across', down: 'Down', bank: 'Word Bank' },
  ...over,
});

const texts = (p: Page) => p.ops.filter((o): o is Extract<DrawOp, { t: 'text' }> => o.t === 'text').map((o) => o.s);
const input = parseEntries('planet | A world that circles a star\nplant | Grows in soil\nlate | Not on time\ntap | Water comes out\nplan | An idea of what to do\nnet | Used for catching').entries;

function inside(p: Page) {
  const eps = 0.01;
  for (const o of p.ops) {
    const pts: [number, number][] =
      o.t === 'text' ? [[o.x, o.y]] :
      o.t === 'line' ? [[o.x1, o.y1], [o.x2, o.y2]] :
      o.t === 'rect' ? [[o.x, o.y], [o.x + o.w, o.y + o.h]] : [];
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(-eps);
      expect(y).toBeGreaterThanOrEqual(-eps);
      expect(x).toBeLessThanOrEqual(p.widthMm + eps);
      expect(y).toBeLessThanOrEqual(p.heightMm + eps);
    }
  }
}

describe('crossword layout', () => {
  const cw = generateCrossword(input, { seed: 4 });

  it('makes a question page and an answer page for scope "both"', () => {
    const r = layoutCrossword(cw, opts(), approxMeasure, 'both');
    expect(r.pages).toHaveLength(2);
    expect(layoutCrossword(cw, opts(), approxMeasure, 'question').pages).toHaveLength(1);
  });

  it('draws one cell per letter, with clue numbers and both clue lists', () => {
    const result = layoutCrossword(cw, opts(), approxMeasure, 'question');
    expect(result.pages).toHaveLength(1);
    const page = result.pages[0] as Page;
    const cells = page.ops.filter((o) => o.t === 'rect').length;
    expect(cells).toBe(cw.grid.flat().filter(Boolean).length);
    const t = texts(page);
    expect(t).toContain('Across');
    expect(t).toContain('Down');
    expect(t.some((s) => s.startsWith('A world that circles a star'))).toBe(true);
    for (let n = 1; n <= Math.max(...cw.placements.map((p) => p.number)); n++) expect(t).toContain(String(n));
  });

  it('puts the Across list on the left and the Down list on the right, level with each other', () => {
    const page = layoutCrossword(cw, opts(), approxMeasure, 'question').pages[0] as Page;
    const head = (label: string) => page.ops.find((o) => o.t === 'text' && o.s === label) as Extract<DrawOp, { t: 'text' }>;
    expect(head('Across').x).toBeLessThan(head('Down').x);
    expect(head('Across').y).toBeCloseTo(head('Down').y, 5);
    // No clue sits above its list's heading.
    const down = cw.placements.filter((p) => p.dir === 'down').map((p) => p.entry.clue as string);
    for (const c of down) {
      const op = page.ops.find((o) => o.t === 'text' && o.s.startsWith(c)) as Extract<DrawOp, { t: 'text' }>;
      expect(op.x).toBeGreaterThan(head('Across').x);
      expect(op.y).toBeGreaterThan(head('Down').y);
    }
  });

  it('repeats the list heading where a three-column page starts a column mid-list', () => {
    const many = parseEntries(Array.from({ length: 40 }, (_, i) => `word${'abcdefghijklmnop'.slice(0, 3 + (i % 11))}${i} | A fairly long clue number ${i} that needs to wrap onto more than one line`).join('\n')).entries;
    const r = layoutCrossword(generateCrossword(many, { seed: 6 }), opts({ paper: { id: 'A4', orientation: 'landscape' } }), approxMeasure, 'question');
    const cluePage = r.pages[r.pages.length - 1] as Page;
    const headings = cluePage.ops.filter((o) => o.t === 'text' && (o.s === 'Across' || o.s === 'Down'));
    expect(headings.length).toBeGreaterThanOrEqual(2);
    inside(cluePage);
  });

  it('shows the letters only on the answer page', () => {
    const [q, a] = layoutCrossword(cw, opts(), approxMeasure, 'both').pages as [Page, Page];
    const bold = (p: Page) => p.ops.filter((o) => o.t === 'text' && o.weight === 700 && o.s.length === 1 && /[A-Z]/.test(o.s)).length;
    expect(bold(q)).toBe(0);
    expect(bold(a)).toBe(cw.grid.flat().filter(Boolean).length);
    expect(texts(a)).toContain('Animals – Answer');
  });

  it('adds letter counts when asked and leaves them out otherwise', () => {
    const on = texts(layoutCrossword(cw, opts({ showLength: true }), approxMeasure, 'question').pages[0] as Page).join('|');
    const off = texts(layoutCrossword(cw, opts({ showLength: false }), approxMeasure, 'question').pages[0] as Page).join('|');
    expect(on).toMatch(/Grows in soil \(5\)/);
    expect(off).toMatch(/Grows in soil(?! \()/);
  });

  it('prints a word bank by choice, and always when no clue was typed', () => {
    const plain = (opt: CrosswordLayoutOptions, e = input) => texts(layoutCrossword(generateCrossword(e, { seed: 4 }), opt, approxMeasure, 'question').pages[0] as Page);
    expect(plain(opts({ wordBank: false }))).not.toContain('Word Bank');
    expect(plain(opts({ wordBank: true }))).toContain('Word Bank');
    const noClues = parseEntries('planet\nplant\nlate\ntap').entries;
    const t = plain(opts({ wordBank: false }), noClues);
    expect(t).toContain('Word Bank');
    expect(t.join(' ')).toMatch(/late\s+planet\s+plant\s+tap/i);
  });

  it('keeps everything on the page, for all paper sizes and 50 words', () => {
    const many = parseEntries(Array.from({ length: 50 }, (_, i) => `${['alpha', 'bravo', 'delta', 'echo', 'tango', 'lima', 'oscar', 'romeo'][i % 8]}${'abcdefghij'.slice(0, i % 7)}x${i} | A fairly long clue number ${i} that needs to wrap onto more than one line`).join('\n')).entries;
    const big = generateCrossword(many, { seed: 9 });
    for (const id of ['A4', 'Letter', 'A3'] as const) for (const orientation of ['portrait', 'landscape'] as const) {
      const r = layoutCrossword(big, opts({ paper: { id, orientation }, wordBank: true }), approxMeasure, 'both');
      expect(r.pages.length).toBeGreaterThanOrEqual(2);
      for (const p of r.pages) inside(p);
    }
  });

  it('puts the clues on a second page when one page would squeeze the grid', () => {
    const many = parseEntries(Array.from({ length: 40 }, (_, i) => `word${'abcdefghijklmnop'.slice(0, 3 + (i % 11))}${i} | A fairly long clue number ${i} that needs to wrap onto more than one line`).join('\n')).entries;
    const big = generateCrossword(many, { seed: 6 });
    const r = layoutCrossword(big, opts(), approxMeasure, 'question');
    expect(r.pages).toHaveLength(2);
    const [grid, clues] = r.pages as [Page, Page];
    expect(grid.ops.filter((o) => o.t === 'rect').length).toBe(big.grid.flat().filter(Boolean).length);
    expect(clues.ops.filter((o) => o.t === 'rect')).toHaveLength(0);
    expect(texts(clues)).toContain('Across');
    expect(texts(grid)).not.toContain('Across');
  });

  it('warns when the grid cannot be drawn at a readable size', () => {
    // A 40 x 40 grid is 4.6 mm per cell on A4, which is too small to read.
    const n = 40;
    const grid = Array.from({ length: n }, () => Array.from({ length: n }, () => ''));
    const numbers = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    for (let c = 0; c < n; c++) (grid[0] as string[])[c] = 'A';
    (numbers[0] as number[])[0] = 1;
    const entry = { display: 'A'.repeat(n), letters: Array.from('A'.repeat(n)), clue: 'Forty letters' };
    const huge = { rows: n, cols: n, grid, numbers, placements: [{ entryIndex: 0, entry, row: 0, col: 0, dir: 'across' as const, number: 1 }], failed: [], seed: 1 };
    const r = layoutCrossword(huge, opts(), approxMeasure, 'question');
    expect(r.warnings.some((w) => w.kind === 'crosswordCramped')).toBe(true);
    for (const p of r.pages) inside(p);
  });

  it('returns an empty page, not an error, for an empty crossword', () => {
    const empty = generateCrossword([], { seed: 1 });
    const r = layoutCrossword(empty, opts(), approxMeasure, 'question');
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0]?.ops.some((o) => o.t === 'rect')).toBe(false);
  });
});
