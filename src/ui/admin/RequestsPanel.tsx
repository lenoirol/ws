import { useEffect, useState } from 'react';
import { approveReset, DEFAULT_PASSWORD, dismissRequest, listRequests, type ResetRequest } from '../../account/admin.ts';
import { t } from '../i18n.ts';
import { Banner, EmptyState, Skeleton, Spinner } from '../panels/Form.tsx';
import { formatWhen } from './format.ts';
import { Avatar, DeviceLabel } from './parts.tsx';

/**
 * Password requests from people who tapped "Forgot password?". Nothing is emailed: an administrator
 * decides here, and an approval sets the default password and ends the person's sessions.
 */
export function RequestsPanel({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<ResetRequest[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reload = async () => {
    try {
      setItems(await listRequests());
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
      setItems([]);
    }
  };
  useEffect(() => { void reload(); }, []);

  const run = async (r: ResetRequest, action: 'approve' | 'dismiss') => {
    setBusy(r.id);
    setError(null);
    setDone(null);
    try {
      if (action === 'approve') {
        await approveReset(r.id);
        setDone(t('resetDone', { email: r.email, pw: DEFAULT_PASSWORD }));
      } else {
        await dismissRequest(r.id);
      }
      setConfirming(null);
      await reload();
      onChanged();
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
    } finally {
      setBusy(null);
    }
  };

  const pending = (items ?? []).filter((r) => r.status === 'pending');
  const handled = (items ?? []).filter((r) => r.status !== 'pending').slice(0, 15);

  return (
    <div className="view-swap">
      {done && <Banner kind="ok" icon="key">{done}</Banner>}
      {items === null && <Skeleton rows={2} />}
      {items !== null && pending.length === 0 && !error && <EmptyState icon="key" title={t('requestsNone')} />}

      {pending.length > 0 && (
        <>
          <h3 className="sec-title">{t('pendingTitle')}</h3>
          <div className="pj-list">
            {pending.map((r, i) => (
              <div key={r.id} className="req" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}>
                <div className="ad-row">
                  <Avatar text={r.email} />
                  <div className="ad-text">
                    <span className="ad-who">{r.email}</span>
                    <span className="ad-meta">{t('requestedAt', { when: formatWhen(r.requested_at) })} · <DeviceLabel ua={r.user_agent} /></span>
                  </div>
                  {confirming !== r.id && (
                    <span className="req-actions">
                      <button type="button" className="btn sm" disabled={busy === r.id} onClick={() => void run(r, 'dismiss')}>{t('dismiss')}</button>
                      <button type="button" className="btn sm primary" disabled={busy === r.id} onClick={() => setConfirming(r.id)}>{t('resetPassword')}</button>
                    </span>
                  )}
                </div>
                {confirming === r.id && (
                  <div className="req-confirm" role="alertdialog" aria-label={t('resetPassword')}>
                    <p>{t('confirmReset', { email: r.email, pw: DEFAULT_PASSWORD })}</p>
                    <span className="req-actions">
                      <button type="button" className="btn sm" disabled={busy === r.id} onClick={() => setConfirming(null)}>{t('cancel')}</button>
                      <button type="button" className="btn sm danger" disabled={busy === r.id} onClick={() => void run(r, 'approve')}>
                        {busy === r.id && <Spinner />}<span>{t('resetConfirmBtn', { pw: DEFAULT_PASSWORD })}</span>
                      </button>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {handled.length > 0 && (
        <>
          <h3 className="sec-title">{t('handledTitle')}</h3>
          <div className="pj-list">
            {handled.map((r) => (
              <div key={r.id} className="ad-row">
                <Avatar text={r.email} />
                <div className="ad-text">
                  <span className="ad-who">{r.email}</span>
                  <span className="ad-meta">{t('requestedAt', { when: formatWhen(r.requested_at) })}</span>
                </div>
                <span className={`role ${r.status === 'approved' ? 'admin' : ''}`}>{r.status === 'approved' ? t('statusApproved') : t('statusDismissed')}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </div>
  );
}
