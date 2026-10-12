import { t } from '../i18n.ts';
import { Group } from './Fields.tsx';

export type SaveStatus = { level: 'info' | 'warn'; text: string } | null;

/** Name, Save and "My Projects". Guests can press both; they are asked to sign in first. */
export function ProjectPanel({ name, setName, saving, status, signedIn, onSave, onOpenList }: {
  name: string;
  setName: (v: string) => void;
  saving: boolean;
  status: SaveStatus;
  signedIn: boolean;
  onSave: () => void;
  onOpenList: () => void;
}) {
  return (
    <Group title={t('project')}>
      <label className="row">
        <span className="row-label">{t('projectName')}</span>
        <span className="row-control"><input type="text" value={name} placeholder={t('untitled')} maxLength={120} onChange={(e) => setName(e.target.value)} /></span>
      </label>
      <div className="row btn-row">
        <button type="button" className="tool prominent" disabled={saving} onClick={onSave}>{t('save')}</button>
        <button type="button" className="tool soft" onClick={onOpenList}>{t('myProjects')}</button>
      </div>
      {status && <div className={`row notice ${status.level}`} role={status.level === 'warn' ? 'alert' : 'status'}><span>{status.text}</span></div>}
      {!signedIn && <div className="row notice info"><span>{t('saveNeedsAccount')}</span></div>}
    </Group>
  );
}
