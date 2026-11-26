import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AvatarUser } from '../components/AvatarMenu';

export interface Preferences {
  email: string | null;
  defaultZip: string | null;
  radiusMiles: 5 | 10 | 25;
  distanceUnit: 'mi' | 'km';
  genres: string[];
  favoriteStoreIds: string[];
}

export interface SignUpInput {
  displayName: string;
  email: string;
  password: string;
  zip?: string;
}

export type PreferencesPatch = Partial<
  Pick<Preferences, 'defaultZip' | 'radiusMiles' | 'distanceUnit' | 'genres' | 'favoriteStoreIds'>
> & { displayName?: string };

export type AuthResult = { error: string | null; needsConfirmation?: boolean };

export interface AuthState {
  status: 'loading' | 'ready';
  session: Session | null;
  user: AvatarUser | null;
  preferences: Preferences | null;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
  /** Adds or removes a store from the signed-in user's favorite stores. */
  toggleFavoriteStore(storeId: string): Promise<AuthResult>;
  /** Saves profile preferences through `PATCH /me`; screens pick them up immediately. */
  updatePreferences(patch: PreferencesPatch): Promise<AuthResult>;
}

const unavailable = async () => ({ error: 'Accounts are not available right now.' });

export const DEFAULT_PREFERENCES: Preferences = {
  email: null,
  defaultZip: null,
  radiusMiles: 10,
  distanceUnit: 'mi',
  genres: [],
  favoriteStoreIds: [],
};

export const GUEST: AuthState = {
  status: 'ready',
  session: null,
  user: null,
  preferences: null,
  signIn: unavailable,
  signUp: unavailable,
  signOut: async () => ({ error: null }),
  toggleFavoriteStore: unavailable,
  updatePreferences: unavailable,
};

export const AuthContext = createContext<AuthState>(GUEST);

export const useAuth = () => useContext(AuthContext);
