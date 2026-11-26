import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '../../api/search';
import { APP_ROUTES } from '../../app/router';
import type { AvatarUser } from '../../components/AvatarMenu';
import { FakeAuth } from '../../test/auth';

const COLLECTOR: AvatarUser = { displayName: 'Dana Diggs', role: 'collector' };

const result = (id: string, verified: boolean, distance: number): SearchResult => ({
  sightingId: id,
  priceUsd: 28,
  conditionGrade: 'near_mint',
  specialAttributes: null,
  storeVerified: verified,
  sightingTimestamp: '2026-11-20T00:00:00Z',
  distance,
  record: {
    recordId: 'r1',
    artistName: 'Miles Davis',
    albumTitle: 'Kind of Blue',
    genre: 'Jazz',
    coverArtUrl: null,
  },
  store: { storeId: `st-${id}`, businessName: `Store ${id}`, isVerified: true },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;
const searches = () =>
  fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((u) => u.includes('/search?'))
    .map((u) => new URL(u, 'http://x').searchParams);

function setGeolocation(ok: boolean) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (yes: PositionCallback, no: PositionErrorCallback) =>
        ok
          ? yes({ coords: { latitude: 45.52, longitude: -122.71 } } as GeolocationPosition)
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
  fetchMock = vi.fn(async (url: string) => {
    const p = new URL(url, 'http://x').searchParams;
    if (p.get('zip') === '82715') {
      return json({ error: { code: 'ZIP_NOT_FOUND', message: 'No location' } }, 404);
    }
    const results =
      p.get('q') === 'nothing' ? [] : [result('a', true, 0.7), result('b', false, 3.2)];
    return json({ unit: 'mi', radius: Number(p.get('radius')), genres: ['Jazz', 'Rock'], results });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('/search', () => {
  it('searches near GPS with the 10 mi default and shows result cards', async () => {
    setGeolocation(true);
    renderAt('/search');
    const cards = await screen.findAllByRole('link', { name: /Kind of Blue/ });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Miles Davis');
    expect(cards[0]).toHaveTextContent('Store a · 0.7 mi');
    expect(cards[0]).toHaveTextContent('$28.00');
    expect(cards[0]).toHaveTextContent('Near Mint');
    expect(cards[0]).toHaveTextContent('Verified by store');
    expect(cards[1]).not.toHaveTextContent('Verified by store');
    expect(cards[0]).toHaveAttribute('href', '/sightings/a');
    expect(searches()[0]!.get('radius')).toBe('10');
    expect(searches()[0]!.get('lat')).toBe('45.52000');
  });

  it('debounces keywords and applies radius and genre filters', async () => {
    setGeolocation(true);
    renderAt('/search');
    await screen.findAllByRole('link', { name: /Kind of Blue/ });
    fireEvent.change(screen.getByLabelText('Artist, album or genre'), {
      target: { value: 'miles' },
    });
    await vi.waitFor(() => expect(searches().at(-1)!.get('q')).toBe('miles'));
    fireEvent.click(screen.getByRole('radio', { name: '25 mi' }));
    await vi.waitFor(() => expect(searches().at(-1)!.get('radius')).toBe('25'));
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'Jazz' } });
    await vi.waitFor(() => expect(searches().at(-1)!.get('genre')).toBe('Jazz'));
    await vi.waitFor(() =>
      expect(within(screen.getByRole('combobox')).getAllByRole('option')).toHaveLength(3),
    );
  });

  it("defaults to the collector's radius and saved ZIP when GPS is denied", async () => {
    setGeolocation(false);
    renderAt('/search', COLLECTOR);
    await screen.findAllByRole('link', { name: /Kind of Blue/ });
    expect(searches()[0]!.get('zip')).toBe('60601');
  });

  it('asks guests without GPS for a ZIP and remembers it locally', async () => {
    setGeolocation(false);
    renderAt('/search');
    const input = await screen.findByLabelText('Enter your 5-digit ZIP code to search nearby');
    fireEvent.change(input, { target: { value: '972' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use ZIP' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a 5-digit ZIP code.');
    fireEvent.change(input, { target: { value: '97205' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use ZIP' }));
    await screen.findAllByRole('link', { name: /Kind of Blue/ });
    expect(searches().at(-1)!.get('zip')).toBe('97205');
    expect(localStorage.getItem('cratedig.guestZip')).toBe('97205');
  });

  it('uses the remembered guest ZIP on the next visit', async () => {
    setGeolocation(false);
    localStorage.setItem('cratedig.guestZip', '97205');
    renderAt('/search');
    await screen.findAllByRole('link', { name: /Kind of Blue/ });
    expect(searches()[0]!.get('zip')).toBe('97205');
  });

  it('explains unknown ZIPs', async () => {
    setGeolocation(false);
    renderAt('/search?zip=82715');
    expect(await screen.findByText(/don't have a location for ZIP 82715/)).toBeInTheDocument();
  });

  it('suggests widening the radius or adding to the Want List when empty', async () => {
    setGeolocation(true);
    const router = renderAt('/search?q=nothing&radius=5');
    expect(await screen.findByText('Nobody has spotted “nothing” nearby yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add to Want List' })).toHaveAttribute(
      'href',
      '/crate/add?list=want_list&q=nothing',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Widen to 25 mi' }));
    expect(new URLSearchParams(router.state.location.search).get('radius')).toBe('25');
  });
});
