import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AvatarUser } from '../components/AvatarMenu';
import {
  AuthContext,
  DEFAULT_PREFERENCES,
  GUEST,
  type AuthState,
  type Preferences,
} from './context';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// supabase-js keeps the session in localStorage and refreshes it, so it survives reloads.
const defaultClient = url && anonKey ? createClient(url, anonKey) : null;

interface Account {
  user: AvatarUser;
  preferences: Preferences;
}

async function loadAccount(client: SupabaseClient, session: Session): Promise<Account> {
  const { data } = await client
    .from('profiles')
    .select(
      'display_name, user_role, default_zip, default_radius_miles, distance_unit, genre_preferences',
    )
    .eq('user_id', session.user.id)
    .maybeSingle();
  const meta = session.user.user_metadata as { display_name?: string };
  return {
    user: {
      displayName:
        data?.display_name ?? meta.display_name ?? session.user.email?.split('@')[0] ?? 'Digger',
      role: data?.user_role === 'store_manager' ? 'store_manager' : 'collector',
    },
    preferences: {
      email: session.user.email ?? null,
      defaultZip: data?.default_zip ?? DEFAULT_PREFERENCES.defaultZip,
      radiusMiles: data?.default_radius_miles ?? DEFAULT_PREFERENCES.radiusMiles,
      distanceUnit: data?.distance_unit ?? DEFAULT_PREFERENCES.distanceUnit,
      genres: data?.genre_preferences ?? DEFAULT_PREFERENCES.genres,
    },
  };
}

export default function AuthProvider({
  children,
  client = defaultClient,
}: {
  children: ReactNode;
  client?: SupabaseClient | null;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<AuthState['status']>(client ? 'loading' : 'ready');

  useEffect(() => {
    if (!client) return;
    let current = true;
    const apply = async (next: Session | null) => {
      const nextAccount = next ? await loadAccount(client, next) : null;
      if (!current) return;
      setSession(next);
      setAccount(nextAccount);
      setStatus('ready');
    };
    client.auth.getSession().then(({ data }) => apply(data.session));
    // Supabase advises against awaiting other Supabase calls inside this callback.
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setTimeout(() => void apply(next), 0);
    });
    return () => {
      current = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthState>(() => {
    if (!client) return GUEST;
    return {
      status,
      session,
      user: account?.user ?? null,
      preferences: account?.preferences ?? null,
      async signIn(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        return { error: error ? 'Email or password is incorrect.' : null };
      },
      async signUp({ displayName, email, password, zip }) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName, default_zip: zip || null } },
        });
        if (error) {
          return {
            error:
              error.code === 'user_already_exists'
                ? 'An account with this email already exists.'
                : error.message,
          };
        }
        return { error: null, needsConfirmation: !data.session };
      },
      async signOut() {
        await client.auth.signOut();
        setSession(null);
        setAccount(null);
      },
    };
  }, [client, status, session, account]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
