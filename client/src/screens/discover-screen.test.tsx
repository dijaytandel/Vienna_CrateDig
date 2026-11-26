import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastDetail, FeedItem } from '../api/feed';
import { APP_ROUTES } from '../app/router';
import type { AvatarUser } from '../components/AvatarMenu';
import { FakeAuth } from '../test/auth';

const COLLECTOR: AvatarUser = { displayName: 'Dana Diggs', role: 'collector' };
const BID = '00000000-0000-4000-c000-000000000001';

const sighting = (n: number, isForYou = false): FeedItem => ({
  type: 'sighting',
  id: `s${n}`,
  postedAt: new Date(Date.now() - n * 3_600_000).toISOString(),
  distance: 1.2,
  isForYou,
  store: { storeId: 'st1', businessName: 'Groove Merchant', isVerified: true },
  priceUsd: 28,
  conditionGrade: 'vg_plus',
  specialAttributes: null,
  storeVerified: false,
  record: {
    recordId: 'r1',
    artistName: 'Miles Davis',
    albumTitle: `Album ${n}`,
    genre: 'Jazz',
    coverArtUrl: null,
  },
});

const broadcast: FeedItem = {
  type: 'broadcast',
  id: BID,
  postedAt: new Date(Date.now() - 90 * 60_000).toISOString(),
  distance: 3.4,
  isForYou: false,
  store: { storeId: 'st2', businessName: 'Low End Theory', isVerified: true },
  arrivalSummary: 'Fresh jazz crates just landed',
  photoUrl: null,
  featuredIds: [],
};

const detail: BroadcastDetail = {
  broadcastId: BID,
  arrivalSummary: 'Fresh jazz crates just landed',
  photoUrl: 'https://example.com/crates.jpg',
  postedAt: broadcast.postedAt,
  unit: 'mi',
  distance: 3.4,
  store: {
    storeId: 'st2',
    businessName: 'Low End Theory',
    isVerified: true,
    streetAddress: '1 Main St',
    city: 'Portland',
    state: 'OR',
    zip: '97205',
  },
  featured: [
    {
      recordId: 'r9',
      artistName: 'John Coltrane',
      albumTitle: 'A Love Supreme',
      releaseYear: 1965,
      genre: 'Jazz',
      coverArtUrl: null,
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
let pages: Record<string, { items: FeedItem[]; nextCursor: string | null }>;
const feedCalls = () =>
  fetchMock.mock.calls
    .map(([u]) => String(u))
    .filter((u) => u.includes('/feed?'))
    .map((u) => new URL(u, 'http://x').searchParams);

function gps(ok: boolean) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (yes: PositionCallback, no: PositionErrorCallback) =>
        ok
          ? yes({ coords: { latitude: 45.52, longitude: -122.68 } } as GeolocationPosition)
          : no({ code: 1 } as GeolocationPositionError),
    },
  });
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
  localStorage.clear();
  gps(true);
  pages = {
    first: { items: [sighting(1, true), broadcast], nextCursor: 'c2' },
    c2: { items: [sighting(3)], nextCursor: null },
  };
  fetchMock = vi.fn(async (url: string) => {
    if (url.includes(`/broadcasts/${BID}`)) return json(detail);
    const p = new URL(url, 'http://x').searchParams;
    if (p.get('zip') === '82715') {
      return json({ error: { code: 'ZIP_NOT_FOUND', message: 'No location' } }, 404);
    }
    const page = pages[p.get('cursor') ?? 'first']!;
    return json({ unit: 'mi', radius: Number(p.get('radius')), ...page });
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('/discover', () => {
  it('shows sighting and broadcast cards near GPS with a guest banner', async () => {
    renderAt('/discover');
    const card = await screen.findByRole('link', { name: /Album 1/ });
    expect(card).toHaveTextContent('Miles Davis');
    expect(card).toHaveTextContent('Groove Merchant · 1.2 mi · 1h ago');
    expect(card).toHaveTextContent('$28.00');
    expect(card).toHaveTextContent('For you');
    const b = screen.getByRole('link', { name: /Fresh jazz crates/ });
    expect(b).toHaveAttribute('href', `/broadcasts/${BID}`);
    expect(b).toHaveTextContent('Low End Theory');
    expect(screen.getByText(/to report and save records/)).toBeInTheDocument();
    expect(feedCalls()[0]!.get('radius')).toBe('10');
    expect(feedCalls()[0]!.get('lat')).toBe('45.52000');
  });

  it('loads the next page and refreshes from the top', async () => {
    renderAt('/discover');
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('link', { name: /Album 3/ })).toBeInTheDocument();
    expect(feedCalls().at(-1)!.get('cursor')).toBe('c2');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(feedCalls()).toHaveLength(3));
    expect(feedCalls().at(-1)!.get('cursor')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('link', { name: /Album 3/ })).toBeNull());
  });

  it('refreshes on pull down', async () => {
    renderAt('/discover');
    const list = await screen.findByRole('list', { name: 'Nearby finds' });
    fireEvent.touchStart(list, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(list, { touches: [{ clientY: 200 }] });
    expect(screen.getByText('Release to refresh')).toBeInTheDocument();
    fireEvent.touchEnd(list);
    await waitFor(() => expect(feedCalls()).toHaveLength(2));
  });

  it("uses the member's saved ZIP and hides the guest banner", async () => {
    gps(false);
    renderAt('/discover', COLLECTOR);
    await screen.findByRole('link', { name: /Album 1/ });
    expect(feedCalls()[0]!.get('zip')).toBe('60601');
    expect(screen.queryByText(/to report and save records/)).toBeNull();
  });

  it('asks guests without GPS for a ZIP and remembers it', async () => {
    gps(false);
    renderAt('/discover');
    const input = await screen.findByLabelText('Enter your 5-digit ZIP code to see nearby finds');
    fireEvent.change(input, { target: { value: '97205' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use ZIP' }));
    await screen.findByRole('link', { name: /Album 1/ });
    expect(feedCalls()[0]!.get('zip')).toBe('97205');
    expect(localStorage.getItem('cratedig.guestZip')).toBe('97205');
  });

  it('suggests next steps when nothing is nearby', async () => {
    pages.first = { items: [], nextCursor: null };
    renderAt('/discover');
    expect(await screen.findByText(/Nothing spotted within 10 mi/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report a sighting' })).toHaveAttribute(
      'href',
      '/report',
    );
  });
});

describe('/broadcasts/:id', () => {
  it('shows the store header, summary, photo link, featured albums and store link', async () => {
    renderAt(`/broadcasts/${BID}`);
    expect(await screen.findByText('Fresh jazz crates just landed')).toBeInTheDocument();
    expect(screen.getByText(/1 Main St, Portland, OR · 3.4 mi/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View photo' })).toHaveAttribute(
      'href',
      'https://example.com/crates.jpg',
    );
    expect(screen.getByRole('link', { name: /A Love Supreme/ })).toHaveAttribute(
      'href',
      '/albums/r9',
    );
    expect(screen.getByRole('link', { name: 'Visit store profile' })).toHaveAttribute(
      'href',
      '/stores/st2',
    );
  });
});
