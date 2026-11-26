import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrateItem } from '../../api/crate';
import type { RecordDetail } from '../../api/records';
import { APP_ROUTES } from '../../app/router';
import type { AvatarUser } from '../../components/AvatarMenu';
import { readCrateCache, writeCrateCache } from '../../lib/crateCache';
import { FakeAuth } from '../../test/auth';

const COLLECTOR: AvatarUser = { displayName: 'Dana Diggs', role: 'collector' };
const REC = '00000000-0000-4000-9000-000000000001';
const ITEM = '00000000-0000-4000-a000-000000000001';
const STORE_NEAR = '00000000-0000-4000-8000-000000000001';
const STORE_FAR = '00000000-0000-4000-8000-000000000002';

const record = {
  recordId: REC,
  apiSourceId: 'discogs:1',
  artistName: 'Miles Davis',
  albumTitle: 'Kind of Blue',
  songTitle: 'So What',
  recordLabel: 'Columbia',
  releaseYear: 1959,
  genre: 'Jazz',
  coverArtUrl: null,
};

const item = (over: Partial<CrateItem> = {}): CrateItem => ({
  crateItemId: ITEM,
  listType: 'collection',
  conditionGrade: 'near_mint',
  specialAttributes: [],
  purchasePriceUsd: 24.5,
  userNotes: null,
  acquiredAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  purchasedStore: null,
  record,
  ...over,
});

const rumours = item({
  crateItemId: '00000000-0000-4000-a000-000000000002',
  record: {
    ...record,
    recordId: 'r2',
    artistName: 'Fleetwood Mac',
    albumTitle: 'Rumours',
    genre: 'Rock',
  },
});

const detail: RecordDetail = {
  ...record,
  unit: 'mi',
  activeSightings: [
    {
      sightingId: 's-far',
      priceUsd: 40,
      conditionGrade: 'vg_plus',
      specialAttributes: null,
      storeVerified: false,
      sightingTimestamp: '2026-11-20T00:00:00Z',
      distance: 6.2,
      store: { storeId: STORE_FAR, businessName: 'Far Records' },
    },
    {
      sightingId: 's-near',
      priceUsd: 28,
      conditionGrade: 'near_mint',
      specialAttributes: null,
      storeVerified: true,
      sightingTimestamp: '2026-11-24T00:00:00Z',
      distance: 1.1,
      store: { storeId: STORE_NEAR, businessName: 'Groove Merchant' },
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Handler = (url: string, init?: RequestInit) => Response | undefined;
let handlers: Handler[];
let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string, part: string) =>
  fetchMock.mock.calls.filter(
    ([url, init]) => String(url).includes(part) && (init?.method ?? 'GET') === method,
  );

function renderAt(path: string, user: AvatarUser | null = COLLECTOR) {
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
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
  handlers = [];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    for (const h of handlers) {
      const res = h(url, init);
      if (res) return res;
    }
    if (url.includes('/crate?')) {
      const list = new URL(url, 'http://x').searchParams.get('listType');
      return json({
        items:
          list === 'want_list'
            ? [item({ listType: 'want_list', purchasePriceUsd: null })]
            : [item(), rumours],
      });
    }
    if (url.includes(`/records/${REC}`)) return json(detail);
    if (url.endsWith(`/crate/${ITEM}`))
      return json(item({ listType: 'want_list', purchasePriceUsd: null }));
    return json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('/crate', () => {
  it('shows the Collection with prices and filters by keyword and genre', async () => {
    renderAt('/crate');
    expect(await screen.findByText('Kind of Blue')).toBeInTheDocument();
    expect(screen.getAllByText('Paid $24.50')).toHaveLength(2);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'fleet' } });
    expect(screen.queryByText('Kind of Blue')).toBeNull();
    expect(screen.getByText('Rumours')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Jazz' } });
    expect(screen.queryByText('Rumours')).toBeNull();
    expect(screen.getByRole('link', { name: '+ Add record' })).toHaveAttribute(
      'href',
      '/crate/add?list=collection',
    );
  });

  it('clears the genre filter when switching lists', async () => {
    renderAt('/crate');
    expect(await screen.findByText('Rumours')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Rock' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Want List' }));
    expect(await screen.findByText('Kind of Blue')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('remembers the Want List tab and shows wanted attributes', async () => {
    renderAt('/crate');
    await screen.findByText('Kind of Blue');
    fireEvent.click(screen.getByRole('radio', { name: 'Want List' }));
    expect(await screen.findByText('Near Mint or better')).toBeInTheDocument();
    expect(localStorage.getItem('cratedig.crateTab')).toBe('want_list');
  });

  it('only mounts the visible rows of a 500-record crate', async () => {
    handlers.push((url) =>
      url.includes('/crate?')
        ? json({
            items: Array.from({ length: 500 }, (_, n) =>
              item({ crateItemId: `id-${n}`, record: { ...record, albumTitle: `LP ${n}` } }),
            ),
          })
        : undefined,
    );
    renderAt('/crate');
    const list = await screen.findByRole('list', { name: 'Collection' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.length).toBeLessThan(60);
    expect(rows[0]).toHaveAttribute('aria-setsize', '500');
  });

  it('falls back to the cached crate when offline', async () => {
    renderAt('/crate');
    await screen.findByText('Kind of Blue');
    document.body.innerHTML = '';
    fetchMock.mockRejectedValue(new TypeError('offline'));
    renderAt('/crate');
    expect(await screen.findByText(/last time you were online/)).toBeInTheDocument();
    expect(screen.getByText('Kind of Blue')).toBeInTheDocument();
  });
});

describe('/crate/add', () => {
  beforeEach(() => {
    handlers.push((url) =>
      url.includes('/catalog/search') ? json({ results: [{ ...record }] }) : undefined,
    );
  });

  it('looks up the catalog after 2 characters and saves in two taps', async () => {
    const router = renderAt('/crate/add?list=collection');
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'm' } });
    expect(screen.getByText('Type at least 2 characters.')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'miles' } });
    fireEvent.click(await screen.findByRole('button', { name: /Kind of Blue/ }));
    handlers.push((_url, init) => (init?.method === 'POST' ? json(item(), 201) : undefined));
    fireEvent.click(screen.getByRole('button', { name: 'Save to Collection' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/crate'));
    const [, init] = calls('POST', '/crate')[0]!;
    expect(JSON.parse(String(init!.body))).toMatchObject({
      apiSourceId: 'discogs:1',
      listType: 'collection',
    });
    expect(calls('GET', '/catalog/search')).toHaveLength(1);
  });

  it('warns about a duplicate and can add anyway', async () => {
    renderAt('/crate/add');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'kind' } });
    fireEvent.click(await screen.findByRole('button', { name: /Kind of Blue/ }));
    fireEvent.change(screen.getByLabelText('Price paid (USD)'), { target: { value: '19.99' } });
    handlers.push((_url, init) => {
      if (init?.method !== 'POST') return undefined;
      const body = JSON.parse(String(init.body));
      return body.force
        ? json(item(), 201)
        : json({ error: { code: 'ALREADY_OWNED', message: 'You already own this record' } }, 409);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save to Collection' }));
    const warning = await screen.findByRole('alertdialog');
    fireEvent.click(within(warning).getByRole('button', { name: 'Add anyway' }));
    await waitFor(() => expect(calls('POST', '/crate')).toHaveLength(2));
    expect(JSON.parse(String(calls('POST', '/crate')[1]![1]!.body))).toMatchObject({
      force: true,
      purchasePriceUsd: 19.99,
    });
  });
});

describe('/albums/:id', () => {
  it('shows metadata and nearby sightings; guests are sent to log in', async () => {
    const router = renderAt(`/albums/${REC}`, null);
    expect(await screen.findByText('So What')).toBeInTheDocument();
    expect(screen.getByText('Columbia')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Groove Merchant/ })).toHaveTextContent('$28.00');
    fireEvent.click(screen.getByRole('button', { name: 'Add to Collection' }));
    expect(router.state.location.pathname).toBe('/login');
  });

  it('tells collectors the record is already in their crate', async () => {
    renderAt(`/albums/${REC}`);
    expect(await screen.findByText('In your Collection')).toBeInTheDocument();
  });

  it('warns before adding a second copy and can add anyway', async () => {
    handlers.push((_url, init) => {
      if (init?.method !== 'POST') return undefined;
      return JSON.parse(String(init.body)).force
        ? json(item(), 201)
        : json({ error: { code: 'ALREADY_OWNED', message: 'Already owned' } }, 409);
    });
    writeCrateCache('u1', 'collection', []);
    renderAt(`/albums/${REC}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Add to Collection' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add anyway' }));
    expect(await screen.findByText('Added to your Collection.')).toBeInTheDocument();
    expect(calls('POST', '/crate')).toHaveLength(2);
    expect(readCrateCache('u1', 'collection')).toHaveLength(1);
  });
});

describe('/crate/items/:id', () => {
  it('marks a Want List item acquired at the nearest store', async () => {
    renderAt(`/crate/items/${ITEM}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as acquired' }));
    const dialog = await screen.findByRole('dialog');
    const options = await within(dialog).findAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(options[0]!.closest('label')).toHaveTextContent('Groove Merchant');
    expect(options[2]!.closest('label')).toHaveTextContent('Acquired elsewhere');
    fireEvent.click(options[0]!);
    expect(within(dialog).getByLabelText('Price paid (USD, optional)')).toHaveValue('28.00');
    handlers.push((url) =>
      url.endsWith('/acquire')
        ? json({
            item: item({ acquiredAt: '2026-11-26T00:00:00Z' }),
            closedSightingIds: ['s-near'],
          })
        : undefined,
    );
    writeCrateCache('u1', 'collection', [item({ crateItemId: 'owned', listType: 'collection' })]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(readCrateCache('u1', 'collection')?.map((i) => i.crateItemId)).toEqual([
        ITEM,
        'owned',
      ]),
    );
    expect(readCrateCache('u1', 'want_list')).toBeNull();
    expect(
      await screen.findByText('Moved to Collection — marked sold out at Groove Merchant.'),
    ).toBeInTheDocument();
    expect(JSON.parse(String(calls('POST', '/acquire')[0]![1]!.body))).toEqual({
      storeId: STORE_NEAR,
      purchasePriceUsd: 28,
    });
    expect(screen.queryByRole('button', { name: 'Mark as acquired' })).toBeNull();
  });

  it('asks before deleting', async () => {
    const router = renderAt(`/crate/items/${ITEM}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete from crate' }));
    expect(calls('DELETE', '/crate/')).toHaveLength(0);
    handlers.push((_u, init) =>
      init?.method === 'DELETE' ? new Response(null, { status: 204 }) : undefined,
    );
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/crate'));
  });
});
