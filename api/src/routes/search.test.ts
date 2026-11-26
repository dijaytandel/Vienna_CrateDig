import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { SearchHit, SearchRepository } from '../search/repository.js';
import type { StoreRepository } from '../stores/repository.js';

const hit = (id: string, lat: number, genre: string | null, at: string): SearchHit => ({
  sightingId: id,
  priceUsd: 28,
  conditionGrade: 'near_mint',
  specialAttributes: null,
  storeVerified: id === 'near',
  sightingTimestamp: at,
  record: {
    recordId: 'r1',
    artistName: 'Miles Davis',
    albumTitle: 'Kind of Blue',
    genre,
    coverArtUrl: null,
  },
  store: {
    storeId: `st-${id}`,
    businessName: id,
    geoLat: lat,
    geoLng: -122.710231,
    isVerified: true,
  },
});

// Origin 45.520562; ~0.7 mi, ~0.7 mi (older), ~7 mi, ~21 mi north.
const hits = [
  hit('far', 45.82, 'Rock', '2026-11-25T00:00:00Z'),
  hit('mid', 45.62, 'Jazz', '2026-11-25T00:00:00Z'),
  hit('near-old', 45.53, 'Jazz', '2026-11-01T00:00:00Z'),
  hit('near', 45.53, 'Jázz', '2026-11-20T00:00:00Z'),
];

function setup() {
  const search: SearchRepository = { search: vi.fn(async () => hits) };
  const stores: StoreRepository = {
    zipCentroid: vi.fn(async (zip: string) =>
      zip === '97205' ? { lat: 45.520562, lng: -122.710231 } : null,
    ),
    listInBox: vi.fn(async () => []),
    getById: vi.fn(async () => null),
  };
  return { app: createApp({ search, stores }), search };
}

const ids = (res: request.Response) =>
  res.body.results.map((r: { sightingId: string }) => r.sightingId);

describe('GET /api/v1/search', () => {
  it('returns sightings in the radius, nearest then newest', async () => {
    const { app, search } = setup();
    const res = await request(app).get('/api/v1/search?q=miles&lat=45.520562&lng=-122.710231');
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(['near', 'near-old', 'mid']);
    expect(res.body.results[0]).toMatchObject({ priceUsd: 28, storeVerified: true, distance: 0.7 });
    expect(res.body.radius).toBe(10);
    expect(search.search).toHaveBeenCalledWith(
      'miles',
      expect.objectContaining({ minLat: expect.any(Number) }),
    );
  });

  it('uses the ZIP centroid and widens to 25 mi', async () => {
    const res = await request(setup().app).get('/api/v1/search?zip=97205&radius=25');
    expect(ids(res)).toEqual(['near', 'near-old', 'mid', 'far']);
    expect(res.body.origin.source).toBe('zip');
  });

  it('filters by genre without accents or case and lists genres before filtering', async () => {
    const res = await request(setup().app).get('/api/v1/search?zip=97205&radius=25&genre=jazz');
    expect(ids(res)).toEqual(['near', 'near-old', 'mid']);
    expect(res.body.genres).toEqual(['Jazz', 'Jázz', 'Rock']);
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
