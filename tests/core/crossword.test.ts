import { describe, expect, it } from 'vitest';
import { generateCrossword, type CrosswordResult } from '../../src/core/crossword/generate.ts';
import { mulberry32, randInt } from '../../src/core/rng.ts';
import { parseEntries, toLetters, type Entry } from '../../src/core/text.ts';
import { WORDS_A, WORDS_B } from '../fixtures/samples.ts';

const entry = (w: string, clue?: string): Entry => ({ display: w, letters: toLetters(w), ...(clue ? { clue } : {}) });

/** Reads every run of 2 or more letters in the grid; each must be one of the placed words. */
function runs(r: CrosswordResult): { across: Set<string>; down: Set<string> } {
  const across = new Set<string>();
  const down = new Set<string>();
  for (let i = 0; i < r.rows; i++) {
    let s = '';
    for (let j = 0; j <= r.cols; j++) {
      const ch = j < r.cols ? (r.grid[i]![j] as string) : '';
      if (ch) s += ch;
      else { if (s.length >= 2) across.add(`${i},${j - s.length}:${s}`); s = ''; }
    }
  }
  for (let j = 0; j < r.cols; j++) {
    let s = '';
    for (let i = 0; i <= r.rows; i++) {
      const ch = i < r.rows ? (r.grid[i]![j] as string) : '';
      if (ch) s += ch;
      else { if (s.length >= 2) down.add(`${i - s.length},${j}:${s}`); s = ''; }
    }
  }
  return { across, down };
}

function check(r: CrosswordResult) {
  const found = runs(r);
  // Every placement is readable where it says it is, and nothing else spells a word.
  const expectedAcross = new Set<string>();
  const expectedDown = new Set<string>();
  for (const p of r.placements) {
    const word = p.entry.letters.join('');
    (p.dir === 'across' ? expectedAcross : expectedDown).add(`${p.row},${p.col}:${word}`);
    for (let k = 0; k < word.length; k++) {
      const rr = p.row + (p.dir === 'down' ? k : 0);
      const cc = p.col + (p.dir === 'across' ? k : 0);
      expect(r.grid[rr]![cc]).toBe(word[k]);
    }
  }
  expect([...found.across].sort()).toEqual([...expectedAcross].sort());
  expect([...found.down].sort()).toEqual([...expectedDown].sort());
}

describe('crossword generation', () => {
  it('places a typical word list with every word readable and no accidental words', () => {
    const { entries } = parseEntries(WORDS_A.join('\n'));
    const r = generateCrossword(entries, { seed: 7 });
    check(r);
    expect(r.placements.length + r.failed.length).toBe(entries.length);
    expect(r.placements.length).toBeGreaterThanOrEqual(Math.ceil(entries.length * 0.7));
  });

  it('is repeatable for a seed and varies between seeds', () => {
    const { entries } = parseEntries(WORDS_B.join('\n'));
    const a = generateCrossword(entries, { seed: 42 });
    const b = generateCrossword(entries, { seed: 42 });
    expect(b).toEqual(a);
    const c = generateCrossword(entries, { seed: 43 });
    expect(JSON.stringify(c.grid)).not.toBe(JSON.stringify(a.grid));
  });

  it('every word after the first crosses another', () => {
    const { entries } = parseEntries(WORDS_A.join('\n'));
    const r = generateCrossword(entries, { seed: 3 });
    for (const p of r.placements.slice(1)) {
      const len = p.entry.letters.length;
      let crosses = 0;
      for (let k = 0; k < len; k++) {
        const rr = p.row + (p.dir === 'down' ? k : 0);
        const cc = p.col + (p.dir === 'across' ? k : 0);
        const other = r.placements.some((q) => q !== p && q.dir !== p.dir && (q.dir === 'across'
          ? q.row === rr && cc >= q.col && cc < q.col + q.entry.letters.length
          : q.col === cc && rr >= q.row && rr < q.row + q.entry.letters.length));
        if (other) crosses++;
      }
      expect(crosses).toBeGreaterThanOrEqual(1);
    }
  });

  it('numbers start cells in reading order and shares a number between across and down', () => {
    const r = generateCrossword([entry('PLANET'), entry('PLANT'), entry('LATE'), entry('TAP')], { seed: 1 });
    let last = 0;
    for (let i = 0; i < r.rows; i++) for (let j = 0; j < r.cols; j++) {
      const n = r.numbers[i]![j] as number;
      if (n) { expect(n).toBe(last + 1); last = n; }
    }
    for (const p of r.placements) expect(r.numbers[p.row]![p.col]).toBe(p.number);
    expect(r.placements.map((p) => p.number)).toEqual([...r.placements.map((p) => p.number)].sort((a, b) => a - b));
  });

  it('reports words that share no letter with the rest instead of dropping them silently', () => {
    const r = generateCrossword([entry('ABC'), entry('CAB'), entry('QQQ')], { seed: 1 });
    expect(r.failed.map((e) => e.display)).toEqual(['QQQ']);
    check(r);
  });

  it('handles one word, no words, and words that are too short', () => {
    const one = generateCrossword([entry('HELLO')], { seed: 1 });
    expect(one.placements).toHaveLength(1);
    expect([one.rows, one.cols]).toEqual([1, 5]);
    expect(generateCrossword([], { seed: 1 }).placements).toEqual([]);
    expect(generateCrossword([entry('A')], { seed: 1 }).placements).toEqual([]);
  });

  it('keeps invariants for 100 random word sets', () => {
    const rng = mulberry32(2024);
    const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let k = 0; k < 100; k++) {
      const count = 3 + randInt(rng, 18);
      const seen = new Set<string>();
      const entries: Entry[] = [];
      while (entries.length < count) {
        const len = 2 + randInt(rng, 9);
        const w = Array.from({ length: len }, () => AZ[randInt(rng, 12)] as string).join(''); // small alphabet => many crossings
        if (!seen.has(w)) { seen.add(w); entries.push(entry(w)); }
      }
      const r = generateCrossword(entries, { seed: k, attempts: 12 });
      check(r);
      expect(r.placements.length + r.failed.length).toBe(entries.length);
    }
  });
});
