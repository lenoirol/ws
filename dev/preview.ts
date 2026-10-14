import { FONT_FAMILY, type Paper } from '../src/layout/page.ts';
import { canvasMeasure } from '../src/layout/measure.ts';
import { DEFAULT_STYLE, layoutWordSearch, type WordSearchLayoutOptions } from '../src/layout/layoutWordSearch.ts';
import { layoutScramble, type ScrambleLayoutOptions } from '../src/layout/layoutScramble.ts';
import { renderSvg } from '../src/render/svg.ts';
import { renderCanvas } from '../src/render/canvas.ts';
import { parseEntries } from '../src/core/text.ts';
import { findWord } from '../src/core/wordsearch/solve.ts';
import { ALL_DIRS, DIR_PRESETS, type Placement } from '../src/core/wordsearch/types.ts';
import type { Page } from '../src/layout/drawops.ts';
import { GRID_A, GRID_B, WORDS_A, WORDS_B, toGrid } from '../tests/fixtures/samples.ts';
import { generateWordSearch } from '../src/core/wordsearch/generate.ts';
import { mulberry32 } from '../src/core/rng.ts';

const SCRAMBLED_C = ['NHAEWLLEO', 'OGERAN', 'LABKC', 'TCA', 'TIHCW', 'OACWKRL', 'SHOTG', 'LINOBG', 'JKAC O TNAENLR', 'KTCIR', 'TREAT', 'MSCETUO', 'DANCY', 'TNSOERM', 'IEMAPRV', 'EFREWOLW', 'MMUMY', 'ABT', 'OURACLND', 'BOORM'];

const letter: Paper = { id: 'Letter', orientation: 'portrait' };
const a4: Paper = { id: 'A4', orientation: 'portrait' };

function placementsFor(words: string[], gridRows: string[], dirs: typeof ALL_DIRS): { grid: string[][]; placements: Placement[] } {
  const grid = toGrid(gridRows);
  const { entries } = parseEntries(words.join('\n'));
  const placements = entries.map((entry, entryIndex) => {
    const occ = findWord(grid, entry.letters, dirs)[0];
    if (!occ) throw new Error(`Not found: ${entry.display}`);
    return { entryIndex, entry, ...occ };
  });
  return { grid, placements };
}

const shots: { name: string; page: Page }[] = [];
function figure(caption: string, inner: string | Page): string {
  if (typeof inner !== 'string') {
    shots.push({ name: caption, page: inner });
    inner = renderSvg(inner);
  }
  return `<figure><figcaption>${caption}</figcaption><div class="sheet">${inner}</div></figure>`;
}

async function main() {
  const measure = canvasMeasure();
  const app = document.getElementById('app') as HTMLElement;
  const section = (title: string, figs: string[]) => (app.insertAdjacentHTML('beforeend', `<h2>${title}</h2><div class="row">${figs.join('')}</div>`));

  const wsOpts = (paper: Paper, over: Partial<WordSearchLayoutOptions> = {}): WordSearchLayoutOptions => ({
    paper, title: 'Halloween', showName: true, nameLabel: 'Name', footer: '', font: FONT_FAMILY, listMode: 'words',
    listColumns: 4, style: DEFAULT_STYLE, answerSuffix: 'Answer', ...over,
  });
  const scOpts = (paper: Paper): ScrambleLayoutOptions => ({ paper, title: 'Halloween', showName: true, nameLabel: 'Name', footer: '', font: FONT_FAMILY, answerSuffix: 'Answer', showClues: false });

  const A = placementsFor(WORDS_A, GRID_A, ALL_DIRS);
  const B = placementsFor(WORDS_B, GRID_B, DIR_PRESETS.easy);
  const entriesA = parseEntries(WORDS_A.join('\n')).entries;
  const scItems = entriesA.map((e, i) => {
    const tokens = (SCRAMBLED_C[i] as string).split(' ').map((t) => Array.from(t));
    const answer = e.display.split(' ').map((w) => Array.from(w.toUpperCase()));
    return { display: e.display, scrambled: { tokens, answer, hints: answer.map((w) => w.map(() => false)), unchanged: false } };
  });

  // Footer matching the sample, only to compare positions; this text is used only on the preview page.
  const sampleFooter = 'Footer test';
  section('A. Hard word search, Letter, compared with the sample PDF', [
    figure('Sample PDF (image)', '<img src="/reference/img/hard.png">'),
    figure('Ours', layoutWordSearch(A, wsOpts(letter, { footer: sampleFooter }), measure, 'question').pages[0] as Page),
  ]);
  section('B. Easy word search, Letter, compared with the sample PDF', [
    figure('Sample PDF (image)', '<img src="/reference/img/easy.png">'),
    figure('Ours', layoutWordSearch(B, wsOpts(letter, { footer: sampleFooter }), measure, 'question').pages[0] as Page),
  ]);
  section('C. Word scramble, Letter, compared with the sample PDF', [
    figure('Sample PDF (image)', '<img src="/reference/img/scramble.png">'),
    figure('Ours', layoutScramble(scItems, scOpts(letter), measure, 'question').pages[0] as Page),
  ]);
  section('A4: question and answer', [
    figure('A (question)', layoutWordSearch(A, wsOpts(a4), measure, 'question').pages[0] as Page),
    figure('A (answer)', layoutWordSearch(A, wsOpts(a4), measure, 'answer').pages[0] as Page),
    figure('B (question)', layoutWordSearch(B, wsOpts(a4), measure, 'question').pages[0] as Page),
    figure('B (answer)', layoutWordSearch(B, wsOpts(a4), measure, 'answer').pages[0] as Page),
    figure('C (question)', layoutScramble(scItems, scOpts(a4), measure, 'question').pages[0] as Page),
    figure('C (answer)', layoutScramble(scItems, scOpts(a4), measure, 'answer').pages[0] as Page),
  ]);

  // Large grids produced by the generator.
  const big = (n: number, count: number) => {
    const rng = mulberry32(n);
    const words = Array.from({ length: count }, () => Array.from({ length: 4 + Math.floor(rng() * 8) }, () => String.fromCharCode(65 + Math.floor(rng() * 26))).join(''));
    const { entries } = parseEntries(words.join('\n'));
    const res = generateWordSearch(entries, { size: { mode: 'manual', rows: n, cols: n }, dirs: ALL_DIRS, allowOverlap: true, fillMode: 'uniform', seed: 1 });
    return { grid: res.grid, placements: res.placements };
  };
  const L32 = layoutWordSearch(big(32, 40), wsOpts(a4, { title: 'Grid 32×32' }), measure, 'question');
  const L64 = layoutWordSearch(big(64, 150), wsOpts(a4, { title: 'Grid 64×64', listColumns: 6 }), measure, 'question');
  const L64a3 = layoutWordSearch(big(64, 60), wsOpts({ id: 'A3', orientation: 'portrait' }, { title: '64×64 on A3' }), measure, 'question');
  section('Large grids (A4/A3)', [
    figure(`32×32 ${JSON.stringify(L32.warnings)}`, L32.pages[0] as Page),
    figure(`64×64 ${JSON.stringify(L64.warnings)}`, L64.pages[0] as Page),
    figure(`64×64 A3 ${JSON.stringify(L64a3.warnings)}`, L64a3.pages[0] as Page),
  ]);
  document.title = 'ready';
}
main();

/** Draws each page on a canvas (the same path as later PNG/PDF export) and sends it to the dev server to save. */
async function saveAll() {
  for (const [i, { name, page }] of shots.entries()) {
    const canvas = document.createElement('canvas');
    renderCanvas(page, 150, canvas);
    const data = canvas.toDataURL('image/png').split(',')[1] as string;
    await fetch(`/__save?name=${String(i).padStart(2, '0')}_${name.normalize('NFD').replace(/[^\w]+/g, '_').slice(0, 30)}`, { method: 'POST', body: data });
  }
  document.title = 'saved';
}
(window as unknown as { saveAll: () => Promise<void> }).saveAll = saveAll;
