import { describe, expect, it } from 'vitest';
import { snapshot, track } from '../../src/account/sessionLog.ts';

describe('session log counters', () => {
  it('counts actions and never includes anything the user typed', () => {
    track('png');
    track('png');
    track('regenerate');
    const s = snapshot();
    expect(s.png).toBe(2);
    expect(s.regenerate).toBe(1);
    expect(Object.keys(s).sort()).toEqual(['png', 'regenerate']);
  });

  it('returns a copy, so callers cannot change the counters', () => {
    const s = snapshot();
    s.png = 99;
    expect(snapshot().png).toBe(2);
  });
});
