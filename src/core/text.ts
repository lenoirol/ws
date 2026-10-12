import { MAX_GRID, MAX_WORDS } from './constants.ts';

/** One user-entered item: `display` keeps the original text, `letters` is used for the grid. */
export interface Entry {
  display: string;
  letters: string[];
  clue?: string;
}

export type Issue =
  | { kind: 'duplicates'; count: number }
  | { kind: 'overLimit'; count: number }
  | { kind: 'tooShort'; word: string }
  | { kind: 'tooLong'; word: string }
  | { kind: 'unplaced'; words: string[] }
  | { kind: 'unplacedCw'; words: string[] }
  | { kind: 'unchanged'; words: string[] };

const COMBINING_MARKS = /\p{M}/gu;

/** Letters used in the grid: accents are stripped and only A–Z are kept, upper-cased. */
export function toLetters(text: string): string[] {
  const s = text.normalize('NFD').replace(COMBINING_MARKS, '').toUpperCase();
  return Array.from(s).filter((ch) => ch >= 'A' && ch <= 'Z');
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Parses the multi-line input. Each line is `answer` or `answer <Tab or |> clue`.
 * Skips blank lines and case-insensitive duplicates.
 */
export function parseEntries(text: string): { entries: Entry[]; issues: Issue[] } {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const sep = rawLine.search(/[\t|]/);
    const answer = collapse(sep < 0 ? rawLine : rawLine.slice(0, sep));
    if (!answer) continue;
    const clue = sep < 0 ? '' : collapse(rawLine.slice(sep + 1).replace(/[\t|]/g, ' '));
    const key = answer.normalize('NFC').toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const entry: Entry = { display: answer, letters: toLetters(answer) };
    if (clue) entry.clue = clue;
    entries.push(entry);
  }
  const issues: Issue[] = duplicates > 0 ? [{ kind: 'duplicates', count: duplicates }] : [];
  if (entries.length > MAX_WORDS) {
    issues.push({ kind: 'overLimit', count: entries.length - MAX_WORDS });
    entries.length = MAX_WORDS;
  }
  return { entries, issues };
}

/**
 * Drops entries unusable for the grid: fewer than 2 letters, or longer than both grid sides.
 * Blank `rows`/`cols` means auto mode (limited by MAX_GRID).
 */
export function filterForGrid(
  entries: readonly Entry[],
  rows: number = MAX_GRID,
  cols: number = MAX_GRID,
): { usable: Entry[]; issues: Issue[] } {
  const usable: Entry[] = [];
  const issues: Issue[] = [];
  for (const e of entries) {
    if (e.letters.length < 2) issues.push({ kind: 'tooShort', word: e.display });
    else if (e.letters.length > Math.max(rows, cols)) issues.push({ kind: 'tooLong', word: e.display });
    else usable.push(e);
  }
  return { usable, issues };
}

const AZ = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ');

/** Alphabet used to fill the empty cells. */
export function fillAlphabet(): string[] {
  return AZ.slice();
}
