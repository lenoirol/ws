/** The typefaces a worksheet can use. `id` is the CSS family name stored in the project and in draw ops. */
export interface FontInfo {
  id: string;
  /** Fallback after the family, so a missing font still looks like its kind. */
  generic: 'sans-serif' | 'serif' | 'monospace' | 'cursive';
  /** Half the cap height as a share of the font size; centers capitals in a grid cell. */
  capHalf: number;
  /** Fonts the page bundles; the default Helvetica comes from the system. */
  bundled: boolean;
}

export const DEFAULT_FONT = 'Helvetica';

export const FONTS: readonly FontInfo[] = [
  { id: 'Helvetica', generic: 'sans-serif', capHalf: 0.355, bundled: false },
  { id: 'Bricolage Grotesque', generic: 'sans-serif', capHalf: 0.33, bundled: true },
  { id: 'Be Vietnam Pro', generic: 'sans-serif', capHalf: 0.37, bundled: true },
  { id: 'JetBrains Mono', generic: 'monospace', capHalf: 0.365, bundled: true },
  { id: 'Nunito', generic: 'sans-serif', capHalf: 0.356, bundled: true },
  { id: 'Quicksand', generic: 'sans-serif', capHalf: 0.35, bundled: true },
  { id: 'Lexend', generic: 'sans-serif', capHalf: 0.35, bundled: true },
  { id: 'Baloo 2', generic: 'sans-serif', capHalf: 0.307, bundled: true },
  { id: 'Patrick Hand', generic: 'cursive', capHalf: 0.331, bundled: true },
  { id: 'Merriweather', generic: 'serif', capHalf: 0.372, bundled: true },
  { id: 'Playfair Display', generic: 'serif', capHalf: 0.354, bundled: true },
];

const BY_ID = new Map(FONTS.map((f) => [f.id, f]));

export const isFontId = (v: unknown): v is string => typeof v === 'string' && BY_ID.has(v);
export const fontInfo = (id: string): FontInfo => BY_ID.get(id) ?? (BY_ID.get(DEFAULT_FONT) as FontInfo);

/** The parts of a worksheet that each take their own typeface. */
export const FONT_ROLES = ['title', 'name', 'puzzle', 'list', 'footer'] as const;
export type FontRole = (typeof FONT_ROLES)[number];
export type PuzzleFonts = Readonly<Record<FontRole, string>>;

export type TextCase = 'none' | 'upper' | 'lower';
export type Align = 'left' | 'center' | 'right';
export type PuzzleCases = Readonly<Record<FontRole, TextCase>>;
export const DEFAULT_CASES: PuzzleCases = { title: 'none', name: 'none', puzzle: 'none', list: 'none', footer: 'none' };

export const applyCase = (s: string, c: TextCase): string => (c === 'upper' ? s.toLocaleUpperCase() : c === 'lower' ? s.toLocaleLowerCase() : s);

export const uniformFonts = (id: string): PuzzleFonts => ({ title: id, name: id, puzzle: id, list: id, footer: id });
export const DEFAULT_FONTS: PuzzleFonts = uniformFonts(DEFAULT_FONT);

/** CSS font stack: the chosen family, then metric-close system fonts. */
export function fontStack(id: string): string {
  const f = fontInfo(id);
  if (f.id === DEFAULT_FONT) return `"Helvetica", "Helvetica Neue", Arial, "Liberation Sans", sans-serif`;
  return `"${f.id}", "Helvetica Neue", Arial, "Liberation Sans", ${f.generic}`;
}
