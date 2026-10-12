/** A short "Browser on System" label for the admin log. Order matters: Edge and Opera also say Chrome. */
export function describeAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\/|CriOS\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Browser';
  // iPhone and iPad user agents also contain "like Mac OS X", so test them before macOS.
  const system =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Linux|X11/.test(ua) ? 'Linux' : null;
  return system ? `${browser} on ${system}` : browser;
}

export interface Device {
  browser: string;
  /** What the person was holding: "iPhone", "Windows PC", "Android phone"... */
  device: string;
  kind: 'phone' | 'tablet' | 'computer' | 'unknown';
  /** "Safari on iPhone" */
  label: string;
}

/**
 * Browser and device from a user agent. A browser cannot be asked for the exact model, so this names
 * the kind of device (phone, tablet, computer) and its system. iPadOS asks for the desktop site and
 * reports itself as a Mac, so such an iPad shows as "Mac".
 */
export function describeDevice(ua: string | null | undefined): Device {
  if (!ua) return { browser: 'Unknown', device: 'Unknown device', kind: 'unknown', label: 'Unknown device' };
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Firefox\/|FxiOS/.test(ua) ? 'Firefox' :
    /Chrome\/|CriOS\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Browser';

  let device: string;
  let kind: Device['kind'];
  if (/iPhone|iPod/.test(ua)) { device = 'iPhone'; kind = 'phone'; }
  else if (/iPad/.test(ua)) { device = 'iPad'; kind = 'tablet'; }
  else if (/Android/.test(ua)) { kind = /Mobile/.test(ua) ? 'phone' : 'tablet'; device = kind === 'phone' ? 'Android phone' : 'Android tablet'; }
  else if (/Windows/.test(ua)) { device = 'Windows PC'; kind = 'computer'; }
  else if (/Mac OS X|Macintosh/.test(ua)) { device = 'Mac'; kind = 'computer'; }
  else if (/CrOS/.test(ua)) { device = 'Chromebook'; kind = 'computer'; }
  else if (/Linux|X11/.test(ua)) { device = 'Linux PC'; kind = 'computer'; }
  else { device = 'Unknown device'; kind = 'unknown'; }
  return { browser, device, kind, label: kind === 'unknown' ? browser : `${browser} on ${device}` };
}
