import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { APP_ROUTES } from '../../app/router';
import { FakeAuth } from '../../test/auth';

const STORE = '00000000-0000-4000-8000-000000000002';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockApi(claim: unknown) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/merchant/verification') && init?.method === 'POST') {
      return json(
        {
          claim: {
            storeId: STORE,
            businessName: 'Spin City',
            city: 'Portland',
            state: 'OR',
            status: 'pending',
            licenseDocUrl: JSON.parse(String(init.body)).licenseDocUrl,
          },
        },
        201,
      );
    }
    if (url.endsWith('/merchant/verification')) return json({ claim });
    if (url.endsWith('/merchant/claimable-stores')) {
      return json({
        stores: [
          {
            storeId: STORE,
            businessName: 'Spin City',
            city: 'Portland',
            state: 'OR',
            zip: '97214',
          },
        ],
      });
    }
    return json({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(
    <FakeAuth user={{ displayName: 'Dana', role: 'collector' }}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
}

describe('/merchant/verify', () => {
  it('submits a store and https license URL, then shows Pending', async () => {
    const fetchMock = mockApi(null);
    renderAt('/merchant/verify');
    const select = await screen.findByLabelText('Store');
    const submit = screen.getByRole('button', { name: 'Submit for review' });
    fireEvent.change(select, { target: { value: STORE } });
    fireEvent.change(screen.getByLabelText('Business license URL'), {
      target: { value: 'http://license.test/1' },
    });
    expect(screen.getByText('License link must start with https://')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Business license URL'), {
      target: { value: 'https://license.test/1' },
    });
    fireEvent.click(submit);
    expect(await screen.findByText('Pending')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      storeId: STORE,
      licenseDocUrl: 'https://license.test/1',
    });
  });

  it.each([
    ['rejected', 'Rejected', true],
    ['verified', 'Verified', false],
  ])('shows a %s claim', async (status, label, canReapply) => {
    mockApi({
      storeId: STORE,
      businessName: 'Spin City',
      city: 'Portland',
      state: 'OR',
      status,
      licenseDocUrl: null,
    });
    renderAt('/merchant/verify');
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(!!screen.queryByRole('button', { name: 'Submit for review' })).toBe(canReapply);
  });

  it('shows the status on Profile', async () => {
    mockApi({
      storeId: STORE,
      businessName: 'Spin City',
      city: 'Portland',
      state: 'OR',
      status: 'pending',
      licenseDocUrl: null,
    });
    renderAt('/profile');
    expect(await screen.findByText(/Store verification:/)).toHaveTextContent('Pending · Spin City');
  });
});
