import { apiSend, errorText, setAccessToken } from '../api/client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

interface ServerProfile {
  displayName: string;
  defaultZip: string | null;
  radiusMiles: Preferences['radiusMiles'];
  distanceUnit: Preferences['distanceUnit'];
  genres: string[];
  favoriteStoreIds: string[];
}

interface Account {
  user: AvatarUser;
  preferences: Preferences;
}

async function loadAccount(client: SupabaseClient, session: Session): Promise<Account> {
  const { data } = await client
    .from('profiles')
    .select(
      'display_name, user_role, default_zip, default_radius_miles, distance_unit, genre_preferences, favorite_store_ids',
    )
    .eq('user_id', session.user.id)
    .maybeSingle();
  const meta = session.user.user_metadata as { display_name?: string; default_zip?: string };
  const metaZip = /^\d{5}$/.test(meta.default_zip ?? '') ? meta.default_zip! : null;
  return {
    user: {
      displayName:
        data?.display_name ?? meta.display_name ?? session.user.email?.split('@')[0] ?? 'Digger',
      role: data?.user_role === 'store_manager' ? 'store_manager' : 'collector',
    },
    preferences: {
      email: session.user.email ?? null,
      // A saved profile row wins even when its ZIP was cleared; signup metadata only covers a failed read.
      defaultZip: data ? data.default_zip : (metaZip ?? DEFAULT_PREFERENCES.defaultZip),
      radiusMiles: data?.default_radius_miles ?? DEFAULT_PREFERENCES.radiusMiles,
      distanceUnit: data?.distance_unit ?? DEFAULT_PREFERENCES.distanceUnit,
      genres: data?.genre_preferences ?? DEFAULT_PREFERENCES.genres,
      favoriteStoreIds: data?.favorite_store_ids ?? DEFAULT_PREFERENCES.favoriteStoreIds,
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
  // Bumped on every auth change so a slow profile lookup can't overwrite a newer state.
  const generation = useRef(0);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let current = true;
    const apply = async (next: Session | null) => {
      const mine = ++generation.current;
      const nextAccount = next ? await loadAccount(client, next) : null;
      if (!current || mine !== generation.current) return;
      userId.current = next?.user.id ?? null;
      setAccessToken(next?.access_token ?? null);
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
        const { error } = await client.auth.signOut();
        if (error) return { error: 'Could not sign out. Check your connection and try again.' };
        generation.current++;
        userId.current = null;
        setSession(null);
        setAccount(null);
        setStatus('ready');
        return { error: null };
      },
      async toggleFavoriteStore(storeId) {
        if (!session || !account) return { error: 'Log in to save favorite stores.' };
        const current = account.preferences.favoriteStoreIds;
        const next = current.includes(storeId)
          ? current.filter((id) => id !== storeId)
          : [...current, storeId];
        const { error } = await client
          .from('profiles')
          .update({ favorite_store_ids: next })
          .eq('user_id', session.user.id);
        if (error) return { error: 'Could not update your favorite stores. Try again.' };
        // The user signed out or switched accounts while the write was in flight.
        if (userId.current !== session.user.id) return { error: null };
        setAccount((a) => a && { ...a, preferences: { ...a.preferences, favoriteStoreIds: next } });
        return { error: null };
      },
      async updatePreferences(patch) {
        if (!session || !account) return { error: 'Log in to save your preferences.' };
        try {
          const me = await apiSend<ServerProfile>('PATCH', '/me', patch);
          if (userId.current !== session.user.id) return { error: null };
          setAccount(
            (a) =>
              a && {
                user: { ...a.user, displayName: me.displayName },
                preferences: {
                  ...a.preferences,
                  defaultZip: me.defaultZip,
                  radiusMiles: me.radiusMiles,
                  distanceUnit: me.distanceUnit,
                  genres: me.genres,
                  favoriteStoreIds: me.favoriteStoreIds,
                },
              },
          );
          return { error: null };
        } catch (err) {
          return { error: errorText(err) };
        }
      },
    };
  }, [client, status, session, account]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
