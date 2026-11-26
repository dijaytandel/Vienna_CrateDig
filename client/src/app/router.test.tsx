import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { APP_ROUTES } from './router';
import { SCREEN_ROUTES } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('router', () => {
  it('redirects / to /discover', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Discover' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/discover');
  });

  it.each(SCREEN_ROUTES.map((r) => [r.path.replace(':id', 'abc'), r.title]))(
    'resolves %s',
    async (path, title) => {
      renderAt(path);
      expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    },
  );

  it('shows 404 for unknown routes', async () => {
    renderAt('/nope');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('renders the five bottom tabs', async () => {
    renderAt('/discover');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(nav.querySelectorAll('a')).toHaveLength(5);
  });
});
