import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet } from '../api/client';
import type { CrateItem } from '../api/crate';
import type { StoreDetail } from '../api/stores';
import { APP_ROUTES } from '../app/router';
import type { AvatarUser } from '../components/AvatarMenu';
import { readCrateCache, writeCrateCache } from '../lib/crateCache';
import { RECENT_STORE_LIMIT, readCachedStore, rememberStore } from '../lib/storeCache';
import { FakeAuth } from '../test/auth';
import { addItem, saveCrateEdit } from './crateWrites';
import { enqueue, flushQueue, readQueue } from './queue';

const COLLECTOR: AvatarUser = { displayName: 'Dana Diggs', role: 'collector' };
const STORE = '00000000-0000-4000-8000-000000000001';
const ITEM = '00000000-0000-4000-a000-000000000001';

const store: StoreDetail = {
  storeId: STORE,
  businessName: 'Groove Merchant Records',
  streetAddress: '1021 SW Morrison St',
  city: 'Portland',
  state: 'OR',
  zip: '97205',
  geoLat: 45.52,
  geoLng: -122.68,
  tags: [],
  isVerified: true,
  phone: null,
  websiteUrl: null,
  operatingHours: {},
  timeZone: 'America/Los_Angeles',
  isOpenNow: true,
  paymentMethods: [],
  activeSightings: [],
  recentBroadcasts: [],
};

const record = {
  recordId: '00000000-0000-4000-9000-000000000001',
  apiSourceId: 'discogs:1',
  artistName: 'Miles Davis',
  albumTitle: 'Kind of Blue',
  songTitle: null,
  recordLabel: null,
  releaseYear: 1959,
  genre: 'Jazz',
  coverArtUrl: null,
};

const wanted: CrateItem = {
  crateItemId: ITEM,
  listType: 'want_list',
  conditionGrade: null,
  specialAttributes: [],
  purchasePriceUsd: null,
  userNotes: null,
  acquiredAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  purchasedStore: null,
  record,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let online = true;
let fetchMock: ReturnType<typeof vi.fn>;
const userId = 'u1';

function goOffline() {
  online = false;
  window.dispatchEvent(new Event('offline'));
}

function renderAt(path: string) {
  const router = createMemoryRouter(APP_ROUTES, { initialEntries: [path] });
  render(
    <FakeAuth user={COLLECTOR}>
      <RouterProvider router={router} />
    </FakeAuth>,
  );
  return router;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cratedig.crateTab', 'want_list');
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!online) throw new TypeError('Failed to fetch');
    const method = init?.method ?? 'GET';
    if (url.endsWith(`/stores/${STORE}`)) return json(store);
    if (url.includes('/crate?')) return json({ items: url.includes('want_list') ? [wanted] : [] });
    if (url.endsWith(`/crate/${ITEM}`) && method === 'GET') return json(wanted);
    if (url.endsWith(`/crate/${ITEM}`) && method === 'PATCH')
      return json({ ...wanted, userNotes: 'synced' });
    if (url.endsWith(`/crate/${ITEM}`) && method === 'DELETE')
      return json({ error: { code: 'NOT_FOUND', message: 'No such crate item' } }, 404);
    if (url.endsWith('/acquire'))
      return json({ error: { code: 'NOT_ON_WANT_LIST', message: 'Only Want List' } }, 409);
    if (url.endsWith('/crate') && method === 'POST') return json(wanted, 201);
    return json({ items: [], stores: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API client offline', () => {
  it('fails fast with an offline message instead of fetching', async () => {
    goOffline();
    await expect(apiGet('/feed')).rejects.toMatchObject({ status: 0, code: 'OFFLINE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up on a stalled request after the timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_ok, fail) =>
          init.signal!.addEventListener('abort', () =>
            fail(new DOMException('aborted', 'AbortError')),
          ),
        ),
    );
    const pending = expect(apiGet('/feed')).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(15_000);
    await pending;
    vi.useRealTimers();
  });
});

describe('offline banner', () => {
  it('appears when the connection drops and counts queued changes', async () => {
    renderAt('/discover');
    goOffline();
    enqueue({ kind: 'delete_crate_item', id: ITEM, idempotencyKey: 'k1' }, userId);
    expect(await screen.findByText(/You're offline/)).toHaveTextContent(
      '1 change will sync when you reconnect',
    );
  });
});

describe('recent store profiles', () => {
  it('opens a previously viewed store from the saved copy while offline', async () => {
    renderAt(`/stores/${STORE}`);
    await screen.findByText('Open now');
    document.body.innerHTML = '';
    goOffline();
    renderAt(`/stores/${STORE}`);
    expect(
      await screen.findByRole('heading', { name: /Groove Merchant Records/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Saved copy from/)).toBeInTheDocument();
    expect(screen.queryByText('Open now')).toBeNull();
  });

  it('keeps only the last ten stores', () => {
    for (let n = 0; n < RECENT_STORE_LIMIT + 2; n++) {
      rememberStore({ ...store, storeId: `s${n}` });
    }
    expect(readCachedStore('s0')).toBeNull();
    expect(readCachedStore('s1')).toBeNull();
    expect(readCachedStore('s11')).not.toBeNull();
  });
});

describe('offline crate writes', () => {
  async function openItemOffline() {
    renderAt('/crate');
    await screen.findByText('Kind of Blue');
    document.body.innerHTML = '';
    goOffline();
    renderAt(`/crate/items/${ITEM}`);
    await screen.findByRole('heading', { name: 'Kind of Blue' });
  }

  it('saves an edit locally and syncs it with an idempotency key', async () => {
    await openItemOffline();
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: 'Check sleeve' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(/Saved on this device/)).toBeInTheDocument();
    expect(readCrateCache(userId, 'want_list')![0]!.userNotes).toBe('Check sleeve');
    const [entry] = readQueue();
    expect(entry!.action.kind).toBe('update_crate_item');

    online = true;
    expect(await flushQueue(userId)).toEqual({ sent: 1, failed: 0 });
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!;
    expect(new Headers(patch[1].headers).get('Idempotency-Key')).toBe(entry!.action.idempotencyKey);
  });

  it('acquires offline and moves the item to the Collection snapshot', async () => {
    await openItemOffline();
    writeCrateCache(userId, 'collection', []);
    fireEvent.click(screen.getByRole('button', { name: 'Mark as acquired' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Acquired elsewhere/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText(/sync when you're back online/)).toBeInTheDocument();
    expect(readCrateCache(userId, 'collection')![0]!.crateItemId).toBe(ITEM);
    expect(readCrateCache(userId, 'want_list')).toEqual([]);
    expect(readQueue()[0]!.action.kind).toBe('acquire_crate_item');
  });

  it('treats a replayed delete as synced but keeps a conflicting acquire as failed', async () => {
    enqueue({ kind: 'delete_crate_item', id: ITEM, idempotencyKey: 'd1' }, userId);
    enqueue({ kind: 'acquire_crate_item', id: ITEM, body: {}, idempotencyKey: 'a1' }, userId);
    expect(await flushQueue(userId)).toEqual({ sent: 1, failed: 1 });
    expect(readQueue()).toEqual([expect.objectContaining({ lastError: 'Only Want List' })]);
  });

  it('keeps a write pending when the session token has expired', async () => {
    enqueue({ kind: 'delete_crate_item', id: ITEM, idempotencyKey: 'e1' }, userId);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(await flushQueue(userId)).toEqual({ sent: 0, failed: 1 });
    expect(readQueue()).toEqual([expect.objectContaining({ attempts: 1 })]);
    expect(readQueue()[0]!.lastError).toBeUndefined();
  });

  it('also sends writes queued while a flush is running', async () => {
    enqueue({ kind: 'delete_crate_item', id: ITEM, idempotencyKey: 'f1' }, userId);
    fetchMock.mockImplementationOnce(async () => {
      enqueue({ kind: 'update_crate_item', id: ITEM, body: {}, idempotencyKey: 'f2' }, userId);
      return json({ error: { code: 'NOT_FOUND', message: 'No such crate item' } }, 404);
    });
    expect(await flushQueue(userId)).toEqual({ sent: 2, failed: 0 });
    expect(readQueue()).toEqual([]);
  });

  it("only replays the signed-in account's writes", async () => {
    enqueue({ kind: 'delete_crate_item', id: ITEM, idempotencyKey: 'other' }, 'someone-else');
    expect(await flushQueue(userId)).toEqual({ sent: 0, failed: 0 });
    expect(readQueue()).toHaveLength(1);
  });

  it('queues a new edit behind older pending writes to keep their order', async () => {
    enqueue({ kind: 'delete_crate_item', id: 'older', idempotencyKey: 'o1' }, userId);
    goOffline();
    const out = await saveCrateEdit(userId, wanted, { userNotes: 'newer' });
    expect(out.queued).toBe(true);
    expect(readQueue().map((e) => e.action.kind)).toEqual([
      'delete_crate_item',
      'update_crate_item',
    ]);
  });

  it('shows an offline add as waiting to sync, then sends it once', async () => {
    renderAt('/crate');
    await screen.findByText('Kind of Blue');
    goOffline();
    const { queued, item } = await addItem(
      userId,
      { recordId: 'r2', listType: 'want_list' },
      { ...record, recordId: 'r2', albumTitle: 'Blue Train', artistName: 'John Coltrane' },
      '00000000-0000-4000-b000-000000000001',
    );
    expect(queued).toBe(true);
    expect(item.crateItemId).toMatch(/^pending-/);
    expect(await screen.findByText('Blue Train')).toBeInTheDocument();
    expect(screen.getByText('Waiting to sync')).toBeInTheDocument();

    writeCrateCache(userId, 'want_list', [item]);
    online = true;
    await flushQueue(userId);
    await flushQueue(userId);
    expect(readCrateCache(userId, 'want_list')!.map((i) => i.crateItemId)).toEqual([ITEM]);
    const posts = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).endsWith('/crate') && init?.method === 'POST',
    );
    expect(posts).toHaveLength(1);
    await waitFor(() => expect(screen.queryByText('Blue Train')).toBeNull());
  });
});
