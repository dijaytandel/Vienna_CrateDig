import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { AvatarUser } from '../components/AvatarMenu';
import { FakeAuth } from '../test/auth';
import { APP_ROUTES } from './router';
import { SCREEN_ROUTES } from './routes';

const COLLECTOR: AvatarUser = { displayName: 'Dana Diggs', role: 'collector' };
const MANAGER: AvatarUser = { displayName: 'Sam Shop', role: 'store_manager' };

function renderAt(path: string, user: AvatarUser | null = null) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(
    <FakeAuth user={user}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
  return router;
}

const concrete = (path: string) => path.replace(':id', 'abc');
const byAccess = (access: string) =>
  SCREEN_ROUTES.filter((r) => r.access === access).map((r) => [concrete(r.path), r.title]);

describe('router', () => {
  it('redirects / to /discover with no login wall', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Discover' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/discover');
  });

  it.each(byAccess('guest'))('lets guests open %s', async (path, title) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  it.each([...byAccess('collector'), ...byAccess('store_manager')])(
    'sends guests from %s to log in',
    async (path) => {
      const router = renderAt(`${path}?tab=x`);
      expect(await screen.findByRole('heading', { name: 'Log In' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/login');
      expect(new URLSearchParams(router.state.location.search).get('next')).toBe(`${path}?tab=x`);
    },
  );

  it.each(byAccess('collector'))('lets collectors open %s', async (path, title) => {
    renderAt(path, COLLECTOR);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  it.each(byAccess('store_manager'))('lets store managers open %s', async (path, title) => {
    renderAt(path, MANAGER);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('sends collectors from merchant screens to verification', async () => {
    const router = renderAt('/merchant', COLLECTOR);
    expect(await screen.findByRole('heading', { name: 'Verify as Store Manager' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/merchant/verify');
  });

  it('returns to next after logging in', async () => {
    const router = renderAt('/report');
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'd@x.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('heading', { name: 'Report a Sighting' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/report');
    expect(screen.getByRole('button', { name: /account menu for dana diggs/i })).toBeVisible();
  });

  it('shows an inline error for bad credentials', async () => {
    renderAt('/login');
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'd@x.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('offers account, log in and guest options on /welcome', async () => {
    renderAt('/welcome');
    expect(await screen.findByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('link', { name: /keep digging as a guest/i })).toHaveAttribute(
      'href',
      '/discover',
    );
  });

  it('shows 404 for unknown routes', async () => {
    renderAt('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('renders the five bottom tabs', async () => {
    renderAt('/discover');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(nav.querySelectorAll('a')).toHaveLength(5);
  });

  it('highlights the active tab', async () => {
    renderAt('/stores/abc');
    const stores = await screen.findByRole('link', { name: /Stores/ });
    expect(stores).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Search/ })).not.toHaveAttribute('aria-current');
  });
});
