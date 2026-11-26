import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AvatarUser } from '../components/AvatarMenu';

export interface AuthState {
  status: 'loading' | 'ready';
  session: Session | null;
  user: AvatarUser | null;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
}

export const GUEST: AuthState = {
  status: 'ready',
  session: null,
  user: null,
  signIn: async () => ({ error: 'Log in is not available right now.' }),
};

export const AuthContext = createContext<AuthState>(GUEST);

export const useAuth = () => useContext(AuthContext);
