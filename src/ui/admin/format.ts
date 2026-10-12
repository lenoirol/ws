const full = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "Mon, 12 Oct 2026, 14:24" in the viewer's own language and time zone. */
export const formatWhen = (iso: string): string => full.format(new Date(iso));

/** Stable colour per person, so the same avatar looks the same everywhere. */
export function hue(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
