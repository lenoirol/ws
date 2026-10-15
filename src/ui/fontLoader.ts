import { fontInfo } from '../layout/fonts.ts';
import type { Page } from '../layout/drawops.ts';

/** Which weights of which typeface carry which characters, gathered from the text on the pages. */
function usage(pages: readonly Page[]): Map<string, string> {
  const m = new Map<string, Set<string>>();
  for (const p of pages) {
    for (const op of p.ops) {
      if (op.t !== 'text' || !fontInfo(op.font).bundled) continue;
      const key = `${op.weight} 16px "${op.font}"`;
      let set = m.get(key);
      if (!set) m.set(key, (set = new Set()));
      for (const ch of op.s) set.add(ch);
    }
  }
  return new Map([...m].map(([k, v]) => [k, [...v].join('')]));
}

/** True when every bundled typeface the pages use already has the glyph files it needs. */
export function pagesFontsReady(pages: readonly Page[]): boolean {
  if (typeof document === 'undefined' || !document.fonts) return true;
  for (const [font, text] of usage(pages)) if (!document.fonts.check(font, text)) return false;
  return true;
}

/** Fetches the glyph files the pages need, so canvas measuring and PNG export use the real font. */
export async function loadPageFonts(pages: readonly Page[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([...usage(pages)].map(([font, text]) => document.fonts.load(font, text).catch(() => [])));
}
