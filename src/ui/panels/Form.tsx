import { useId, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons.tsx';
import { t } from '../i18n.ts';

export function Spinner() {
  return <span className="spin" role="presentation" />;
}

export function TextField({ label, type = 'text', value, onChange, autoComplete, hint, invalid = false, autoFocus = false, inputMode }: {
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  inputMode?: 'email' | 'text';
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="field-box" data-invalid={invalid ? '1' : '0'}>
        <input id={id} type={isPassword && shown ? 'text' : type} value={value} autoComplete={autoComplete} inputMode={inputMode} spellCheck={false}
          autoCapitalize="none" aria-invalid={invalid} data-autofocus={autoFocus ? '' : undefined} onChange={(e) => onChange(e.target.value)} />
        {isPassword && (
          <button type="button" className="field-eye" aria-label={shown ? t('hidePassword') : t('showPassword')} title={shown ? t('hidePassword') : t('showPassword')} onClick={() => setShown((v) => !v)}>
            <Icon name={shown ? 'eyeOff' : 'eye'} size={19} />
          </button>
        )}
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

export function Banner({ kind, icon, children }: { kind: 'error' | 'ok' | 'info'; icon?: IconName; children: ReactNode }) {
  const name: IconName = icon ?? (kind === 'error' ? 'alert' : kind === 'ok' ? 'check' : 'info');
  return (
    <div className={`banner ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon name={name} size={18} />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="empty">
      <span className="empty-ico"><Icon name={icon} size={28} /></span>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="pj-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skel" style={{ animationDelay: `${i * 120}ms` }} />)}
    </div>
  );
}
