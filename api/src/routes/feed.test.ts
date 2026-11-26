import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { BroadcastDetail, FeedItem, FeedRepository } from '../feed/repository.js';
import type { StoreRepository } from '../stores/repository.js';
import { AS_ALICE, fakeAuth } from '../test/fakeAuth.js';

const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const STORE = uuid(900);

const sighting = (n: number, genre = 'Jazz', storeId = uuid(901)): FeedItem => ({
  type: 'sighting',
  id: uuid(n),
  postedAt: new Date(Date.UTC(2026, 10, 25) - n * 60_000).toISOString(),
  distanceMiles: 1.234,
  store: { storeId, businessName: 'Groove Merchant', isVerified: true },
  priceUsd: 28,
  conditionGrade: 'vg_plus',
  specialAttributes: null,
  storeVerified: false,
  record: {
    recordId: uuid(500),
    artistName: 'Miles Davis',
    albumTitle: 'Kind of Blue',
    genre,
    coverArtUrl: null,
  },
});

const broadcast: FeedItem = {
  type: 'broadcast',
  id: uuid(700),
  postedAt: '2026-11-24T00:00:00.000Z',
  distanceMiles: 3,
  store: { storeId: STORE, businessName: 'Low End Theory', isVerified: true },
  arrivalSummary: 'Fresh crates',
  photoUrl: null,
  featuredIds: [],
};

const detail: BroadcastDetail = {
  broadcastId: uuid(700),
  arrivalSummary: 'Fresh crates',
  photoUrl: 'https://example.com/p.jpg',
  postedAt: '2026-11-24T00:00:00.000Z',
  store: {
    storeId: STORE,
    businessName: 'Low End Theory',
    isVerified: true,
    streetAddress: '1 Main St',
    city: 'Portland',
    state: 'OR',
    zip: '97205',
    geoLat: 45.53,
    geoLng: -122.7,
  },
  featured: [],
};

function setup(rows: FeedItem[] = [sighting(1), broadcast]) {
  const feed: FeedRepository = {
    page: vi.fn(async () => rows),
    preferences: vi.fn(async () => ({ genres: ['jazz'], favoriteStoreIds: [STORE] })),
    broadcast: vi.fn(async (id: string) => (id === uuid(700) ? detail : null)),
  };
  const stores: StoreRepository = {
    zipCentroid: vi.fn(async (zip: string) =>
      zip === '97205' ? { lat: 45.520562, lng: -122.710231 } : null,
    ),
    listInBox: vi.fn(async () => []),
    getById: vi.fn(async () => null),
  };
  return { app: createApp({ feed, stores, auth: fakeAuth() }), feed };
}

describe('GET /api/v1/feed', () => {
  it('returns typed items for guests without personalisation', async () => {
    const { app, feed } = setup();
    const res = await request(app).get('/api/v1/feed?lat=45.52&lng=-122.71');
    expect(res.status).toBe(200);
    expect(feed.page).toHaveBeenCalledWith({
      lat: 45.52,
      lng: -122.71,
      radiusMiles: 10,
      before: null,
      limit: 21,
    });
    expect(feed.preferences).not.toHaveBeenCalled();
    expect(res.body.items.map((i: FeedItem) => i.type)).toEqual(['sighting', 'broadcast']);
    expect(res.body.items[0]).toMatchObject({ distance: 1.2, isForYou: false });
    expect(res.body.items[0].distanceMiles).toBeUndefined();
    expect(res.body.nextCursor).toBeNull();
  });

  it('marks genre and favorite-store matches for signed-in users', async () => {
    const { app } = setup([sighting(1, 'Jazz, Soul'), sighting(2, 'Rock'), broadcast]);
    const res = await request(app)
      .get('/api/v1/feed?zip=97205&radius=25')
      .set(...AS_ALICE);
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { isForYou: boolean }) => i.isForYou)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('pages 20 at a time with an opaque cursor', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => sighting(i + 1));
    const { app, feed } = setup(rows);
    const first = await request(app).get('/api/v1/feed?lat=45.52&lng=-122.71');
    expect(first.body.items).toHaveLength(20);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    await request(app).get(`/api/v1/feed?lat=45.52&lng=-122.71&cursor=${first.body.nextCursor}`);
    expect(feed.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ before: { postedAt: rows[19]!.postedAt, id: rows[19]!.id } }),
    );
  });

  it('converts km and rejects bad input', async () => {
    const { app, feed } = setup();
    await request(app).get('/api/v1/feed?lat=45.52&lng=-122.71&radius=25&unit=km');
    expect(vi.mocked(feed.page).mock.calls[0]![0].radiusMiles).toBeCloseTo(15.53, 2);
    expect((await request(app).get('/api/v1/feed')).body.error.code).toBe('LOCATION_REQUIRED');
    expect((await request(app).get('/api/v1/feed?zip=82715')).status).toBe(404);
    expect((await request(app).get('/api/v1/feed?zip=97205&cursor=nope')).status).toBe(400);
    expect((await request(app).get('/api/v1/feed?zip=97205&radius=7')).status).toBe(400);
  });
});

describe('GET /api/v1/broadcasts/:id', () => {
  it('returns the broadcast with the store distance', async () => {
    const { app } = setup();
    const res = await request(app).get(`/api/v1/broadcasts/${uuid(700)}?zip=97205`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ arrivalSummary: 'Fresh crates', unit: 'mi' });
    expect(res.body.distance).toBeGreaterThan(0);
  });

  it('omits the distance for unmapped ZIPs and 404s unknown broadcasts', async () => {
    const { app } = setup();
    const res = await request(app).get(`/api/v1/broadcasts/${uuid(700)}?zip=82715`);
    expect(res.body.distance).toBeNull();
    expect((await request(app).get(`/api/v1/broadcasts/${uuid(1)}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/broadcasts/abc')).status).toBe(400);
  });
});
