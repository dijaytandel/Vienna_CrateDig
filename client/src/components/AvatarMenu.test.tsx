import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AvatarMenu, { type AvatarUser } from './AvatarMenu';

const renderMenu = (user: AvatarUser | null) =>
  render(
    <MemoryRouter>
      <AvatarMenu user={user} />
    </MemoryRouter>,
  );

describe('AvatarMenu', () => {
  it('shows a Log in button to guests', () => {
    renderMenu(null);
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('shows initials and opens Profile for collectors', () => {
    renderMenu({ displayName: 'Dana Diggs', role: 'collector' });
    const avatar = screen.getByRole('button', { name: 'Account menu for Dana Diggs' });
    expect(avatar).toHaveTextContent('DD');
    fireEvent.click(avatar);
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('link', { name: /merchant/i })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: /profile/i })).toBeNull();
  });

  it('adds the Merchant Dashboard for store managers', () => {
    renderMenu({ displayName: 'Sam', role: 'store_manager' });
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('link', { name: /merchant/i })).toHaveAttribute('href', '/merchant');
  });
});
