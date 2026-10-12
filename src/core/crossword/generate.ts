import { mulberry32, shuffle, type Rng } from '../rng.ts';
import type { Entry } from '../text.ts';

export type CwDir = 'across' | 'down';

export interface CwPlacement {
  entryIndex: number;
  entry: Entry;
  /** Cell of the first letter, numbered from 0 in the trimmed grid. */
  row: number;
  col: number;
  dir: CwDir;
  /** Clue number printed in the first cell. Across and down words that start together share one. */
  number: number;
}

export interface CrosswordResult {
  rows: number;
  cols: number;
  /** One letter per used cell, '' for empty cells. */
  grid: string[][];
  /** Clue number shown in each cell, 0 for none. */
  numbers: number[][];
  /** Ordered by number, across before down. */
  placements: CwPlacement[];
  /** Usable words that could not be crossed into the grid. */
  failed: Entry[];
  seed: number;
}

export interface CrosswordOptions {
  seed: number;
  /** Random restarts. Fixed (not time based) so the same seed always gives the same grid. */
  attempts?: number;
}

const DEFAULT_ATTEMPTS = 60;
const MAX_PASSES = 3;
const MIN_LETTERS = 2;

interface Placed {
  index: number;
  row: number;
  col: number;
  dir: CwDir;
  len: number;
}

interface Layout {
  placed: Placed[];
  failed: number[];
  crossings: number;
  area: number;
}

const key = (r: number, c: number) => `${r},${c}`;

/** A long thin grid prints with tiny cells, so the longer side counts most and the area only breaks ties. */
const compactness = (h: number, w: number) => Math.max(h, w) ** 2 + (h * w) / 1000;

/** Working grid on an unbounded plane; trimmed once it is finished. */
class Board {
  readonly cells = new Map<string, string>();
  /** Which directions already run through a cell. */
  private readonly flow = new Map<string, { across: boolean; down: boolean }>();
  minR = 0;
  maxR = 0;
  minC = 0;
  maxC = 0;
  count = 0;

  /** Number of crossings if `letters` fits at (row, col), or -1 when it does not. */
  fit(letters: readonly string[], row: number, col: number, dir: CwDir): number {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    const n = letters.length;
    if (this.cells.has(key(row - dr, col - dc)) || this.cells.has(key(row + dr * n, col + dc * n))) return -1;
    let crossings = 0;
    for (let i = 0; i < n; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const here = this.cells.get(key(r, c));
      if (here !== undefined) {
        if (here !== letters[i]) return -1;
        if (this.flow.get(key(r, c))?.[dir]) return -1; // would run along an existing word
        crossings++;
      } else if (this.cells.has(key(r + dc, c + dr)) || this.cells.has(key(r - dc, c - dr))) {
        return -1; // a new cell may not touch a neighbouring word sideways
      }
    }
    return crossings;
  }

  put(letters: readonly string[], row: number, col: number, dir: CwDir): void {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    for (let i = 0; i < letters.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const k = key(r, c);
      if (!this.cells.has(k)) this.cells.set(k, letters[i] as string);
      const f = this.flow.get(k) ?? { across: false, down: false };
      f[dir] = true;
      this.flow.set(k, f);
    }
    const endR = row + dr * (letters.length - 1);
    const endC = col + dc * (letters.length - 1);
    if (this.count === 0) {
      this.minR = row; this.maxR = endR; this.minC = col; this.maxC = endC;
    } else {
      this.minR = Math.min(this.minR, row); this.maxR = Math.max(this.maxR, endR);
      this.minC = Math.min(this.minC, col); this.maxC = Math.max(this.maxC, endC);
    }
    this.count++;
  }

  /** Compactness score (lower is better) if a word covering these extremes were added: squarer grids win. */
  areaWith(row: number, col: number, dir: CwDir, n: number): number {
    const endR = row + (dir === 'down' ? n - 1 : 0);
    const endC = col + (dir === 'across' ? n - 1 : 0);
    const h = Math.max(this.maxR, endR) - Math.min(this.minR, row) + 1;
    return compactness(h, Math.max(this.maxC, endC) - Math.min(this.minC, col) + 1);
  }

  flowAt(r: number, c: number) {
    return this.flow.get(key(r, c));
  }
}

function build(words: readonly string[][], order: readonly number[], rng: Rng): { board: Board; layout: Layout } {
  const board = new Board();
  const placed: Placed[] = [];
  let crossings = 0;
  let pending = order.slice();

  for (let pass = 0; pass < MAX_PASSES && pending.length > 0; pass++) {
    const next: number[] = [];
    let progress = false;
    for (const idx of pending) {
      const letters = words[idx] as string[];
      if (board.count === 0) {
        board.put(letters, 0, 0, 'across');
        placed.push({ index: idx, row: 0, col: 0, dir: 'across', len: letters.length });
        progress = true;
        continue;
      }
      let best: { row: number; col: number; dir: CwDir; crossings: number; area: number; tie: number } | null = null;
      for (let i = 0; i < letters.length; i++) {
        for (const [k, ch] of board.cells) {
          if (ch !== letters[i]) continue;
          const [r, c] = k.split(',').map(Number) as [number, number];
          const f = board.flowAt(r, c);
          if (!f) continue;
          // Cross the word that already runs through this cell.
          const dir: CwDir | null = f.across && !f.down ? 'down' : f.down && !f.across ? 'across' : null;
          if (!dir) continue;
          const row = dir === 'down' ? r - i : r;
          const col = dir === 'across' ? c - i : c;
          const x = board.fit(letters, row, col, dir);
          if (x < 1) continue;
          const area = board.areaWith(row, col, dir, letters.length);
          const tie = rng();
          if (!best || x > best.crossings || (x === best.crossings && (area < best.area || (area === best.area && tie < best.tie)))) {
            best = { row, col, dir, crossings: x, area, tie };
          }
        }
      }
      if (best) {
        board.put(letters, best.row, best.col, best.dir);
        placed.push({ index: idx, row: best.row, col: best.col, dir: best.dir, len: letters.length });
        crossings += best.crossings;
        progress = true;
      } else {
        next.push(idx);
      }
    }
    pending = next;
    if (!progress) break;
  }
  const area = board.count === 0 ? 0 : compactness(board.maxR - board.minR + 1, board.maxC - board.minC + 1);
  return { board, layout: { placed, failed: pending, crossings, area } };
}

const better = (a: Layout, b: Layout | null): boolean =>
  !b ||
  a.placed.length > b.placed.length ||
  (a.placed.length === b.placed.length && (a.area < b.area || (a.area === b.area && a.crossings > b.crossings)));

/**
 * Builds a crossword from the entries' letters. Longer words go in first; each later word must cross
 * one already placed. The best of several seeded restarts is kept, so the result is repeatable.
 */
export function generateCrossword(input: readonly Entry[], o: CrosswordOptions): CrosswordResult {
  const usable = input.map((entry, entryIndex) => ({ entry, entryIndex })).filter((x) => x.entry.letters.length >= MIN_LETTERS);
  const empty: CrosswordResult = { rows: 0, cols: 0, grid: [], numbers: [], placements: [], failed: [], seed: o.seed >>> 0 };
  if (usable.length === 0) return empty;

  const words = usable.map((x) => x.entry.letters);
  const rng = mulberry32(o.seed);
  const attempts = Math.max(1, o.attempts ?? DEFAULT_ATTEMPTS);
  const byLength = words.map((_, i) => i).sort((a, b) => (words[b] as string[]).length - (words[a] as string[]).length);

  let best: { board: Board; layout: Layout } | null = null;
  for (let a = 0; a < attempts; a++) {
    // Mostly longest-first, with a random shuffle inside blocks of similar length so restarts differ.
    const order = a === 0 ? byLength : jitter(byLength, words, rng);
    const result = build(words, order, rng);
    if (better(result.layout, best?.layout ?? null)) best = result;
    if (best && best.layout.failed.length === 0 && a >= 8 && a >= attempts / 3) break;
  }
  const { board, layout } = best as { board: Board; layout: Layout };

  const rows = board.maxR - board.minR + 1;
  const cols = board.maxC - board.minC + 1;
  const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
  for (const [k, ch] of board.cells) {
    const [r, c] = k.split(',').map(Number) as [number, number];
    (grid[r - board.minR] as string[])[c - board.minC] = ch;
  }

  // Number the start cells in reading order.
  const starts = new Map<string, { across?: Placed; down?: Placed }>();
  for (const p of layout.placed) {
    const k = key(p.row - board.minR, p.col - board.minC);
    const s = starts.get(k) ?? {};
    s[p.dir] = p;
    starts.set(k, s);
  }
  const numbers: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const numberOf = new Map<string, number>();
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!starts.has(key(r, c))) continue;
      n++;
      (numbers[r] as number[])[c] = n;
      numberOf.set(key(r, c), n);
    }
  }

  const placements: CwPlacement[] = layout.placed.map((p) => {
    const u = usable[p.index] as { entry: Entry; entryIndex: number };
    const row = p.row - board.minR;
    const col = p.col - board.minC;
    return { entryIndex: u.entryIndex, entry: u.entry, row, col, dir: p.dir, number: numberOf.get(key(row, col)) as number };
  });
  placements.sort((a, b) => a.number - b.number || (a.dir === b.dir ? 0 : a.dir === 'across' ? -1 : 1));

  const failed = layout.failed.map((i) => (usable[i] as { entry: Entry }).entry);
  return { rows, cols, grid, numbers, placements, failed, seed: o.seed >>> 0 };
}

/** Longest-first order with words of equal length shuffled, and a chance of a different opening word. */
function jitter(order: readonly number[], words: readonly string[][], rng: Rng): number[] {
  const groups = new Map<number, number[]>();
  for (const i of order) {
    const len = (words[i] as string[]).length;
    const g = groups.get(len);
    if (g) g.push(i);
    else groups.set(len, [i]);
  }
  const lengths = [...groups.keys()].sort((a, b) => b - a);
  const out = lengths.flatMap((len) => shuffle(rng, groups.get(len) as number[]));
  // Now and then start from a mid-length word: a different seed word often packs tighter.
  if (out.length > 3 && rng() < 0.25) {
    const k = 1 + Math.floor(rng() * Math.min(3, out.length - 1));
    const [w] = out.splice(k, 1);
    out.unshift(w as number);
  }
  return out;
}
