import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { APP_ROUTES } from '../app/router';
import type { AvatarUser } from '../components/AvatarMenu';
import { FakeAuth } from '../test/auth';
import { validateSignup } from './validateSignup';

function renderAt(path: string, user: AvatarUser | null = null, signOutError?: string) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(
    <FakeAuth user={user} signOutError={signOutError}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
  return router;
}

async function fillSignup(fields: Record<string, string>) {
  const labels: Record<string, string> = {
    displayName: 'Display name',
    email: 'Email',
    password: 'Password',
    confirm: 'Confirm password',
    zip: 'ZIP code (optional)',
  };
  for (const [name, value] of Object.entries(fields)) {
    fireEvent.change(await screen.findByLabelText(labels[name]), { target: { value } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

const valid = {
  displayName: 'Dana Diggs',
  email: 'd@x.test',
  password: 'crates4ever',
  confirm: 'crates4ever',
};

describe('validateSignup', () => {
  it.each([
    [{ ...valid, displayName: '  ' }, 'Enter a display name.'],
    [{ ...valid, email: '' }, 'Enter a valid email address.'],
    [{ ...valid, email: 'not-an-email' }, 'Enter a valid email address.'],
    [{ ...valid, password: 'short', confirm: 'short' }, 'Use a password of at least 8 characters.'],
    [{ ...valid, confirm: 'different1' }, 'Passwords do not match.'],
    [{ ...valid, zip: '1070' }, 'ZIP code must be exactly 5 digits.'],
    [{ ...valid, zip: '6060a' }, 'ZIP code must be exactly 5 digits.'],
    [{ ...valid, zip: '' }, null],
    [{ ...valid, zip: '60601' }, null],
  ])('%j → %s', (fields, expected) => {
    expect(validateSignup({ zip: '', ...fields })).toBe(expected);
  });
});

describe('sign up', () => {
  it('creates the account and lands on /discover with saved preferences', async () => {
    const router = renderAt('/signup');
    await fillSignup({ ...valid, zip: '94110' });
    expect(await screen.findByRole('heading', { name: 'Discover' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/discover');
    expect(screen.getByTestId('discover-filters')).toHaveTextContent(
      'Within 10 mi of 94110 · Jazz, Soul',
    );
  });

  it('returns to next when signing up from a protected action', async () => {
    const router = renderAt('/login?next=%2Fcrate');
    fireEvent.click(await screen.findByRole('link', { name: 'Create an account' }));
    await fillSignup(valid);
    expect(await screen.findByRole('heading', { name: 'My Crate' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/crate');
  });

  it('shows validation errors inline without submitting', async () => {
    const router = renderAt('/signup');
    await fillSignup({ ...valid, zip: '1070' });
    expect(await screen.findByRole('alert')).toHaveTextContent('exactly 5 digits');
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('reports an email that is already registered', async () => {
    renderAt('/signup');
    await fillSignup({ ...valid, email: 'taken@x.test' });
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });
});

describe('sign out', () => {
  it('clears the session and returns to guest /discover', async () => {
    const router = renderAt('/profile', { displayName: 'Dana Diggs', role: 'collector' });
    expect(await screen.findByText('d@x.test')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Discover' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/discover');
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByTestId('discover-filters')).toBeNull();
  });

  it('stays on Profile with an error when sign-out fails', async () => {
    const router = renderAt(
      '/profile',
      { displayName: 'Dana Diggs', role: 'collector' },
      'Offline',
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    // Discover renders briefly (and may show its own alert) before the failed sign-out returns.
    expect(await screen.findByText('Offline')).toHaveAttribute('role', 'alert');
    expect(router.state.location.pathname).toBe('/profile');
  });
});
