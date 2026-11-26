import { act, render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import AuthProvider from './AuthProvider';
import { useAuth, type AuthState } from './context';

const session = {
  user: { id: 'u1', email: 'dana@x.test', user_metadata: { display_name: 'Meta Name' } },
} as unknown as Session;

function mockClient(stored: Session | null, profile: Record<string, unknown> | null = null) {
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: stored } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(async () => ({ error: { message: 'Invalid login credentials' } })),
    signUp: vi.fn(async () => ({
      data: { session: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const maybeSingle = vi.fn(async () => ({ data: profile }));
  const client = { auth, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) };
  return { client: client as unknown as SupabaseClient, auth };
}

const latest: { current: AuthState | null } = { current: null };
function Probe() {
  const auth = useAuth();
  useEffect(() => {
    latest.current = auth;
  });
  return <p>{auth.status === 'ready' ? (auth.user?.displayName ?? 'guest') : 'loading'}</p>;
}
const state = new Proxy({} as AuthState, {
  get: (_, key) => latest.current![key as keyof AuthState],
});

describe('AuthProvider', () => {
  it('restores a stored session on load with profile preferences', async () => {
    const { client } = mockClient(session, {
      display_name: 'Dana Diggs',
      user_role: 'store_manager',
      default_zip: '60601',
      default_radius_miles: 25,
      distance_unit: 'km',
      genre_preferences: ['Jazz'],
    });
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('Dana Diggs')).toBeInTheDocument();
    expect(state.user?.role).toBe('store_manager');
    expect(state.preferences).toEqual({
      email: 'dana@x.test',
      defaultZip: '60601',
      radiusMiles: 25,
      distanceUnit: 'km',
      genres: ['Jazz'],
    });
  });

  it('falls back to metadata and defaults when the profile is unreadable', async () => {
    const { client } = mockClient(session);
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    );
    expect(await screen.findByText('Meta Name')).toBeInTheDocument();
    expect(state.preferences?.radiusMiles).toBe(10);
  });

  it('maps auth errors and signs out', async () => {
    const { client, auth } = mockClient(session);
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>,
    );
    await screen.findByText('Meta Name');
    expect(await state.signIn('a@x.test', 'nope')).toEqual({
      error: 'Email or password is incorrect.',
    });
    expect(
      await state.signUp({ displayName: 'D', email: 'a@x.test', password: 'p', zip: '60601' }),
    ).toEqual({ error: 'An account with this email already exists.' });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'a@x.test',
      password: 'p',
      options: { data: { display_name: 'D', default_zip: '60601' } },
    });
    await act(() => state.signOut());
    await waitFor(() => expect(screen.getByText('guest')).toBeInTheDocument());
    expect(auth.signOut).toHaveBeenCalled();
  });
});
