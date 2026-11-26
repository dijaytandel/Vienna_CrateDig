import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { StoreDetail, StoreRepository, StoreSummary } from '../stores/repository.js';

const store = (id: string, name: string, geoLat: number, geoLng: number, isVerified = true) =>
  ({
    storeId: `00000000-0000-4000-8000-0000000000${id}`,
    businessName: name,
    streetAddress: '1 Main St',
    city: 'Portland',
    state: 'OR',
    zip: '97205',
    geoLat,
    geoLng,
    tags: ['Jazz'],
    isVerified,
  }) satisfies StoreSummary;

// Origin is the 97205 centroid; distances are ~0.4, ~3.5, ~7 and ~20 mi.
const downtown = store('01', 'Downtown', 45.5216, -122.6826);
const eastside = store('02', 'Eastside', 45.5048, -122.6304, false);
const beaverton = store('03', 'Beaverton', 45.4898, -122.8023);
const vancouver = store('04', 'Far North', 45.8, -122.6);
const all = [vancouver, eastside, beaverton, downtown];

const detail: StoreDetail = {
  ...downtown,
  phone: '(503) 555-0142',
  websiteUrl: 'https://example.com',
  operatingHours: { thu: { open: '11:00', close: '20:00' } },
  paymentMethods: ['Cash'],
};

function setup() {
  const repo: StoreRepository = {
    zipCentroid: vi.fn(async (zip: string) =>
      zip === '97205' ? { lat: 45.520562, lng: -122.710231 } : null,
    ),
    listInBox: vi.fn(async (b) =>
      all.filter(
        (s) =>
          s.geoLat >= b.minLat &&
          s.geoLat <= b.maxLat &&
          s.geoLng >= b.minLng &&
          s.geoLng <= b.maxLng,
      ),
    ),
    getById: vi.fn(async (id: string) =>
      id === downtown.storeId ? { store: detail, sightings: [], broadcasts: [] } : null,
    ),
  };
  const app = createApp({ stores: repo, now: () => new Date('2026-11-26T20:00:00Z') });
  return { app, repo };
}

describe('GET /api/v1/stores', () => {
  it('sorts by distance in miles and filters by radius', async () => {
    const res = await request(setup().app).get(
      '/api/v1/stores?lat=45.520562&lng=-122.710231&radius=10',
    );
    expect(res.status).toBe(200);
    expect(res.body.unit).toBe('mi');
    expect(res.body.stores.map((s: StoreSummary) => s.businessName)).toEqual([
      'Downtown',
      'Eastside',
      'Beaverton',
    ]);
    expect(res.body.stores[0].distance).toBeCloseTo(1.5, 0);
    expect(res.body.stores[1].isVerified).toBe(false);
  });

  it('resolves a ZIP to its centroid', async () => {
    const res = await request(setup().app).get('/api/v1/stores?zip=97205&radius=25');
    expect(res.status).toBe(200);
    expect(res.body.origin).toEqual({ lat: 45.520562, lng: -122.710231, source: 'zip' });
    expect(res.body.stores).toHaveLength(4);
  });

  it('defaults to a 10 mi radius', async () => {
    const res = await request(setup().app).get('/api/v1/stores?zip=97205');
    expect(res.body.radius).toBe(10);
    expect(res.body.stores).toHaveLength(3);
  });

  it('reports distances and radius in km when asked', async () => {
    const mi = await request(setup().app).get('/api/v1/stores?zip=97205&radius=5');
    const km = await request(setup().app).get('/api/v1/stores?zip=97205&radius=5&unit=km');
    expect(km.body.unit).toBe('km');
    expect(km.body.stores[0].distance).toBeCloseTo(mi.body.stores[0].distance * 1.609, 0);
    // 5 km ≈ 3.1 mi keeps Downtown (~1.5 mi) but drops Eastside (~3.6 mi).
    expect(km.body.stores.length).toBeLessThan(mi.body.stores.length);
  });

  it('returns 404 ZIP_NOT_FOUND for a ZIP with no centroid', async () => {
    const res = await request(setup().app).get('/api/v1/stores?zip=00000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ZIP_NOT_FOUND');
  });

  it.each([
    ['no location', ''],
    ['lat without lng', 'lat=45'],
    ['a radius outside 5/10/25', 'zip=97205&radius=15'],
    ['a malformed ZIP', 'zip=9720'],
    ['an unknown unit', 'zip=97205&unit=ft'],
  ])('rejects %s', async (_, query) => {
    const res = await request(setup().app).get(`/api/v1/stores?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 503 when the database is not configured', async () => {
    const res = await request(createApp({ stores: undefined })).get('/api/v1/stores?zip=97205');
    expect(res.status).toBe(503);
  });
});

describe('GET /api/v1/stores/:id', () => {
  it('returns the store with local open status', async () => {
    const res = await request(setup().app).get(`/api/v1/stores/${downtown.storeId}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      businessName: 'Downtown',
      phone: '(503) 555-0142',
      timeZone: 'America/Los_Angeles',
      isOpenNow: true,
      activeSightings: [],
      recentBroadcasts: [],
    });
  });

  it.each(['00000000-0000-4000-8000-000000000099', 'not-a-uuid'])(
    'returns 404 for %s',
    async (id) => {
      const { app, repo } = setup();
      const res = await request(app).get(`/api/v1/stores/${id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      if (id === 'not-a-uuid') expect(repo.getById).not.toHaveBeenCalled();
    },
  );
});
