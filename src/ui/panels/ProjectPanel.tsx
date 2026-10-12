import { Icon } from '../icons.tsx';
import { t } from '../i18n.ts';
import { Group } from './Fields.tsx';
import { Banner, Spinner } from './Form.tsx';

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
  const saved = status?.level === 'info' && !saving;
  return (
    <Group title={t('project')}>
      <label className="row">
        <span className="row-label">{t('projectName')}</span>
        <span className="row-control"><input type="text" value={name} placeholder={t('untitled')} maxLength={120} onChange={(e) => setName(e.target.value)} /></span>
      </label>
      <div className="row btn-row">
        <button type="button" className={`tool prominent save-btn ${saved ? 'saved' : ''}`} disabled={saving} onClick={onSave} aria-live="polite">
          {saving ? <Spinner /> : saved ? <Icon name="check" size={18} /> : null}
          <span>{saving ? t('saving') : saved ? t('savedShort') : t('save')}</span>
        </button>
        <button type="button" className="tool soft" onClick={onOpenList}>{t('myProjects')}</button>
      </div>
      {status?.level === 'warn' && <div className="row bare-row"><Banner kind="error">{status.text}</Banner></div>}
      {!signedIn && <p className="pp-hint">{t('saveNeedsAccount')}</p>}
    </Group>
  );
}
