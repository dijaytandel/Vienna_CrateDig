import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { SearchHit, SearchRepository } from '../search/repository.js';
import type { StoreRepository } from '../stores/repository.js';

const hit = (id: string, distanceMiles: number): SearchHit => ({
  sightingId: id,
  priceUsd: 28,
  conditionGrade: 'near_mint',
  specialAttributes: null,
  storeVerified: true,
  sightingTimestamp: '2026-11-20T00:00:00Z',
  record: {
    recordId: 'r1',
    artistName: 'Miles Davis',
    albumTitle: 'Kind of Blue',
    genre: 'Jazz',
    coverArtUrl: null,
  },
  store: { storeId: `st-${id}`, businessName: id, geoLat: 45.53, geoLng: -122.7, isVerified: true },
  distanceMiles,
});

function setup() {
  const search: SearchRepository = {
    search: vi.fn(async () => [hit('near', 0.66), hit('mid', 6.94)]),
    genres: vi.fn(async () => ['Jazz', 'Rock']),
  };
  const stores: StoreRepository = {
    zipCentroid: vi.fn(async (zip: string) =>
      zip === '97205' ? { lat: 45.520562, lng: -122.710231 } : null,
    ),
    listInBox: vi.fn(async () => []),
    getById: vi.fn(async () => null),
  };
  return { app: createApp({ search, stores }), search };
}

describe('GET /api/v1/search', () => {
  it('searches around GPS coordinates with the default 10 mi radius', async () => {
    const { app, search } = setup();
    const res = await request(app).get(
      '/api/v1/search?q=miles%20blue&genre=jazz&lat=45.52&lng=-122.71',
    );
    expect(res.status).toBe(200);
    expect(search.search).toHaveBeenCalledWith({
      q: 'miles blue',
      genre: 'jazz',
      lat: 45.52,
      lng: -122.71,
      radiusMiles: 10,
    });
    expect(search.genres).toHaveBeenCalledWith(expect.objectContaining({ genre: null }));
    expect(res.body.genres).toEqual(['Jazz', 'Rock']);
    expect(res.body.radius).toBe(10);
    expect(res.body.results[0]).toMatchObject({
      sightingId: 'near',
      priceUsd: 28,
      conditionGrade: 'near_mint',
      storeVerified: true,
      distance: 0.7,
    });
    expect(res.body.results[0].distanceMiles).toBeUndefined();
  });

  it('uses the ZIP centroid and converts to km', async () => {
    const { app, search } = setup();
    const res = await request(app).get('/api/v1/search?zip=97205&radius=25&unit=km');
    expect(res.body.origin.source).toBe('zip');
    expect(search.search).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 45.520562, radiusMiles: 25 / 1.609344, q: '' }),
    );
    expect(res.body.results.map((r: { distance: number }) => r.distance)).toEqual([1.1, 11.2]);
  });

  it('requires a location', async () => {
    const res = await request(setup().app).get('/api/v1/search?q=miles');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LOCATION_REQUIRED');
  });

  it('rejects other radii and unknown ZIPs', async () => {
    const bad = await request(setup().app).get('/api/v1/search?zip=97205&radius=50');
    expect(bad.status).toBe(400);
    const missing = await request(setup().app).get('/api/v1/search?zip=82715');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('ZIP_NOT_FOUND');
  });
});
