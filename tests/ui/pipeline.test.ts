import { describe, expect, it } from 'vitest';
import { generateCrossword } from '../../src/core/crossword/generate.ts';
import { parseEntries } from '../../src/core/text.ts';
import { generateWordSearch } from '../../src/core/wordsearch/generate.ts';
import { approxMeasure } from '../../src/layout/measure.ts';
import { generateOptions, layoutFor, scrambleItemsFor, type Built } from '../../src/ui/pipeline.ts';
import { COMBOS, initialState, kindsOf, type AppState } from '../../src/ui/state.ts';

const { entries } = parseEntries('planet | World\nplant | Grows\nlate | Not early\ntap | Faucet\nplan | Idea\nnet | Catcher');

function built(s: AppState): Built {
  const kinds = kindsOf(s);
  return {
    ws: kinds.includes('ws') ? generateWordSearch(entries, { ...generateOptions(s, 5) } as never) : null,
    items: kinds.includes('scramble') ? scrambleItemsFor(entries, s, 5) : [],
    cw: kinds.includes('crossword') ? generateCrossword(entries, { seed: 5 }) : null,
  };
}
const state = (over: Partial<AppState>): AppState => ({ ...initialState(), seed: 5, ...over });

describe('which kinds a mode makes', () => {
  it('is one kind for a single tab and the chosen pair for combine', () => {
    expect(kindsOf(state({ tab: 'crossword' }))).toEqual(['crossword']);
    for (const [id, pair] of Object.entries(COMBOS)) expect(kindsOf(state({ tab: 'combo', combo: id as AppState['combo'] }))).toEqual([...pair]);
  });
});

describe('layoutFor', () => {
  it('single modes give a question page and, for "both", an answer page', () => {
    for (const tab of ['ws', 'scramble', 'crossword'] as const) {
      const s = state({ tab, scope: 'both' });
      const r = layoutFor(s, built(s), approxMeasure);
      expect(r.pages).toHaveLength(2);
      expect(r.pages.every((p) => p.label === undefined)).toBe(true);
    }
  });

  it('combines two kinds with every question page before every answer page, and labels each', () => {
    const s = state({ tab: 'combo', combo: 'ws+crossword', scope: 'both' });
    const r = layoutFor(s, built(s), approxMeasure);
    expect(r.pages.map((p) => p.label)).toEqual(['Word Search', 'Crossword', 'Word Search', 'Crossword']);
  });

  it('follows the pair order for the other combinations', () => {
    const s = state({ tab: 'combo', combo: 'crossword+scramble', scope: 'question' });
    expect(layoutFor(s, built(s), approxMeasure).pages.map((p) => p.label)).toEqual(['Crossword', 'Word Scramble']);
  });

  it('honours the answer-only scope in a combination', () => {
    const s = state({ tab: 'combo', combo: 'ws+scramble', scope: 'answer' });
    expect(layoutFor(s, built(s), approxMeasure).pages).toHaveLength(2);
  });

  it('shows nothing until every kind in a combination has its material', () => {
    const s = state({ tab: 'combo', combo: 'ws+crossword', scope: 'question' });
    const partial = { ...built(s), ws: null };
    expect(layoutFor(s, partial, approxMeasure).pages).toEqual([]);
  });

  it('every page in a combination keeps the shared title and name line', () => {
    const s = state({ tab: 'combo', combo: 'ws+scramble', scope: 'question', title: 'Unit 3', showName: true });
    const r = layoutFor(s, built(s), approxMeasure);
    for (const p of r.pages) {
      expect(p.ops.some((o) => o.t === 'text' && o.s === 'Unit 3')).toBe(true);
      expect(p.ops.some((o) => o.t === 'text' && o.s === 'Name')).toBe(true);
    }
  });
});
