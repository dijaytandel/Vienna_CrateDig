import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sighting } from '../../api/sightings';
import { APP_ROUTES } from '../../app/router';
import type { AvatarUser } from '../../components/AvatarMenu';
import { enqueue, flushQueue, readQueue } from '../../offline/queue';
import { FakeAuth } from '../../test/auth';

const COLLECTOR: AvatarUser = { displayName: 'Dana Diggs', role: 'collector' };
const REC = '00000000-0000-4000-9000-000000000001';
const NEAR = '00000000-0000-4000-8000-000000000001';
const FAR = '00000000-0000-4000-8000-000000000002';
const SID = '00000000-0000-4000-b000-000000000001';

const record = {
  recordId: REC,
  apiSourceId: 'discogs:1',
  artistName: 'Miles Davis',
  albumTitle: 'Kind of Blue',
  songTitle: null,
  recordLabel: null,
  releaseYear: 1959,
  genre: 'Jazz',
  coverArtUrl: null,
};
const store = (storeId: string, businessName: string, distance: number, isVerified = true) => ({
  storeId,
  businessName,
  streetAddress: '1 Main St',
  city: 'Portland',
  state: 'OR',
  zip: '97205',
  geoLat: 45.5,
  geoLng: -122.6,
  tags: [],
  isVerified,
  distance,
});
const sighting: Sighting = {
  sightingId: SID,
  priceUsd: 28,
  conditionGrade: 'near_mint',
  specialAttributes: '180g, Remaster',
  storeVerified: true,
  status: 'active',
  sightingTimestamp: new Date().toISOString(),
  archiveDate: '2027-05-24T12:00:00Z',
  reporter: { userId: 'u1', displayName: 'Dana Diggs' },
  record,
  store: store(NEAR, 'Groove Merchant', 0),
  distance: 1.3,
  unit: 'mi',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn>;
let offline = false;
const posts = () =>
  fetchMock.mock.calls.filter(([u, i]) => String(u).includes('/sightings') && i?.method === 'POST');

function renderAt(path: string, user: AvatarUser | null = COLLECTOR) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(
    <FakeAuth user={user}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
  return router;
}

const gps = (on: boolean) =>
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: on
      ? {
          getCurrentPosition: (ok: PositionCallback) =>
            ok({ coords: { latitude: 45.52, longitude: -122.68 } } as GeolocationPosition),
        }
      : undefined,
  });

beforeEach(() => {
  localStorage.clear();
  offline = false;
  gps(true);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (offline) throw new TypeError('Failed to fetch');
    if (url.includes('/stores/nearest'))
      return json({ store: store(NEAR, 'Groove Merchant', 0.4), unit: 'mi' });
    if (url.includes('/stores?'))
      return json({
        stores: [store(NEAR, 'Groove Merchant', 0.4), store(FAR, 'Far Records', 3.2, false)],
      });
    if (url.includes(`/records/${REC}`))
      return json({ ...record, unit: 'mi', activeSightings: [] });
    if (url.includes('/sightings') && init?.method === 'POST') return json(sighting, 201);
    if (url.includes(`/sightings/${SID}`)) return json(sighting);
    return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function walkToSubmit() {
  expect(await screen.findByText('Kind of Blue')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(NEAR));
  expect(screen.getByText('Nearest store selected from your location.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'VG+' }));
}

describe('/report', () => {
  it('pre-selects the nearest store from GPS and submits a prefilled album', async () => {
    const router = renderAt(`/report?recordId=${REC}`);
    await walkToSubmit();
    fireEvent.change(screen.getByPlaceholderText('24.99'), { target: { value: '19.99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit sighting' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/sightings/${SID}`));
    const [, init] = posts()[0];
    expect(JSON.parse(init.body)).toEqual({
      recordId: REC,
      storeId: NEAR,
      conditionGrade: 'vg_plus',
      priceUsd: 19.99,
      specialAttributes: [],
    });
    expect(new Headers(init.headers).get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(
      await screen.findByText('Thanks! Your sighting is live on Discover.'),
    ).toBeInTheDocument();
  });

  it('lets the user override the store and lists unverified stores', async () => {
    renderAt(`/report?recordId=${REC}`);
    expect(await screen.findByText('Kind of Blue')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByRole('option', { name: /Far Records — 3.2 mi \(unverified\)/ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: FAR } });
    expect(screen.getByRole('combobox')).toHaveValue(FAR);
  });

  it('sorts stores by the saved ZIP when GPS is unavailable, and accepts another ZIP', async () => {
    gps(false);
    renderAt(`/report?recordId=${REC}`);
    expect(await screen.findByText('Kind of Blue')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('zip=60601'))).toBe(true),
    );
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/stores/nearest'))).toBe(false);
    fireEvent.change(screen.getByLabelText('Stores near a different ZIP'), {
      target: { value: '97205' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use ZIP' }));
    expect(await screen.findByRole('option', { name: /Groove Merchant/ })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('zip=97205'))).toBe(true);
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('asks guests without GPS for a ZIP', async () => {
    gps(false);
    renderAt(`/report?recordId=${REC}`, null);
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });

  it('rejects an invalid price', async () => {
    renderAt(`/report?recordId=${REC}`);
    await walkToSubmit();
    fireEvent.change(screen.getByPlaceholderText('24.99'), { target: { value: '12.345' } });
    expect(screen.getByText('Enter a dollar amount like 24.99')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit sighting' })).toBeNull();
  });

  it('queues the report while offline and sends it on reconnect', async () => {
    const router = renderAt(`/report?recordId=${REC}`);
    await walkToSubmit();
    offline = true;
    fireEvent.click(screen.getByRole('button', { name: 'Submit sighting' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'));
    expect(readQueue()).toHaveLength(1);
    const key = readQueue()[0].action.idempotencyKey;
    offline = false;
    expect(await flushQueue()).toEqual({ sent: 1, failed: 0 });
    expect(readQueue()).toHaveLength(0);
    expect(new Headers(posts().at(-1)![1].headers).get('Idempotency-Key')).toBe(key);
  });

  it('sends queued reports when the app opens and when it comes back online', async () => {
    const body = { recordId: REC, storeId: NEAR, conditionGrade: 'vg' as const, priceUsd: null };
    enqueue({ kind: 'report_sighting', body, idempotencyKey: 'k1' });
    renderAt('/discover');
    await waitFor(() => expect(readQueue()).toHaveLength(0));
    enqueue({ kind: 'report_sighting', body, idempotencyKey: 'k2' });
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(readQueue()).toHaveLength(0));
    expect(posts()).toHaveLength(2);
  });

  it('does not keep a prefilled store the collector cannot see', async () => {
    renderAt(`/report?recordId=${REC}&storeId=00000000-0000-4000-8000-0000000000ff`);
    expect(await screen.findByText('Kind of Blue')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('option', { name: /Groove Merchant/ });
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('/sightings/:id', () => {
  it('shows price, condition, status, verification, reporter and archive date', async () => {
    renderAt(`/sightings/${SID}`, null);
    expect(await screen.findByText('$28.00')).toBeInTheDocument();
    expect(screen.getByText('Near Mint')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Verified by store')).toBeInTheDocument();
    expect(screen.getByText(/by Dana Diggs/)).toBeInTheDocument();
    expect(screen.getByText('180g')).toBeInTheDocument();
    expect(screen.getByText(/2027/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Album details' })).toHaveAttribute(
      'href',
      `/albums/${REC}`,
    );
  });

  it('sends guests to login before reporting it again', async () => {
    const router = renderAt(`/sightings/${SID}`, null);
    fireEvent.click(await screen.findByRole('button', { name: 'Report it again' }));
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toContain(encodeURIComponent(`storeId=${NEAR}`));
  });

  it('opens a prefilled report for collectors', async () => {
    const router = renderAt(`/sightings/${SID}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Report it again' }));
    expect(router.state.location.pathname).toBe('/report');
    expect(router.state.location.search).toBe(`?recordId=${REC}&storeId=${NEAR}`);
  });
});
