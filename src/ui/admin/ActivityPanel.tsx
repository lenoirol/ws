import { useEffect, useRef, useState } from 'react';
import { listSessions, PAGE, type SessionFilter, type SessionRow } from '../../account/admin.ts';
import { t } from '../i18n.ts';
import { Segmented } from '../panels/Fields.tsx';
import { Banner, EmptyState, Skeleton, Spinner } from '../panels/Form.tsx';
import { SessionItem } from './parts.tsx';

/** Every visit, guests included: when (date and time), on which device, and what was done. */
export function ActivityPanel() {
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  useEffect(() => {
    const mine = ++request.current;
    setRows(null);
    setError(null);
    listSessions(filter, 0)
      .then((r) => { if (mine === request.current) { setRows(r); setMore(r.length === PAGE); } })
      .catch((e: Error) => { if (mine === request.current) { setError(t('error', { m: e.message })); setRows([]); } });
  }, [filter]);

  const loadMore = async () => {
    setBusy(true);
    try {
      const r = await listSessions(filter, rows?.length ?? 0);
      setRows((prev) => [...(prev ?? []), ...r]);
      setMore(r.length === PAGE);
    } catch (e) {
      setError(t('error', { m: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view-swap">
      <Segmented<SessionFilter> label={t('adminActivity')} value={filter} onChange={setFilter} className="fill"
        options={[{ value: 'all', label: t('filterAll') }, { value: 'guest', label: t('filterGuests') }, { value: 'user', label: t('filterSignedIn') }]} />
      {rows === null && <Skeleton rows={4} />}
      {rows !== null && rows.length === 0 && !error && <EmptyState icon="info" title={t('noSessions')} />}
      {rows !== null && rows.length > 0 && <div className="pj-list">{rows.map((s, i) => <SessionItem key={s.id} s={s} i={i} />)}</div>}
      {more && (
        <button type="button" className="btn block" disabled={busy} onClick={() => void loadMore()}>
          {busy && <Spinner />}<span>{t('loadMore')}</span>
        </button>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </div>
  );
}
