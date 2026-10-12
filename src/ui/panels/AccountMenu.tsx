import { useEffect, useRef, useState } from 'react';
import type { Account } from '../../account/useAccount.ts';
import { Icon, type IconName } from '../icons.tsx';
import { t } from '../i18n.ts';

const EXIT_MS = 140;

function Item({ icon, label, onClick, danger = false, go = false }: { icon: IconName; label: string; onClick: () => void; danger?: boolean; go?: boolean }) {
  return (
    <button type="button" role="menuitem" className={`mi ${danger ? 'danger' : ''}`} onClick={onClick}>
      <Icon name={icon} size={20} />
      <span>{label}</span>
      {go && <Icon name="chevron" size={16} className="go" />}
    </button>
  );
}

/** Guests get a sign-in button; signed-in users get their initial, which opens the account panel. */
export function AccountMenu({ account, onSignIn, onProjects, onAdmin }: { account: Account; onSignIn: () => void; onProjects: () => void; onAdmin: () => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Stay mounted for the exit animation.
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(() => setMounted(false), reduce ? 0 : EXIT_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
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
        <button type="button" className="menu-btn" aria-label={t('signIn')} title={t('signIn')} onClick={onSignIn}><Icon name="user" /></button>
      </div>
    );
  }

  const { name, email } = account.user;
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="menu" data-blob="self">
      <button ref={trigger} type="button" className="menu-btn initial" aria-haspopup="menu" aria-expanded={open} aria-label={t('account')} title={email} onClick={() => setOpen((v) => !v)}>
        {(name || email).charAt(0).toUpperCase()}
      </button>
      {mounted && (
        <div className="menu-panel account-panel" role="menu" aria-label={t('account')} data-state={open ? 'open' : 'closing'} data-collapsed="0">
          <div className="acc-head">
            <span className="acc-av" aria-hidden="true">{(name || email).charAt(0).toUpperCase()}</span>
            <span className="acc-id">
              <span className="acc-name">{name}</span>
              <span className="acc-email">{email}</span>
              {account.role === 'admin' && <span className="role admin">{t('roleAdmin')}</span>}
            </span>
          </div>
          <div className="acc-sep" />
          <Item icon="folder" label={t('myProjects')} go onClick={run(onProjects)} />
          {account.role === 'admin' && <Item icon="shield" label={t('admin')} go onClick={run(onAdmin)} />}
          <div className="acc-sep" />
          <Item icon="logout" label={t('signOut')} danger onClick={run(() => void account.signOut())} />
        </div>
      )}
    </div>
  );
}
