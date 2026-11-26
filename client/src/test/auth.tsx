import { useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext, GUEST, type AuthState } from '../auth/context';
import type { AvatarUser } from '../components/AvatarMenu';

const fakeSession = { user: { id: 'u1' } } as Session;

/** In-memory auth for tests; `password` is the only accepted password. */
export function FakeAuth({
  children,
  user = null,
}: {
  children: ReactNode;
  user?: AvatarUser | null;
}) {
  const [current, setCurrent] = useState(user);
  const value: AuthState = {
    ...GUEST,
    session: current ? fakeSession : null,
    user: current,
    async signIn(_email, password) {
      if (password !== 'password') return { error: 'Email or password is incorrect.' };
      setCurrent({ displayName: 'Dana Diggs', role: 'collector' });
      return { error: null };
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
