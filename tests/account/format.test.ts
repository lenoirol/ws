import { describe, expect, it } from 'vitest';
import { formatDuration } from '../../src/account/duration.ts';
import { describeAgent } from '../../src/account/userAgent.ts';

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
