import { FONT_ROLES, isFontId } from '../layout/fonts.ts';
import type { AppState } from '../ui/state.ts';

/** Everything that defines a worksheet. Appearance (theme, glass, zoom) is a viewer preference and stays out. */
const KEYS = [
  'tab', 'combo', 'text', 'seed', 'title', 'showName', 'nameLabel', 'footer', 'fonts', 'cases', 'titleAlign', 'titleScale', 'listAlign', 'paper', 'scope', 'dpi',
  'sizeMode', 'rows', 'cols', 'square', 'dirs', 'allowOverlap', 'fillMode', 'listMode', 'listColumns',
  'frame', 'cellLines', 'boldLetters', 'cwShowLength', 'cwWordBank', 'firstLetter', 'hintKind', 'hintCount', 'scrambleClues', 'copies',
] as const satisfies readonly (keyof AppState)[];

export type SavedState = Pick<AppState, (typeof KEYS)[number]>;

export function toSaved(s: AppState): SavedState {
  const out: Partial<Record<keyof AppState, unknown>> = {};
  for (const k of KEYS) out[k] = s[k];
  return out as SavedState;
}

/**
 * Applies a stored project over `base`. Unknown keys are ignored and a value whose type does not
 * match the current setting is skipped, so an older or damaged project still opens.
 */
export function fromSaved(raw: unknown, base: AppState): AppState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return base;
  const src = raw as Record<string, unknown>;
  const next: Record<string, unknown> = { ...base };
  for (const k of KEYS) {
    const value = src[k];
    const current = base[k];
    if (value === undefined) continue;
    if (k === 'cases') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
      const v = value as Record<string, unknown>;
      next.cases = Object.fromEntries(FONT_ROLES.map((r) => [r, v[r] === 'upper' || v[r] === 'lower' || v[r] === 'none' ? v[r] : base.cases[r]]));
      continue;
    }
    if ((k === 'titleAlign' || k === 'listAlign') && !(value === 'left' || value === 'center' || value === 'right')) continue;
    if (k === 'titleScale' && !(typeof value === 'number' && value >= 40 && value <= 300)) continue;
    if (k === 'fonts') {
      // Keep the typefaces that still exist; a removed font falls back to the current choice for that part.
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
      const v = value as Record<string, unknown>;
      next.fonts = Object.fromEntries(FONT_ROLES.map((r) => [r, isFontId(v[r]) ? v[r] : base.fonts[r]]));
      continue;
    }
    if (Array.isArray(current) ? Array.isArray(value) : typeof value === typeof current && value !== null) next[k] = value;
  }
  return next as unknown as AppState;
}
