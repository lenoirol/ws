export const MIN_PASSWORD = 8;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CredentialIssue = 'email' | 'passwordShort' | 'passwordMismatch';

/** Client-side checks only; the server enforces its own rules as well. */
export function checkCredentials(email: string, password: string, confirm?: string): CredentialIssue | null {
  if (!EMAIL.test(email.trim())) return 'email';
  if (password.length < MIN_PASSWORD) return 'passwordShort';
  if (confirm !== undefined && confirm !== password) return 'passwordMismatch';
  return null;
}
