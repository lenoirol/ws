import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { DrawOp, Page } from '../layout/drawops.ts';
import { DEFAULT_FONT } from '../layout/fonts.ts';
import { capsulePath } from '../render/shapes.ts';

const K = 72 / 25.4; // mm to pt

function color(hex: string) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? Array.from(h, (c) => c + c).join('') : h;
  const v = (i: number) => parseInt(full.slice(i, i + 2), 16) / 255;
  return rgb(v(0), v(2), v(4));
}

/**
 * Draws DrawOp[] as vector PDF. Text uses the standard Helvetica fonts that every PDF reader
 * provides, so nothing needs embedding. Characters outside WinAnsi make pdf-lib throw, and so does
 * a page that uses another typeface (it cannot be reproduced without embedding it); the caller
 * falls back to an image PDF in both cases.
 */
export async function buildVectorPdf(pages: readonly Page[], title: string): Promise<Uint8Array> {
  for (const page of pages) {
    for (const op of page.ops) if (op.t === 'text' && op.font !== DEFAULT_FONT) throw new Error(`Font "${op.font}" is not a standard PDF font`);
  }
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const page of pages) {
    const H = page.heightMm * K;
    const pdfPage = doc.addPage([page.widthMm * K, H]);
    for (const op of page.ops) drawOp(pdfPage, H, op, op.t === 'text' && op.weight === 700 ? bold : regular);
  }
  return doc.save({ useObjectStreams: false });
}

function drawOp(p: PDFPage, H: number, op: DrawOp, font: PDFFont): void {
  switch (op.t) {
    case 'text': {
      const w = font.widthOfTextAtSize(op.s, op.size);
      const x = op.x * K - (op.anchor === 'middle' ? w / 2 : op.anchor === 'end' ? w : 0);
      p.drawText(op.s, { x, y: H - op.y * K, size: op.size, font, color: color(op.color) });
      return;
    }
    case 'line':
      p.drawLine({ start: { x: op.x1 * K, y: H - op.y1 * K }, end: { x: op.x2 * K, y: H - op.y2 * K }, thickness: op.w * K, color: color(op.color) });
      return;
    case 'rect':
      p.drawRectangle({
        x: op.x * K,
        y: H - (op.y + op.h) * K,
        width: op.w * K,
        height: op.h * K,
        ...(op.fill ? { color: color(op.fill) } : {}),
        ...(op.stroke ? { borderColor: color(op.stroke), borderWidth: (op.sw ?? 0.2) * K } : {}),
      });
      return;
    case 'capsule':
      // Coordinates are already in pt; drawSvgPath flips the y axis around the origin (0, H).
      p.drawSvgPath(capsulePath(op.x1 * K, op.y1 * K, op.x2 * K, op.y2 * K, op.thickness * K), { x: 0, y: H, borderColor: color(op.stroke), borderWidth: op.sw * K });
      return;
    case 'dot':
      p.drawCircle({ x: op.x * K, y: H - op.y * K, size: op.r * K, color: color(op.fill) });
  }
}
