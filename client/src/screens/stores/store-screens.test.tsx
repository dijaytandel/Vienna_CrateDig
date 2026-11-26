import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreDetail, StoreListItem } from '../../api/stores';
import { APP_ROUTES } from '../../app/router';
import type { AvatarUser } from '../../components/AvatarMenu';
import { FakeAuth } from '../../test/auth';
import { formatTime, telHref } from './format';

const COLLECTOR: AvatarUser = { displayName: 'Dana Diggs', role: 'collector' };
const ID = '00000000-0000-4000-8000-000000000001';

const groove: StoreListItem = {
  storeId: ID,
  businessName: 'Groove Merchant Records',
  streetAddress: '1021 SW Morrison St',
  city: 'Portland',
  state: 'OR',
  zip: '97205',
  geoLat: 45.5216,
  geoLng: -122.6826,
  tags: ['Jazz'],
  isVerified: true,
  distance: 1,
};
const spin: StoreListItem = {
  ...groove,
  storeId: '00000000-0000-4000-8000-000000000002',
  businessName: 'Second Spin Vinyl',
  isVerified: false,
  distance: 3.6,
};
const detail: StoreDetail = {
  ...groove,
  phone: '(503) 555-0142',
  websiteUrl: 'https://example.com/groove-merchant',
  operatingHours: { mon: null, thu: { open: '11:00', close: '20:00' } },
  timeZone: 'America/Los_Angeles',
  isOpenNow: true,
  paymentMethods: ['Cash', 'Apple Pay'],
  activeSightings: [
    {
      sightingId: 's1',
      recordId: 'r1',
      artistName: 'Miles Davis',
      albumTitle: 'Kind of Blue',
      genre: 'Jazz',
      coverArtUrl: null,
      priceUsd: 28,
      conditionGrade: 'near_mint',
      specialAttributes: null,
      storeVerified: true,
      sightingTimestamp: '2026-11-25T03:00:00Z',
    },
  ],
  recentBroadcasts: [
    {
      broadcastId: 'b1',
      arrivalSummary: 'Fresh jazz crate',
      photoUrl: null,
      featuredIds: [],
      postedAt: '2026-11-24T18:00:00Z',
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
const requested = () => fetchMock.mock.calls.map(([url]) => String(url));

function setGeolocation(result: 'ok' | 'denied' | 'none') {
  const geolocation =
    result === 'none'
      ? undefined
      : {
          getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) =>
            result === 'ok'
              ? ok({ coords: { latitude: 45.52, longitude: -122.71 } } as GeolocationPosition)
              : fail({ code: 1 } as GeolocationPositionError),
        };
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
}

function renderAt(path: string, user: AvatarUser | null = null) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(
    <FakeAuth user={user}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
  return router;
}

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/stores?')) {
      const radius = new URL(url, 'http://x').searchParams.get('radius');
      return json({ stores: radius === '5' ? [groove] : [groove, spin] });
    }
    if (url.endsWith(`/stores/${ID}`)) return json(detail);
    return json({ error: { code: 'NOT_FOUND', message: 'No store' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('/stores', () => {
  it('lists stores near the GPS location with distance and a verified check', async () => {
    setGeolocation('ok');
    renderAt('/stores');
    const cards = await screen.findAllByRole('link', { name: /Records|Vinyl/ });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Groove Merchant Records');
    expect(cards[0]).toHaveTextContent('1021 SW Morrison St, Portland, OR 97205');
    expect(cards[0]).toHaveTextContent('1.0 mi');
    expect(cards[0]).toHaveAttribute('href', `/stores/${ID}`);
    expect(within(cards[0]!).getByRole('img', { name: 'Verified store' })).toBeInTheDocument();
    expect(within(cards[1]!).queryByRole('img', { name: 'Verified store' })).toBeNull();
    expect(requested()[0]).toContain('lat=45.52000&lng=-122.71000&radius=10&unit=mi');
  });

  it('refetches when a distance pill is chosen', async () => {
    setGeolocation('ok');
    renderAt('/stores');
    await screen.findByText('2 stores near you');
    fireEvent.click(screen.getByRole('radio', { name: 'Within 5 mi' }));
    expect(await screen.findByText('1 store near you')).toBeInTheDocument();
    expect(requested().at(-1)).toContain('radius=5');
  });

  it("falls back to the user's saved ZIP when GPS is denied", async () => {
    setGeolocation('denied');
    renderAt('/stores', COLLECTOR);
    expect(await screen.findByText('2 stores near 60601')).toBeInTheDocument();
    expect(requested()[0]).toContain('zip=60601');
  });

  it('asks guests without GPS for a ZIP and validates it', async () => {
    setGeolocation('none');
    renderAt('/stores');
    const input = screen.getByLabelText('Enter a ZIP code to find stores near you');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '972' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a 5-digit ZIP code.');
    fireEvent.change(input, { target: { value: '97205' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('2 stores near 97205')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    setGeolocation('ok');
    fetchMock.mockImplementation(async () => json({ stores: [] }));
    renderAt('/stores');
    expect(
      await screen.findByText(/No stores within 10 mi\. Try a wider distance\./),
    ).toBeVisible();
  });

  it('explains an unknown ZIP', async () => {
    setGeolocation('none');
    fetchMock.mockImplementation(async () =>
      json({ error: { code: 'ZIP_NOT_FOUND', message: 'No location' } }, 404),
    );
    renderAt('/stores');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '82715' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We don't have a location for ZIP 82715",
    );
  });

  it('shows a network error with retry', async () => {
    setGeolocation('ok');
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderAt('/stores');
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach CrateDig");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2 stores near you')).toBeInTheDocument();
  });
});

describe('/stores/:id', () => {
  it('shows contact links, hours, payments, tags, sightings and broadcasts', async () => {
    renderAt(`/stores/${ID}`);
    expect(
      await screen.findByRole('heading', { name: /Groove Merchant Records/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Open now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Maps' }).getAttribute('href')).toMatch(
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Groove/,
    );
    expect(screen.getByRole('link', { name: '(503) 555-0142' })).toHaveAttribute(
      'href',
      'tel:+15035550142',
    );
    expect(screen.getByRole('link', { name: 'example.com/groove-merchant' })).toHaveAttribute(
      'href',
      'https://example.com/groove-merchant',
    );
    const hours = screen.getByRole('table');
    expect(within(hours).getAllByRole('row')).toHaveLength(7);
    expect(within(hours).getByRole('row', { name: /Monday/ })).toHaveTextContent('Closed');
    expect(within(hours).getByRole('row', { name: /Thursday/ })).toHaveTextContent(
      '11:00 AM – 8:00 PM',
    );
    expect(screen.getByText('Apple Pay')).toBeInTheDocument();
    expect(screen.getByText('Jazz')).toBeInTheDocument();
    const sighting = screen.getByRole('link', { name: /Kind of Blue/ });
    expect(sighting).toHaveTextContent('$28.00');
    expect(sighting).toHaveTextContent('Near Mint');
    expect(sighting).toHaveAttribute('href', '/sightings/s1');
    expect(screen.getByRole('link', { name: /Fresh jazz crate/ })).toHaveAttribute(
      'href',
      '/broadcasts/b1',
    );
  });

  it('lets a signed-in collector favorite and unfavorite the store', async () => {
    renderAt(`/stores/${ID}`, COLLECTOR);
    const button = await screen.findByRole('button', { name: '☆ Add to favorites' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    const saved = await screen.findByRole('button', { name: '★ Favorite' });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(saved);
    expect(await screen.findByRole('button', { name: '☆ Add to favorites' })).toBeVisible();
  });

  it('sends guests who tap favorite to log in and back', async () => {
    const router = renderAt(`/stores/${ID}`);
    fireEvent.click(await screen.findByRole('button', { name: '☆ Add to favorites' }));
    expect(await screen.findByRole('heading', { name: 'Log In' })).toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe(`/stores/${ID}`);
  });

  it('shows not found for an unknown store', async () => {
    renderAt('/stores/nope');
    expect(await screen.findByText("We couldn't find this store.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to stores' })).toHaveAttribute('href', '/stores');
  });
});

describe('format helpers', () => {
  it('formats 24h times and U.S. phone links', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('12:30')).toBe('12:30 PM');
    expect(formatTime('21:00')).toBe('9:00 PM');
    expect(telHref('1-503-555-0142')).toBe('tel:+15035550142');
    expect(telHref('555-0142')).toBeNull();
  });
});
