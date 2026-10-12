import { useEffect, useState } from 'react';
import { loadStats, type Stats } from '../../account/admin.ts';
import { t } from '../i18n.ts';
import { Dialog, useDialogClose } from '../panels/Dialog.tsx';
import { Segmented } from '../panels/Fields.tsx';
import { ActivityPanel } from './ActivityPanel.tsx';
import { RequestsPanel } from './RequestsPanel.tsx';
import { UsersPanel } from './UsersPanel.tsx';

type Tab = 'users' | 'requests' | 'activity';

function Stat({ label, value, i, hot = false }: { label: string; value: number | null; i: number; hot?: boolean }) {
  return (
    <div className={`stat ${hot ? 'hot' : ''}`} style={{ '--i': i } as React.CSSProperties}>
      <span className="stat-value">{value ?? '–'}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/**
 * Administrators only. The database enforces who may read or change anything here;
 * this screen just lays it out: people, password requests, and every visit.
 */
export function AdminDialog({ selfId, onClose, onOpenProject, onPendingChange }: {
  selfId: string;
  onClose: () => void;
  /** Loads someone's project into the editor as a copy. */
  onOpenProject: (id: string, owner: string) => Promise<void>;
  onPendingChange: (n: number) => void;
}) {
  return (
    <Dialog title={t('admin')} size="xl" onClose={onClose}>
      <AdminBody selfId={selfId} onOpenProject={onOpenProject} onPendingChange={onPendingChange} />
    </Dialog>
  );
}

function AdminBody({ selfId, onOpenProject, onPendingChange }: { selfId: string; onOpenProject: (id: string, owner: string) => Promise<void>; onPendingChange: (n: number) => void }) {
  const close = useDialogClose();
  const [tab, setTab] = useState<Tab>('users');
  const [stats, setStats] = useState<Stats | null>(null);

  const refresh = () => {
    void loadStats().then((s) => { setStats(s); onPendingChange(s.pendingRequests); }).catch(() => undefined);
  };
  useEffect(refresh, []);

  const pending = stats?.pendingRequests ?? 0;
  return (
    <>
      <div className="stats">
        <Stat i={0} label={t('statVisits')} value={stats?.visits ?? null} />
        <Stat i={1} label={t('statDay')} value={stats?.last24h ?? null} />
        <Stat i={2} label={t('statUsers')} value={stats?.users ?? null} />
        <Stat i={3} label={t('statWaiting')} value={stats?.pendingRequests ?? null} hot={pending > 0} />
      </div>

      <Segmented<Tab> kind="tab" className="fill" label={t('admin')} value={tab} onChange={setTab}
        options={[
          { value: 'users', label: t('adminUsers') },
          { value: 'requests', label: pending > 0 ? t('tabWithCount', { label: t('adminRequests'), n: pending }) : t('adminRequests') },
          { value: 'activity', label: t('adminActivity') },
        ]} />

      {tab === 'users' && (
        <UsersPanel selfId={selfId} onChanged={refresh}
          onOpenProject={async (id, owner) => { await onOpenProject(id, owner); close(); }} />
      )}
      {tab === 'requests' && <RequestsPanel onChanged={refresh} />}
      {tab === 'activity' && <ActivityPanel />}
    </>
  );
}
