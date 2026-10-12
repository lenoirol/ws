import { randomSeed } from '../core/rng.ts';
import { ALL_DIRS, DIR_PRESETS, type Dir } from '../core/wordsearch/types.ts';
import type { ListMode, Scope } from '../layout/layoutWordSearch.ts';
import type { Paper } from '../layout/page.ts';
import type { FirstLetterMode } from '../core/scramble/scramble.ts';

export type Tab = 'ws' | 'scramble';
export type Theme = 'system' | 'light' | 'dark';
export type GlassStyle = 'regular' | 'clear';
export type HintKind = 'none' | 'first' | 'firstLast' | 'random';

/** All state lives in memory; nothing is written to the browser. */
export interface AppState {
  theme: Theme;
  glassStyle: GlassStyle;
  zoom: number;
  tab: Tab;
  text: string;
  seed: number;
  title: string;
  showName: boolean;
  nameLabel: string;
  footer: string;
  paper: Paper;
  scope: Scope;
  dpi: 150 | 300 | 600;
  // Word Search
  sizeMode: 'auto' | 'manual';
  rows: number;
  cols: number;
  square: boolean;
  dirs: Dir[];
  allowOverlap: boolean;
  fillMode: 'uniform' | 'fromWords';
  listMode: ListMode;
  listColumns: 'auto' | 1 | 2 | 3 | 4 | 5 | 6;
  frame: boolean;
  cellLines: boolean;
  boldLetters: boolean;
  // Word Scramble
  firstLetter: FirstLetterMode;
  hintKind: HintKind;
  hintCount: number;
  scrambleClues: boolean;
  /** Number of different copies to export (one seed each). */
  copies: number;
}

export const initialState = (): AppState => ({
  theme: 'system',
  glassStyle: 'regular',
  zoom: 0,
  tab: 'ws',
  text: '',
  seed: randomSeed(),
  title: '',
  showName: true,
  nameLabel: 'Name',
  footer: '',
  paper: { id: 'A4', orientation: 'portrait' },
  scope: 'question',
  dpi: 300,
  sizeMode: 'auto',
  rows: 20,
  cols: 20,
  square: true,
  dirs: [...ALL_DIRS],
  allowOverlap: true,
  fillMode: 'uniform',
  listMode: 'words',
  listColumns: 'auto',
  frame: true,
  cellLines: false,
  boldLetters: false,
  firstLetter: 'free',
  hintKind: 'none',
  hintCount: 2,
  scrambleClues: false,
  copies: 1,
});

export const KIDS_PRESET: Partial<AppState> = {
  dirs: [...DIR_PRESETS.easy],
  sizeMode: 'auto',
  allowOverlap: true,
  boldLetters: true,
};
