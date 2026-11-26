import { useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AuthContext,
  DEFAULT_PREFERENCES,
  GUEST,
  type AuthState,
  type Preferences,
} from '../auth/context';
import type { AvatarUser } from '../components/AvatarMenu';

const fakeSession = { user: { id: 'u1' } } as Session;

/**
 * In-memory auth for tests: `password` is the only accepted login password and
 * `taken@x.test` is already registered.
 */
export function FakeAuth({
  children,
  user = null,
  signOutError = null,
}: {
  children: ReactNode;
  user?: AvatarUser | null;
  signOutError?: string | null;
}) {
  const [current, setCurrent] = useState(user);
  const [zip, setZip] = useState<string | null>('60601');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Partial<Preferences>>({});
  const value: AuthState = {
    ...GUEST,
    session: current ? fakeSession : null,
    user: current,
    preferences: current
      ? {
          ...DEFAULT_PREFERENCES,
          email: 'd@x.test',
          defaultZip: zip,
          genres: ['Jazz', 'Soul'],
          favoriteStoreIds: favorites,
          ...prefs,
        }
      : null,
    async signIn(_email, password) {
      if (password !== 'password') return { error: 'Email or password is incorrect.' };
      setCurrent({ displayName: 'Dana Diggs', role: 'collector' });
      return { error: null };
    },
    async signUp({ displayName, email, zip: newZip }) {
      if (email === 'taken@x.test') return { error: 'An account with this email already exists.' };
      setZip(newZip ?? null);
      setCurrent({ displayName, role: 'collector' });
      return { error: null };
    },
    async signOut() {
      if (signOutError) return { error: signOutError };
      setCurrent(null);
      return { error: null };
    },
    async updatePreferences({ displayName, favoriteStoreIds, ...rest }) {
      if (displayName && current) setCurrent({ ...current, displayName });
      if (favoriteStoreIds) setFavorites(favoriteStoreIds);
      setPrefs((p) => ({ ...p, ...rest }));
      return { error: null };
    },
    async toggleFavoriteStore(storeId) {
      setFavorites((f) =>
        f.includes(storeId) ? f.filter((id) => id !== storeId) : [...f, storeId],
      );
      return { error: null };
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
