import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { beat, setAccessToken } from './sessionLog.ts';
import { supabase } from './supabase.ts';

export type Role = 'user' | 'admin';

export interface Account {
  /** False when the build has no backend: the app then works exactly as a guest-only tool. */
  enabled: boolean;
  user: { id: string; email: string; name: string } | null;
  role: Role | null;
  /** True when a new password must be chosen: after a reset link, or after an admin reset the password. */
  recovering: boolean;
  /** An administrator reset this account's password, so the new password is the default one. */
  mustChangePassword: boolean;
  /** The signed-in account's role and flags have been loaded, so decisions that depend on them can be made. */
  profileReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<'signedIn' | 'confirmEmail'>;
  signOut: () => Promise<void>;
  /** Asks the administrators to reset the password. Nothing is emailed. */
  requestReset: (email: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  endRecovery: () => void;
}

const here = () => `${window.location.origin}${window.location.pathname}`;

function client() {
  if (!supabase) throw new Error('Accounts are not available in this build.');
  return supabase;
}

export function useAccount(): Account {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [recoveryLink, setRecoveryLink] = useState(false);
  const [mustChange, setMustChange] = useState(false);
  const [forcedDismissed, setForcedDismissed] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    // Fires once with the stored session, then on every sign-in, sign-out and token refresh.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setAccessToken(session?.access_token ?? null);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecoveryLink(true);
      // Deferred: supabase-js must not be re-entered from inside this callback.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => void beat().catch(() => undefined), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (!supabase || !userId) {
      setRole(null);
      setMustChange(false);
      setForcedDismissed(false);
      setProfileReady(false);
      return;
    }
    let live = true;
    void supabase
      .from('profiles')
      .select('role, must_change_password')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        setRole(data?.role === 'admin' ? 'admin' : 'user');
        setMustChange(data?.must_change_password === true);
        setProfileReady(true);
      }, () => live && setProfileReady(true));
    return () => { live = false; };
  }, [userId]);

  return {
    enabled: supabase !== null,
    user: user ? { id: user.id, email: user.email ?? '', name: String(user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? '') } : null,
    role,
    recovering: recoveryLink || (mustChange && !forcedDismissed),
    mustChangePassword: mustChange,
    profileReady,
    signIn: async (email, password) => {
      const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message);
    },
    signUp: async (email, password, name) => {
      const { data, error } = await client().auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() || undefined }, emailRedirectTo: here() },
      });
      if (error) throw new Error(error.message);
      return data.session ? 'signedIn' : 'confirmEmail';
    },
    signOut: async () => {
      const { error } = await client().auth.signOut();
      if (error) throw new Error(error.message);
    },
    requestReset: async (email) => {
      const { error } = await client().rpc('request_password_reset', { p_email: email.trim(), p_user_agent: navigator.userAgent });
      if (error) throw new Error(error.message);
    },
    setNewPassword: async (password) => {
      const { error } = await client().auth.updateUser({ password });
      if (error) throw new Error(error.message);
      if (mustChange) {
        await client().rpc('clear_must_change_password');
        setMustChange(false);
      }
      setRecoveryLink(false);
    },
    // Closing the prompt only postpones it: the flag stays until a new password is saved.
    endRecovery: () => {
      setRecoveryLink(false);
      setForcedDismissed(true);
    },
  };
}
