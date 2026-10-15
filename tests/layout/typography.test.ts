import { describe, expect, it } from 'vitest';
import { DEFAULT_CASES, DEFAULT_FONTS } from '../../src/layout/fonts.ts';
import { approxMeasure } from '../../src/layout/measure.ts';
import { chromeOps, DEFAULT_CHROME, emptyPage, SIDE_MARGIN_MM, TITLE_BASELINE_MM, type ChromeOptions } from '../../src/layout/page.ts';

const opts = (over: Partial<ChromeOptions>): ChromeOptions => ({
  ...DEFAULT_CHROME, title: 'Animals', showName: false, nameLabel: 'Name', footer: '', fonts: DEFAULT_FONTS, ...over,
});
const titleOp = (o: ChromeOptions) => {
  const page = emptyPage({ id: 'A4', orientation: 'portrait' });
  const { headerBottom } = chromeOps(page, o, 26, approxMeasure);
  const op = page.ops.find((x) => x.t === 'text');
  if (op?.t !== 'text') throw new Error('no title');
  return { op, headerBottom, W: page.widthMm };
};

describe('title typography', () => {
  it('aligns the title left, center or right', () => {
    const l = titleOp(opts({ titleAlign: 'left' }));
    expect([l.op.anchor, l.op.x]).toEqual(['start', SIDE_MARGIN_MM]);
    const c = titleOp(opts({ titleAlign: 'center' }));
    expect([c.op.anchor, c.op.x]).toEqual(['middle', c.W / 2]);
    const r = titleOp(opts({ titleAlign: 'right' }));
    expect([r.op.anchor, r.op.x]).toEqual(['end', r.W - SIDE_MARGIN_MM]);
  });

  it('scales the title and pushes the content below down', () => {
    const base = titleOp(opts({}));
    const big = titleOp(opts({ titleScale: 1.5 }));
    expect(big.op.size).toBeCloseTo(39);
    expect(big.op.y).toBeGreaterThan(TITLE_BASELINE_MM);
    expect(big.headerBottom).toBeGreaterThan(base.headerBottom);
  });

  it('changes case without touching the typed text', () => {
    expect(titleOp(opts({ cases: { ...DEFAULT_CASES, title: 'upper' } })).op.s).toBe('ANIMALS');
    expect(titleOp(opts({ cases: { ...DEFAULT_CASES, title: 'lower' }, title: 'Động Vật' })).op.s).toBe('động vật');
  });
});
