import type { CSSProperties } from 'react';
import { formatDuration } from '../../account/duration.ts';
import { describeDevice } from '../../account/userAgent.ts';
import type { SessionRow } from '../../account/admin.ts';
import { Icon, type IconName } from '../icons.tsx';
import { t } from '../i18n.ts';
import { formatWhen, hue } from './format.ts';

export function Avatar({ text, guest = false, size = 38 }: { text: string; guest?: boolean; size?: number }) {
  const style: CSSProperties = { width: size, height: size, fontSize: size * 0.4 };
  if (guest) return <span className="av guest" style={style}><Icon name="user" size={Math.round(size * 0.48)} /></span>;
  return <span className="av" style={{ ...style, background: `hsl(${hue(text)} 52% 50%)` }}>{(text || '?').charAt(0).toUpperCase()}</span>;
}

const DEVICE_ICON = { phone: 'phone', tablet: 'tablet', computer: 'computer', unknown: 'computer' } as const satisfies Record<string, IconName>;

/** Device with a small icon: "Safari on iPhone". */
export function DeviceLabel({ ua }: { ua: string | null }) {
  const d = describeDevice(ua);
  return (
    <span className="device">
      <Icon name={DEVICE_ICON[d.kind]} size={14} />
      {d.label}
    </span>
  );
}

const ACTIONS = [
  ['png', 'PNG'],
  ['pdf', 'PDF'],
  ['print', 'actPrint'],
  ['share', 'actShare'],
  ['regenerate', 'actRegenerate'],
] as const;
const actionLabel = (label: string) => (label.startsWith('act') ? t(label as 'actPrint') : label);

/** One visit: who, the exact date and time, the device, how long, and what they exported. */
export function SessionItem({ s, i, showWho = true }: { s: SessionRow; i: number; showWho?: boolean }) {
  const who = s.user_id ? s.profiles?.email || t('unknownUser') : t('guest');
  const started = new Date(s.started_at);
  const chips = ACTIONS.filter(([k]) => (s.summary?.[k] ?? 0) > 0);
  return (
    <div className="ad-row" style={{ '--i': Math.min(i, 8) } as CSSProperties}>
      {showWho ? <Avatar text={who} guest={!s.user_id} /> : <span className="av guest"><Icon name={DEVICE_ICON[describeDevice(s.user_agent).kind]} size={18} /></span>}
      <div className="ad-text">
        <span className="ad-who">
          {showWho ? who : formatWhen(s.started_at)}
          {showWho && s.user_id && s.started_as_guest ? <em> · {t('signedInDuring')}</em> : null}
        </span>
        <span className="ad-meta">
          {showWho && <>{formatWhen(s.started_at)} · </>}
          <DeviceLabel ua={s.user_agent} /> · {formatDuration(new Date(s.last_seen_at).getTime() - started.getTime())}
        </span>
        <span className="chips-s">
          {chips.length === 0 ? <span className="chip-s none">{t('noActions')}</span> : chips.map(([k, l]) => <span key={k} className="chip-s">{actionLabel(l)} {s.summary[k]}</span>)}
        </span>
      </div>
    </div>
  );
}
