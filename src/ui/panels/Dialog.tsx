import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../icons.tsx';
import { t } from '../i18n.ts';

const CloseContext = createContext<() => void>(() => undefined);

/** Closes the surrounding dialog with its exit animation. Safe to call more than once. */
export const useDialogClose = () => useContext(CloseContext);

const EXIT_MS = 170;
const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Shared shell: blurred backdrop, spring entrance, animated exit, Escape and backdrop-click to close,
 * focus kept inside and returned to the opener. On phones it becomes a bottom sheet (see styles).
 */
export function Dialog({ title, onClose, size = 'sm', children }: { title: string; onClose: () => void; size?: 'sm' | 'md' | 'lg'; children: ReactNode }) {
  const [closing, setClosing] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onCloseRef.current();
      return;
    }
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, []);

  useEffect(() => {
    const el = card.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const from = opener.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      if (from instanceof HTMLElement && from.isConnected) from.focus({ preventScroll: true });
    };
  }, [close]);

  return (
    <div className="dlg-backdrop" data-state={closing ? 'closing' : 'open'} role="presentation" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={card} className={`dlg-card dlg-${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <header className="dlg-head">
          <h2>{title}</h2>
          <button type="button" className="dlg-x" aria-label={t('close')} title={t('close')} onClick={close}><Icon name="close" size={16} /></button>
        </header>
        <CloseContext.Provider value={close}>
          <div className="dlg-body">{children}</div>
        </CloseContext.Provider>
      </div>
    </div>
  );
}

/** Closes the dialog (animated) as soon as `when` becomes true. */
export function CloseWhen({ when }: { when: boolean }) {
  const close = useDialogClose();
  useEffect(() => {
    if (when) close();
  }, [when, close]);
  return null;
}
