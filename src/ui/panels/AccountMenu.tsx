import { useEffect, useRef, useState } from 'react';
import type { Account } from '../../account/useAccount.ts';
import { t } from '../i18n.ts';

/** Guests get a sign-in button; signed-in users get their initial, which opens a small account panel. */
export function AccountMenu({ account, onSignIn }: { account: Account; onSignIn: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!account.enabled) return null;

  if (!account.user) {
    return (
      <div className="menu" data-blob="self">
        <button type="button" className="menu-btn" aria-label={t('signIn')} title={t('signIn')} onClick={onSignIn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
        </button>
      </div>
    );
  }

  const { name, email } = account.user;
  return (
    <div ref={root} className="menu" data-blob="self">
      <button type="button" className="menu-btn initial" aria-haspopup="dialog" aria-expanded={open} aria-label={t('account')} title={email} onClick={() => setOpen((v) => !v)}>
        {(name || email).charAt(0).toUpperCase()}
      </button>
      {open && (
        <div className="menu-panel account-panel" role="dialog" aria-label={t('account')} data-collapsed="0" data-blob="self" data-blob-spec="panel">
          <div className="menu-group">
            <span className="account-name">{name}</span>
            <span className="account-email">{email}</span>
            {account.role === 'admin' && <span className="badge">{t('roleAdmin')}</span>}
          </div>
          <button type="button" className="tool account-out" onClick={() => { setOpen(false); void account.signOut(); }}>{t('signOut')}</button>
        </div>
      )}
    </div>
  );
}
