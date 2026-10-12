import { useEffect, useMemo, useRef, useState } from 'react';
import { generateCrossword } from '../core/crossword/generate.ts';
import { parseEntries, type Entry, type Issue } from '../core/text.ts';
import type { WordSearchResult } from '../core/wordsearch/types.ts';
import type { LayoutWarning, Page } from '../layout/drawops.ts';
import { canvasMeasure, type Measure } from '../layout/measure.ts';
import { GeneratorClient, type Progress } from './generatorClient.ts';
import { generateOptions, layoutFor, scrambleItemsFor } from './pipeline.ts';
import { kindsOf, type AppState } from './state.ts';

const DEBOUNCE_MS = 200;

export interface PuzzleView {
  pages: Page[];
  issues: Issue[];
  warnings: LayoutWarning[];
  unchanged: string[];
  hasClues: boolean;
  entries: Entry[];
  measure: Measure;
  wordCount: number;
  busy: boolean;
  progress: Progress | null;
  error: string | null;
}

export function usePuzzle(s: AppState): PuzzleView {
  const measure = useMemo<Measure>(() => canvasMeasure(), []);
  const parsed = useMemo(() => parseEntries(s.text), [s.text]);

  const kinds = kindsOf(s);
  const needsWs = kinds.includes('ws');
  const needsScr = kinds.includes('scramble');
  const needsCw = kinds.includes('crossword');

  const client = useRef<GeneratorClient | null>(null);
  const [ws, setWs] = useState<WordSearchResult | null>(null);
  const [busy, setBusyState] = useState(false);
  // Setting state to the value it already has still counts as an update scheduled from an effect, and
  // typing fires this effect on every key: after 50 keys in a row React warns about an update loop.
  const busyRef = useRef(false);
  const setBusy = (v: boolean) => {
    if (busyRef.current === v) return;
    busyRef.current = v;
    setBusyState(v);
  };
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsKey = JSON.stringify([s.sizeMode, s.rows, s.cols, s.dirs, s.allowOverlap, s.fillMode, s.seed]);
  useEffect(() => {
    if (!needsWs) {
      // Left Word Search while a grid was still being made: stop the worker and drop the busy state.
      client.current?.cancel();
      setBusy(false);
      return;
    }
    client.current ??= new GeneratorClient();
    const c = client.current;
    if (parsed.entries.length === 0) {
      c.cancel();
      if (ws !== null) setWs(null);
      setBusy(false);
      return;
    }
    let live = true;
    setBusy(true);
    const timer = setTimeout(() => {
      c.run(
        parsed.entries,
        generateOptions(s, s.seed),
        (p) => live && setProgress(p),
      ).then(
        (r) => {
          if (!live) return;
          setWs(r);
          setBusy(false);
          setProgress(null);
          setError(null);
        },
        (e: Error) => {
          if (!live) return;
          setError(e.message);
          setBusy(false);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      c.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsWs, parsed.entries, wsKey]);

  const scrambleItems = useMemo(() => scrambleItemsFor(parsed.entries, s, s.seed), [parsed.entries, s.seed, s.firstLetter, s.hintKind, s.hintCount]);

  // Crossword building is quick and seeded, so it runs in step with the typing rather than in the worker.
  const cw = useMemo(() => (needsCw ? generateCrossword(parsed.entries, { seed: s.seed }) : null), [needsCw, parsed.entries, s.seed]);

  const layoutKey = JSON.stringify([s.tab, s.combo, s.title, s.showName, s.nameLabel, s.footer, s.paper, s.scope, s.listMode, s.listColumns, s.scrambleClues, s.frame, s.cellLines, s.boldLetters, s.cwShowLength, s.cwWordBank]);
  const laid = useMemo(() => {
    const built = {
      ws: needsWs && parsed.entries.length ? ws : null,
      items: needsScr ? scrambleItems : [],
      cw: needsCw && parsed.entries.length ? cw : null,
    };
    return layoutFor(s, built, measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, needsWs, needsScr, needsCw, ws, scrambleItems, cw, parsed.entries.length, layoutKey]);

  const issues: Issue[] = [...parsed.issues];
  if (needsWs && ws) {
    issues.push(...ws.issues);
    if (ws.failed.length) issues.push({ kind: 'unplaced', words: ws.failed.map((e) => e.display) });
  }
  if (needsCw && cw && cw.failed.length) issues.push({ kind: 'unplacedCw', words: cw.failed.map((e) => e.display) });
  const unchanged = needsScr ? scrambleItems.filter((i) => i.scrambled.unchanged).map((i) => i.display) : [];

  return {
    pages: laid.pages,
    issues,
    warnings: laid.warnings,
    unchanged,
    hasClues: parsed.entries.some((e) => e.clue),
    entries: parsed.entries,
    measure,
    wordCount: parsed.entries.length,
    busy,
    progress,
    error,
  };
}
