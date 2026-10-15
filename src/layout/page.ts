import type { DrawOp, Page } from './drawops.ts';
import { applyCase, DEFAULT_CASES, DEFAULT_FONTS, type Align, type PuzzleCases, type PuzzleFonts } from './fonts.ts';
import type { Measure } from './measure.ts';

export { fontStack } from './fonts.ts';

export const PT_MM = 25.4 / 72;
/** The default typefaces (Helvetica everywhere). */
export const FONT_FAMILY = DEFAULT_FONTS.puzzle;
export const INK = '#000';

export type PaperId = 'A4' | 'Letter' | 'A3';
export type Orientation = 'portrait' | 'landscape';
export interface Paper {
  id: PaperId;
  orientation: Orientation;
}

const PAPER_MM: Record<PaperId, readonly [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
  A3: [297, 420],
};

export function paperSize(p: Paper): { widthMm: number; heightMm: number } {
  const [w, h] = PAPER_MM[p.id];
  return p.orientation === 'portrait' ? { widthMm: w, heightMm: h } : { widthMm: h, heightMm: w };
}

export function emptyPage(p: Paper): Page {
  return { ...paperSize(p), ops: [] };
}

// Measurements derived from the 3 sample PDFs (see reference/NOTES.md).
export const SIDE_MARGIN_MM = 12.7;
export const NAME_PT = 8.04;
export const NAME_BASELINE_MM = 15.5;
export const NAME_TOTAL_WIDTH_MM = 61;
export const TITLE_BASELINE_MM = 27.2;
export const FOOTER_PT = 8.04;
export const FOOTER_BASELINE_FROM_BOTTOM_MM = 13.3;

export interface ChromeOptions {
  title: string;
  showName: boolean;
  nameLabel: string;
  footer: string;
  fonts: PuzzleFonts;
  /** Placement of the title on the page. */
  titleAlign: Align;
  /** Title size relative to the layout's own size (1 = unchanged). */
  titleScale: number;
  /** Placement of the word list and word bank within their columns. */
  listAlign: Align;
  /** Upper / lower case of each part, applied to what is drawn (the typed words stay as they are). */
  cases: PuzzleCases;
}

export const DEFAULT_CHROME = { titleAlign: 'center', titleScale: 1, listAlign: 'center', cases: DEFAULT_CASES } as const satisfies Partial<ChromeOptions>;

export const ANCHOR: Record<Align, 'start' | 'middle' | 'end'> = { left: 'start', center: 'middle', right: 'end' };
/** x of a text anchored by `align` inside [x0, x1]. */
export const alignX = (align: Align, x0: number, x1: number): number => (align === 'left' ? x0 : align === 'right' ? x1 : (x0 + x1) / 2);

type TextOp = Extract<DrawOp, { t: 'text' }>;

function text(x: number, y: number, s: string, size: number, weight: 400 | 700, anchor: 'start' | 'middle' | 'end', font: string): TextOp {
  return { t: 'text', x, y, s, size, weight, anchor, font, color: INK };
}

/** Name line, title and footer. Returns the bottom edge of the page header (mm from top). */
export function chromeOps(page: Page, o: ChromeOptions, titlePt: number, measure: Measure): { headerBottom: number; titleOp: TextOp | null } {
  const { widthMm: W, heightMm: H } = page;
  let headerBottom = SIDE_MARGIN_MM;
  let titleOp: TextOp | null = null;

  if (o.showName) {
    const right = W - SIDE_MARGIN_MM;
    const label = applyCase(o.nameLabel, o.cases.name);
    const labelW = measure(label, NAME_PT, 400, o.fonts.name);
    const left = right - NAME_TOTAL_WIDTH_MM;
    page.ops.push(text(left, NAME_BASELINE_MM, label, NAME_PT, 400, 'start', o.fonts.name));
    const y = NAME_BASELINE_MM + 0.35;
    page.ops.push({ t: 'line', x1: left + labelW + 1.5, y1: y, x2: right, y2: y, w: 0.15, color: INK });
    headerBottom = NAME_BASELINE_MM + 6.5;
  }

  if (o.title) {
    const maxW = W - 2 * SIDE_MARGIN_MM;
    const title = applyCase(o.title, o.cases.title);
    const scale = Math.min(3, Math.max(0.4, o.titleScale));
    const wanted = titlePt * scale;
    let size = wanted;
    while (size > Math.min(12, wanted) && measure(title, size, 700, o.fonts.title) > maxW) size -= 0.5;
    // A larger title grows upward from its baseline, so the baseline and the content below move down.
    const baseline = TITLE_BASELINE_MM + Math.max(0, size - titlePt) * PT_MM * 0.75;
    titleOp = text(alignX(o.titleAlign, SIDE_MARGIN_MM, W - SIDE_MARGIN_MM), baseline, title, size, 700, ANCHOR[o.titleAlign], o.fonts.title);
    page.ops.push(titleOp);
    headerBottom = baseline + 6.5;
  }

  if (o.footer) {
    page.ops.push(text(W / 2, H - FOOTER_BASELINE_FROM_BOTTOM_MM, applyCase(o.footer, o.cases.footer), FOOTER_PT, 400, 'middle', o.fonts.footer));
  }
  return { headerBottom, titleOp };
}

/**
 * Re-aligns the title to the puzzle frame [x0, x1] instead of the page margins, once the frame is known.
 * The title stays inside the page margins even when it is wider than the frame.
 */
export function alignTitleTo(op: TextOp | null, align: Align, x0: number, x1: number, pageW: number, measure: Measure): void {
  if (!op) return;
  const w = measure(op.s, op.size, 700, op.font);
  const left = align === 'left' ? x0 : align === 'right' ? x1 - w : (x0 + x1 - w) / 2;
  op.x = Math.max(SIDE_MARGIN_MM, Math.min(pageW - SIDE_MARGIN_MM - w, left));
  op.anchor = 'start';
}
