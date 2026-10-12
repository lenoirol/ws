/** Draw ops in mm (font size in pt). All outputs (SVG, canvas, PDF) share this list. */
export type DrawOp =
  | {
      t: 'text';
      x: number;
      y: number;
      s: string;
      size: number;
      weight: 400 | 700;
      anchor: 'start' | 'middle' | 'end';
      font: string;
      color: string;
    }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; color: string }
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number; stroke?: string; fill?: string; sw?: number }
  /** Circles a word in the answer key: a capsule from the first cell's center to the last cell's center. */
  | { t: 'capsule'; x1: number; y1: number; x2: number; y2: number; thickness: number; stroke: string; sw: number }
  | { t: 'dot'; x: number; y: number; r: number; fill: string };

export interface Page {
  widthMm: number;
  heightMm: number;
  ops: DrawOp[];
  /** Which puzzle this page belongs to; shown in the preview when several kinds are combined. */
  label?: string;
}

export type LayoutWarning =
  | { kind: 'smallFont'; pt: number; level: 'warn' | 'severe' }
  | { kind: 'listTooLarge' }
  | { kind: 'scrambleCramped' }
  | { kind: 'crosswordCramped' };
