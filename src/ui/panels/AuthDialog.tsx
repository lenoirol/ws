import { useState, type FormEvent } from 'react';
import type { Account } from '../../account/useAccount.ts';
import { checkCredentials, MIN_PASSWORD, type CredentialIssue } from '../../account/validate.ts';
import { t } from '../i18n.ts';
import { Segmented } from './Fields.tsx';
import { CloseWhen, Dialog } from './Dialog.tsx';
import { Banner, Spinner, TextField } from './Form.tsx';

type Mode = 'signin' | 'signup' | 'forgot';
type Field = 'email' | 'password' | 'confirm';

const issueField = (i: CredentialIssue): Field => (i === 'email' ? 'email' : i === 'passwordShort' ? 'password' : 'confirm');

/** Sign in, create an account or reset a password. Also shown when a reset link brings the user back. */
export function AuthDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const recovering = account.recovering;
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [bad, setBad] = useState<Field | null>(null);

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setBad(null);
  };

  const issueText = (issue: CredentialIssue) =>
    issue === 'email' ? t('authEmail') : issue === 'passwordShort' ? t('authPasswordShort', { n: MIN_PASSWORD }) : t('authPasswordMismatch');
  const reject = (issue: CredentialIssue) => {
    setError(issueText(issue));
    setBad(issueField(issue));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBad(null);
    try {
      if (recovering) {
        const issue = checkCredentials('x@x.xx', password, confirm);
        if (issue) return reject(issue);
        setBusy(true);
        await account.setNewPassword(password);
        return;
      }
      if (mode === 'forgot') {
        const issue = checkCredentials(email, 'x'.repeat(MIN_PASSWORD));
        if (issue) return reject(issue);
        setBusy(true);
        await account.requestReset(email);
        setInfo(t('resetSent'));
        return;
      }
      // Signing in accepts any non-empty password: an account may predate the current length rule.
      const issue = mode === 'signin' ? checkCredentials(email, 'x'.repeat(MIN_PASSWORD)) : checkCredentials(email, password, confirm);
      if (issue) return reject(issue);
      if (!password) return reject('passwordShort');
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

  const title = recovering ? t('newPassword') : mode === 'signup' ? t('signUp') : mode === 'forgot' ? t('resetTitle') : t('signIn');
  const submitLabel = recovering ? t('savePassword') : mode === 'signup' ? t('signUp') : mode === 'forgot' ? t('sendReset') : t('signIn');

  return (
    <Dialog title={title} onClose={() => { if (recovering) account.endRecovery(); onClose(); }}>
      {/* Wait for the profile: an account an admin reset must go on to choose a new password, not close. */}
      <CloseWhen when={account.user !== null && account.profileReady && !recovering} />
      <form className="auth-form" onSubmit={(e) => void submit(e)} noValidate>
        {!recovering && mode !== 'forgot' && (
          <Segmented<Mode> kind="tab" className="fill" label={t('account')} value={mode} onChange={go}
            options={[{ value: 'signin', label: t('signIn') }, { value: 'signup', label: t('signUp') }]} />
        )}

        {mode === 'forgot' && !recovering && <p className="dlg-sub">{t('resetIntro')}</p>}
        {recovering && account.mustChangePassword && <Banner kind="info" icon="shield">{t('forcedChange')}</Banner>}

        {/* keyed by mode so the fields ease in again when the form changes */}
        <div className="fields" key={recovering ? 'recovery' : mode}>
          {mode === 'signup' && !recovering && <TextField label={t('displayName')} value={name} onChange={setName} autoComplete="name" />}
          {!recovering && <TextField label={t('email')} type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" invalid={bad === 'email'} autoFocus />}
          {(recovering || mode !== 'forgot') && (
            <TextField label={recovering ? t('newPassword') : t('password')} type="password" value={password} onChange={setPassword}
              autoComplete={mode === 'signin' && !recovering ? 'current-password' : 'new-password'} invalid={bad === 'password'} autoFocus={recovering}
              hint={mode === 'signup' || recovering ? t('passwordHint', { n: MIN_PASSWORD }) : undefined} />
          )}
          {(recovering || mode === 'signup') && (
            <TextField label={t('confirmPassword')} type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={bad === 'confirm'} />
          )}
        </div>

        {mode === 'signin' && !recovering && (
          <button type="button" className="btn text aux-link" onClick={() => go('forgot')}>{t('forgotPassword')}</button>
        )}

        {error && <Banner kind="error">{error}</Banner>}
        {info && <Banner kind="ok" icon="check">{info}</Banner>}

        <button type="submit" className="btn primary block" disabled={busy}>
          {busy && <Spinner />}
          <span>{submitLabel}</span>
        </button>

        {mode === 'forgot' && !recovering && <button type="button" className="btn text" onClick={() => go('signin')}>{t('backToSignIn')}</button>}
        <p className="dlg-note">{t('guestNote')}</p>
      </form>
    </Dialog>
  );
}
