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
