import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_ROUTES } from '../../app/router';
import { FakeAuth } from '../../test/auth';

const STORE = '00000000-0000-4000-8000-000000000001';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const sighting = (n: number, album: string, storeVerified = false) => ({
  sightingId: `s${n}`,
  priceUsd: 24.5,
  conditionGrade: 'vg_plus',
  specialAttributes: null,
  storeVerified,
  status: 'active',
  sightingTimestamp: new Date(Date.now() - 600_000).toISOString(),
  archiveDate: '2027-05-01T00:00:00Z',
  reporter: { userId: 'u', displayName: 'Dana' },
  record: { recordId: `r${n}`, artistName: 'Artist', albumTitle: album, coverArtUrl: null },
  store: { storeId: STORE, businessName: 'Low End Theory' },
});

const STORE_DETAIL = {
  storeId: STORE,
  businessName: 'Low End Theory',
  isVerified: true,
  streetAddress: '1 Main St',
  city: 'Portland',
  state: 'OR',
  zip: '97205',
  tags: ['Jazz'],
  phone: '(503) 555-0100',
  websiteUrl: null,
  operatingHours: { mon: { open: '10:00', close: '18:00' } },
  timeZone: 'America/Los_Angeles',
  isOpenNow: true,
  paymentMethods: ['Cash'],
  activeSightings: [],
  recentBroadcasts: [],
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/merchant/sightings')) {
      return json({
        storeId: STORE,
        sightings: [
          sighting(1, 'Blue Train'),
          sighting(2, 'Kind of Blue'),
          sighting(3, 'Head Hunters', true),
        ],
      });
    }
    if (url.endsWith('/merchant/broadcasts')) {
      return json({
        storeId: STORE,
        broadcasts: [
          {
            broadcastId: 'b1',
            arrivalSummary: 'Soul 45s',
            photoUrl: null,
            featuredIds: [],
            postedAt: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.includes(`/stores/${STORE}`)) return json(STORE_DETAIL);
    if (url.includes('/sightings/') && init?.method === 'PATCH') return json({});
    if (url.endsWith('/merchant/store') && init?.method === 'PATCH') return json(STORE_DETAIL);
    return json({ error: { code: 'NOT_FOUND', message: 'nope' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(
    <FakeAuth user={{ displayName: 'Mo', role: 'store_manager' }}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
  return router;
}

const patches = () =>
  fetchMock.mock.calls
    .filter(([, i]) => i?.method === 'PATCH')
    .map(([u, i]) => [String(u).replace(/^.*\/api\/v1/, ''), JSON.parse(i.body)]);

describe('/merchant/sightings', () => {
  it('lists unconfirmed first with price, condition and reporter, and sends after 5 s', async () => {
    renderAt('/merchant/sightings');
    const list = await screen.findByRole('list', { name: 'Sightings to verify' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Blue Train');
    expect(list).toHaveTextContent('$24.50');
    expect(list).toHaveTextContent('Dana');
    expect(screen.getByText('2 to review · 3 active')).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Kind of Blue by Artist sold' }));
    expect(screen.queryByText('Kind of Blue')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Marked sold');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Blue Train by Artist' }));
    expect(within(list).getAllByText('✓ Confirmed')).toHaveLength(2);
    expect(patches()).toEqual([]);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(patches()).toEqual([
      ['/sightings/s2', { action: 'mark_sold' }],
      ['/sightings/s1', { action: 'confirm' }],
    ]);
  });

  it('undo cancels the action before it is sent', async () => {
    renderAt('/merchant/sightings');
    await screen.findByRole('list', { name: 'Sightings to verify' });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Flag Blue Train by Artist' }));
    expect(screen.queryByText('Blue Train')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Blue Train')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(patches()).toEqual([]);
  });
});

describe('/merchant', () => {
  it('shows the verified store, pending count, broadcasts and edit link', async () => {
    renderAt('/merchant');
    expect(await screen.findByRole('heading', { name: 'Low End Theory' })).toBeInTheDocument();
    expect(screen.getByText('Verified store')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/merchant/sightings',
    );
    expect(screen.getByRole('link', { name: 'Soul 45s' })).toHaveAttribute(
      'href',
      '/broadcasts/b1',
    );
    expect(screen.getByRole('link', { name: '+ New broadcast' })).toHaveAttribute(
      'href',
      '/merchant/broadcasts/new',
    );
    expect(screen.getByRole('link', { name: 'Edit store profile' })).toHaveAttribute(
      'href',
      '/merchant/store',
    );
  });
});

describe('/merchant/store', () => {
  it('validates the phone and saves hours, contact and tags', async () => {
    renderAt('/merchant/store');
    const phone = await screen.findByLabelText('Phone');
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    fireEvent.change(phone, { target: { value: '555-0100' } });
    expect(screen.getByText('Enter a 10-digit U.S. phone number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(phone, { target: { value: '503 555 0199' } });
    fireEvent.change(screen.getByLabelText('Website'), {
      target: { value: 'https://lowend.test' },
    });
    const tueClosed = screen.getAllByRole('checkbox', { name: 'Closed' })[1];
    fireEvent.click(tueClosed);
    fireEvent.change(screen.getByLabelText('Tuesday closes'), { target: { value: '20:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Saved\./)).toBeInTheDocument();
    const [[path, body]] = patches();
    expect(path).toBe('/merchant/store');
    expect(body).toMatchObject({
      phone: '503 555 0199',
      websiteUrl: 'https://lowend.test',
      paymentMethods: ['Cash'],
      tags: ['Jazz'],
    });
    expect(body.operatingHours).toMatchObject({
      mon: { open: '10:00', close: '18:00' },
      tue: { open: '11:00', close: '20:00' },
      wed: null,
    });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'View your store page' })).toHaveAttribute(
        'href',
        `/stores/${STORE}`,
      ),
    );
  });
});
