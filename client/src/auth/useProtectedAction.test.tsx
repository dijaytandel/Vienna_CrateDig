import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FakeAuth } from '../test/auth';
import { useProtectedAction } from './useProtectedAction';

function AddToCrate({ onAdd }: { onAdd: () => void }) {
  const protect = useProtectedAction();
  return <button onClick={() => protect(onAdd)}>Add to crate</button>;
}

function setup(signedIn: boolean) {
  const onAdd = vi.fn();
  const router = createMemoryRouter(
    [
      { path: '/albums/:id', element: <AddToCrate onAdd={onAdd} /> },
      { path: '/login', element: <p>login</p> },
    ],
    { initialEntries: ['/albums/42'] },
  );
  render(
    <FakeAuth user={signedIn ? { displayName: 'D', role: 'collector' } : null}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add to crate' }));
  return { onAdd, router };
}

describe('useProtectedAction', () => {
  it('sends guests to log in with next set to the current page', () => {
    const { onAdd, router } = setup(false);
    expect(onAdd).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('?next=%2Falbums%2F42');
  });

  it('runs the action for signed-in users', () => {
    const { onAdd, router } = setup(true);
    expect(onAdd).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe('/albums/42');
  });
});
