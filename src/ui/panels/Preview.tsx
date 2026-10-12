import { useEffect, useMemo, type CSSProperties } from 'react';
import type { Page } from '../../layout/drawops.ts';
import { renderSvg } from '../../render/svg.ts';
import { t } from '../i18n.ts';
import { setPages } from '../pageStore.ts';

export function Preview({ pages, empty, copies, seed, zoom }: { pages: Page[]; empty: boolean; copies: number; seed: number; zoom: number }) {
  const svgs = useMemo(() => pages.map(renderSvg), [pages]);
  // The glass scene draws the real sheets behind the glass; tell it which pages are on screen.
  useEffect(() => {
    setPages(pages);
    window.dispatchEvent(new Event('lg-refresh'));
  }, [pages]);
  if (empty) {
    return (
      <div className="placeholder">
        <div className="placeholder-icon" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" /></svg>
        </div>
        <h2>{t('emptyTitle')}</h2>
        <p>{t('empty')}</p>
      </div>
    );
  }
  return (
    <div className="preview">
      {copies > 1 && <p className="copies-note">{t('copiesNote', { n: copies })}</p>}
      <div className="pages">
        {svgs.map((svg, i) => (
          <figure key={`${seed}-${i}`} className="page-card" style={{ '--i': i, ...(zoom ? { width: `${zoom}%`, maxWidth: 'none' } : {}) } as CSSProperties}>
            <figcaption>{t('pageN', { n: i + 1, total: svgs.length })}{pages[i]?.label ? ` · ${pages[i]?.label}` : ''}</figcaption>
            <div className="sheet-view" data-page-index={i} dangerouslySetInnerHTML={{ __html: svg }} />
          </figure>
        ))}
      </div>
    </div>
  );
}
