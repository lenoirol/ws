import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Account } from '../../account/useAccount.ts';
import { checkCredentials, MIN_PASSWORD } from '../../account/validate.ts';
import { t } from '../i18n.ts';
import { Group } from './Fields.tsx';

type Mode = 'signin' | 'signup' | 'forgot';

/** Sign in, create an account or reset a password. Also shown when a reset link brings the user back. */
export function AuthDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const card = useRef<HTMLFormElement>(null);
  const recovering = account.recovering;

  const close = () => {
    if (recovering) account.endRecovery();
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    card.current?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Signing in (or finishing a reset) closes the dialog by itself.
  useEffect(() => {
    if (account.user && !recovering) onClose();
  }, [account.user, recovering]);

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const issueText = (issue: NonNullable<ReturnType<typeof checkCredentials>>) =>
    issue === 'email' ? t('authEmail') : issue === 'passwordShort' ? t('authPasswordShort', { n: MIN_PASSWORD }) : t('authPasswordMismatch');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      if (recovering) {
        const issue = checkCredentials('x@x.xx', password, confirm);
        if (issue) return setError(issueText(issue));
        setBusy(true);
        await account.setNewPassword(password);
        return;
      }
      if (mode === 'forgot') {
        const issue = checkCredentials(email, 'x'.repeat(MIN_PASSWORD));
        if (issue) return setError(issueText(issue));
        setBusy(true);
        await account.sendReset(email);
        setInfo(t('resetSent'));
        return;
      }
      // Signing in accepts any non-empty password: an account may predate the current length rule.
      const issue = mode === 'signin'
        ? checkCredentials(email, 'x'.repeat(MIN_PASSWORD))
        : checkCredentials(email, password, confirm);
      if (issue) return setError(issueText(issue));
      if (!password) return setError(issueText('passwordShort'));
      setBusy(true);
      if (mode === 'signin') await account.signIn(email, password);
      else if ((await account.signUp(email, password, name)) === 'confirmEmail') {
        setInfo(t('checkEmail'));
        setMode('signin');
        setPassword('');
        setConfirm('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title = recovering ? t('newPassword') : mode === 'signup' ? t('signUp') : mode === 'forgot' ? t('forgotPassword') : t('signIn');
  const submitLabel = recovering ? t('savePassword') : mode === 'signup' ? t('signUp') : mode === 'forgot' ? t('sendReset') : t('signIn');

  return (
    <div className="auth-backdrop" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <form ref={card} className="auth-card" role="dialog" aria-modal="true" aria-label={title} onSubmit={(e) => void submit(e)} noValidate>
        <div className="auth-head">
          <h2>{title}</h2>
          <button type="button" className="auth-x" aria-label={t('close')} title={t('close')} onClick={close}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <Group>
          {!recovering && (
            <label className="row">
              <span className="row-label">{t('email')}</span>
              <span className="row-control"><input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></span>
            </label>
          )}
          {mode === 'signup' && !recovering && (
            <label className="row">
              <span className="row-label">{t('displayName')}</span>
              <span className="row-control"><input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></span>
            </label>
          )}
          {(recovering || mode !== 'forgot') && (
            <label className="row">
              <span className="row-label">{recovering ? t('newPassword') : t('password')}</span>
              <span className="row-control"><input type="password" autoComplete={mode === 'signin' && !recovering ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></span>
            </label>
          )}
          {(recovering || mode === 'signup') && (
            <label className="row">
              <span className="row-label">{t('confirmPassword')}</span>
              <span className="row-control"><input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></span>
            </label>
          )}
        </Group>

        {error && <p className="auth-msg error" role="alert">{error}</p>}
        {info && <p className="auth-msg" role="status">{info}</p>}

        <button type="submit" className="tool prominent auth-submit" disabled={busy}>{submitLabel}</button>

        {!recovering && (
          <div className="auth-links">
            {mode === 'signin' && (
              <>
                <button type="button" onClick={() => go('forgot')}>{t('forgotPassword')}</button>
                <button type="button" onClick={() => go('signup')}>{t('noAccountYet')}</button>
              </>
            )}
            {mode === 'signup' && <button type="button" onClick={() => go('signin')}>{t('haveAccount')}</button>}
            {mode === 'forgot' && <button type="button" onClick={() => go('signin')}>{t('backToSignIn')}</button>}
          </div>
        )}
        <p className="auth-note">{t('guestNote')}</p>
      </form>
    </div>
  );
}
