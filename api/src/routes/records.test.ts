import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { RecordRepository } from '../records/repository.js';
import type { StoreRepository } from '../stores/repository.js';

const REC = '00000000-0000-4000-9000-000000000001';
const sighting = (id: string, name: string, lat: number) => ({
  sightingId: id,
  priceUsd: 28,
  conditionGrade: 'vg',
  specialAttributes: null,
  storeVerified: false,
  sightingTimestamp: '2026-11-20T00:00:00Z',
  store: { storeId: id, businessName: name, geoLat: lat, geoLng: -122.7 },
});

function app() {
  const recordDetails: RecordRepository = {
    get: vi.fn(async (id: string) =>
      id === REC
        ? {
            record: {
              recordId: REC,
              apiSourceId: 'seed:x',
              artistName: 'A',
              albumTitle: 'B',
              songTitle: null,
              recordLabel: null,
              releaseYear: null,
              genre: null,
              coverArtUrl: null,
            },
            sightings: [sighting('far', 'Far', 45.9), sighting('near', 'Near', 45.53)],
          }
        : null,
    ),
  };
  const stores: StoreRepository = {
    zipCentroid: vi.fn(async (zip: string) =>
      zip === '97205' ? { lat: 45.520562, lng: -122.710231 } : null,
    ),
    listInBox: vi.fn(async () => []),
    getById: vi.fn(async () => null),
  };
  return createApp({ recordDetails, stores });
}

describe('GET /api/v1/records/:id', () => {
  it('sorts active sightings nearest first', async () => {
    const res = await request(app()).get(`/api/v1/records/${REC}?zip=97205`);
    expect(res.status).toBe(200);
    expect(res.body.activeSightings.map((s: { sightingId: string }) => s.sightingId)).toEqual([
      'near',
      'far',
    ]);
    expect(res.body.activeSightings[0].distance).toBeLessThan(2);
  });

  it('still opens when the ZIP has no Census centroid', async () => {
    const res = await request(app()).get(`/api/v1/records/${REC}?zip=82715`);
    expect(res.status).toBe(200);
    expect(res.body.activeSightings[0].distance).toBeNull();
  });

  it('404s for unknown records', async () => {
    const res = await request(app()).get('/api/v1/records/00000000-0000-4000-9000-000000000099');
    expect(res.status).toBe(404);
  });
});
