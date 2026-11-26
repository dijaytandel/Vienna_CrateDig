import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ROUTES } from '../app/router';
import { useAuth } from '../auth/context';
import { FakeAuth } from '../test/auth';

const S1 = '00000000-0000-4000-8000-000000000001';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes(`/stores/${S1}`))
        return json({ storeId: S1, businessName: 'Low End Theory' });
      if (url.endsWith('/merchant/verification')) return json({ claim: null });
      return json({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const { preferences, user, toggleFavoriteStore } = useAuth();
  return (
    <>
      <output data-testid="probe">
        {user?.displayName}|{preferences?.defaultZip}|{preferences?.radiusMiles}|
        {preferences?.distanceUnit}|{preferences?.genres.join(',')}
      </output>
      <button type="button" onClick={() => void toggleFavoriteStore(S1)}>
        seed favorite
      </button>
    </>
  );
}

function renderProfile() {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: ['/profile'] });
  render(
    <FakeAuth user={{ displayName: 'Dana', role: 'collector' }}>
      <RouterProvider router={router} />
      <Probe />
    </FakeAuth>,
  );
}

describe('/profile preferences', () => {
  it('saves name, ZIP, radius, unit and genres into the shared auth state', async () => {
    renderProfile();
    const zip = await screen.findByLabelText('Home ZIP');
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Dana D' } });
    fireEvent.change(zip, { target: { value: '9720' } });
    expect(screen.getByText('Enter a 5-digit ZIP code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled();
    fireEvent.change(zip, { target: { value: '97205' } });
    fireEvent.click(screen.getByRole('radio', { name: '25 mi' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Kilometers' }));
    const genre = screen.getByLabelText('Favorite genres');
    fireEvent.change(genre, { target: { value: 'Funk' } });
    fireEvent.keyDown(genre, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('Dana D|97205|25|km|Jazz,Soul,Funk');
  });

  it('lists favorite stores and removes one', async () => {
    renderProfile();
    expect(await screen.findByText(/No favorites yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'seed favorite' }));
    expect(await screen.findByRole('link', { name: 'Low End Theory' })).toHaveAttribute(
      'href',
      `/stores/${S1}`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Low End Theory from favorites' }));
    await waitFor(() => expect(screen.getByText(/No favorites yet/)).toBeInTheDocument());
  });

  it('links to store manager verification', async () => {
    renderProfile();
    expect(await screen.findByRole('link', { name: 'Become a store manager' })).toHaveAttribute(
      'href',
      '/merchant/verify',
    );
  });
});
