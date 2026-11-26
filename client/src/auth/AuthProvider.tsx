import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AvatarUser } from '../components/AvatarMenu';
import { AuthContext, GUEST, type AuthState } from './context';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const defaultClient = url && anonKey ? createClient(url, anonKey) : null;

async function loadUser(client: SupabaseClient, session: Session): Promise<AvatarUser> {
  const { data } = await client
    .from('profiles')
    .select('display_name, user_role')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const meta = session.user.user_metadata as { display_name?: string };
  return {
    displayName:
      data?.display_name ?? meta.display_name ?? session.user.email?.split('@')[0] ?? 'Digger',
    role: data?.user_role === 'store_manager' ? 'store_manager' : 'collector',
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
  const [user, setUser] = useState<AvatarUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>(client ? 'loading' : 'ready');

  useEffect(() => {
    if (!client) return;
    let current = true;
    const apply = async (next: Session | null) => {
      const nextUser = next ? await loadUser(client, next) : null;
      if (!current) return;
      setSession(next);
      setUser(nextUser);
      setStatus('ready');
    };
    client.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      void apply(next);
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
      user,
      async signIn(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        return { error: error ? 'Email or password is incorrect.' : null };
      },
    };
  }, [client, status, session, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
