import { describe, expect, it } from 'vitest';
import { checkCredentials, MIN_PASSWORD } from '../../src/account/validate.ts';

describe('checkCredentials', () => {
  const good = 'a'.repeat(MIN_PASSWORD);

  it('accepts a valid email and password', () => {
    expect(checkCredentials('teacher@school.edu', good)).toBeNull();
    expect(checkCredentials('  teacher@school.edu  ', good)).toBeNull();
  });

  it('rejects malformed emails', () => {
    for (const bad of ['', 'plain', 'a@b', '@b.co', 'a b@c.de']) {
      expect(checkCredentials(bad, good)).toBe('email');
    }
  });

  it('rejects short passwords', () => {
    expect(checkCredentials('a@b.co', 'a'.repeat(MIN_PASSWORD - 1))).toBe('passwordShort');
  });

  it('checks the confirmation only when one is given', () => {
    expect(checkCredentials('a@b.co', good, good)).toBeNull();
    expect(checkCredentials('a@b.co', good, good + 'x')).toBe('passwordMismatch');
  });

  it('reports the email first when several things are wrong', () => {
    expect(checkCredentials('nope', 'x', 'y')).toBe('email');
  });
});
