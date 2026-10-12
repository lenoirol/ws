import { describe, expect, it } from 'vitest';
import { formatDuration, relativeTime } from '../../src/account/duration.ts';
import { describeAgent, describeDevice } from '../../src/account/userAgent.ts';

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0)).toBe('< 1 min');
    expect(formatDuration(59_000)).toBe('< 1 min');
    expect(formatDuration(60_000)).toBe('1 min');
    expect(formatDuration(12 * 60_000 + 30_000)).toBe('12 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05 min');
  });
  it('treats negative values as zero', () => {
    expect(formatDuration(-5000)).toBe('< 1 min');
  });
});

describe('describeAgent', () => {
  const cases: [string, string][] = [
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 'Chrome on macOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', 'Edge on Windows'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Safari on iOS'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0', 'Firefox on Linux'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', 'Chrome on Android'],
  ];
  it.each(cases)('%s', (ua, expected) => expect(describeAgent(ua)).toBe(expected));
  it('handles missing values', () => {
    expect(describeAgent(null)).toBe('Unknown');
    expect(describeAgent('')).toBe('Unknown');
  });
});

describe('relativeTime', () => {
  const now = Date.UTC(2026, 9, 12, 12, 0, 0);
  it('speaks in the largest sensible unit', () => {
    expect(relativeTime(now - 5_000, now, 'en')).toBe('now');
    expect(relativeTime(now - 5 * 60_000, now, 'en')).toBe('5 minutes ago');
    expect(relativeTime(now - 3 * 3_600_000, now, 'en')).toBe('3 hours ago');
    expect(relativeTime(now - 86_400_000, now, 'en')).toBe('yesterday');
    expect(relativeTime(now - 4 * 86_400_000, now, 'en')).toBe('4 days ago');
  });
  it('falls back to a date after a month', () => {
    expect(relativeTime(now - 45 * 86_400_000, now, 'en')).toMatch(/Aug \d+, 2026/);
  });
});

describe('describeDevice', () => {
  const cases: [string, string, string][] = [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Safari on iPhone', 'phone'],
    ['Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Safari on iPad', 'tablet'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', 'Chrome on Android phone', 'phone'],
    ['Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 'Chrome on Android tablet', 'tablet'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0', 'Edge on Windows PC', 'computer'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36', 'Chrome on Mac', 'computer'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0', 'Firefox on Linux PC', 'computer'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1', 'Chrome on iPhone', 'phone'],
  ];
  it.each(cases)('%s', (ua, label, kind) => {
    const d = describeDevice(ua);
    expect(d.label).toBe(label);
    expect(d.kind).toBe(kind);
  });
  it('handles missing values', () => {
    expect(describeDevice(null).kind).toBe('unknown');
    expect(describeDevice('curl/8.4').label).toBe('Browser');
  });
});
