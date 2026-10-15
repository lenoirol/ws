import { PDFDocument } from 'pdf-lib';
import type { Page } from '../layout/drawops.ts';
import { pageToPng } from './png.ts';

export interface PdfImage {
  png: Uint8Array;
  widthMm: number;
  heightMm: number;
}

const MM_TO_PT = 72 / 25.4;

/** Each PNG image becomes one PDF page of the exact paper size. */
export async function buildPdf(images: readonly PdfImage[], title: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  for (const img of images) {
    const w = img.widthMm * MM_TO_PT;
    const h = img.heightMm * MM_TO_PT;
    const page = doc.addPage([w, h]);
    page.drawImage(await doc.embedPng(img.png), { x: 0, y: 0, width: w, height: h });
  }
  return doc.save();
}

export async function pagesToPdf(pages: readonly Page[], dpi: number, title: string): Promise<Blob> {
  const images: PdfImage[] = [];
  for (const page of pages) {
    const { blob } = await pageToPng(page, dpi);
    images.push({ png: new Uint8Array(await blob.arrayBuffer()), widthMm: page.widthMm, heightMm: page.heightMm });
  }
  const bytes = await buildPdf(images, title);
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** Vector PDF with standard Helvetica; falls back to an image PDF for other typefaces or characters that cannot be encoded. */
export async function pagesToPdfSmart(pages: readonly Page[], dpi: number, title: string): Promise<{ blob: Blob; vector: boolean }> {
  try {
    const { buildVectorPdf } = await import('./pdfVector.ts');
    const bytes = await buildVectorPdf(pages, title);
    return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), vector: true };
  } catch {
    return { blob: await pagesToPdf(pages, dpi, title), vector: false };
  }
}
