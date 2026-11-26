import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { MasterRecordRepository } from '../catalog/repository.js';
import { createCatalogService } from '../catalog/service.js';
import type { SightingDetail, SightingRepository } from '../sightings/repository.js';
import type { StoreRepository, StoreSummary } from '../stores/repository.js';
import { AS_ALICE, fakeAuth } from '../test/fakeAuth.js';

const STORE = '00000000-0000-4000-8000-000000000001';
const RECORD = '00000000-0000-4000-9000-000000000001';
const SIGHTING = '00000000-0000-4000-b000-000000000001';

const store = (id: string, lat: number, lng: number, isVerified = true): StoreSummary => ({
  storeId: `00000000-0000-4000-8000-0000000000${id}`,
  businessName: `Store ${id}`,
  streetAddress: '1 Main St',
  city: 'Portland',
  state: 'OR',
  zip: '97205',
  geoLat: lat,
  geoLng: lng,
  tags: [],
  isVerified,
});

const sighting: SightingDetail = {
  sightingId: SIGHTING,
  priceUsd: 28,
  conditionGrade: 'near_mint',
  specialAttributes: '180g',
  storeVerified: false,
  status: 'active',
  sightingTimestamp: '2026-11-25T00:00:00Z',
  archiveDate: '2027-05-24T00:00:00Z',
  reporter: { userId: 'alice', displayName: 'Alice' },
  record: {
    recordId: RECORD,
    apiSourceId: 'seed:kind-of-blue',
    artistName: 'Miles Davis',
    albumTitle: 'Kind of Blue',
    songTitle: null,
    recordLabel: null,
    releaseYear: 1959,
    genre: 'Jazz',
    coverArtUrl: null,
  },
  store: { ...store('01', 45.5216, -122.6826), isVerified: true },
};

function setup(count = 0) {
  const stores: StoreRepository = {
    zipCentroid: vi.fn(async () => ({ lat: 45.520562, lng: -122.710231 })),
    // Unverified store is closest; verified ones ~0.4 and ~20 mi away.
    listInBox: vi.fn(async () => [
      store('09', 45.5206, -122.7101, false),
      store('01', 45.5216, -122.6826),
      store('04', 45.8, -122.6),
    ]),
    getById: vi.fn(async () => null),
  };
  const sightings: SightingRepository = {
    get: vi.fn(async (id) => (id === SIGHTING ? sighting : null)),
    byClientRef: vi.fn(async () => null),
    countSince: vi.fn(async () => count),
    create: vi.fn(async () => sighting),
    moderate: vi.fn(async () => sighting),
  };
  const records: MasterRecordRepository = { upsert: vi.fn(async () => RECORD) };
  const app = createApp({
    auth: fakeAuth(),
    catalog: createCatalogService([]),
    records,
    stores,
    sightings,
    now: () => new Date('2026-11-26T00:00:00Z'),
  });
  return { app, sightings };
}

describe('POST /api/v1/sightings', () => {
  const body = { recordId: RECORD, storeId: STORE, conditionGrade: 'vg_plus', priceUsd: 19.99 };

  it('requires login', async () => {
    expect((await request(setup().app).post('/api/v1/sightings').send(body)).status).toBe(401);
  });

  it('creates a sighting; the server sets status and verification', async () => {
    const { app, sightings } = setup();
    const res = await request(app)
      .post('/api/v1/sightings')
      .set(...AS_ALICE)
      .send({
        ...body,
        status: 'sold_out',
        storeVerified: true,
        specialAttributes: ['180g', 'Remaster'],
      });
    expect(res.status).toBe(201);
    expect(sightings.create).toHaveBeenCalledWith('alice', {
      recordId: RECORD,
      storeId: STORE,
      priceUsd: 19.99,
      conditionGrade: 'vg_plus',
      specialAttributes: '180g, Remaster',
      clientRef: undefined,
    });
  });

  it.each([
    [{ ...body, conditionGrade: undefined }, 'conditionGrade'],
    [{ ...body, storeId: 'x' }, 'storeId'],
    [{ storeId: STORE, conditionGrade: 'vg' }, 'apiSourceId'],
    [{ ...body, priceUsd: -1 }, 'priceUsd'],
    [{ ...body, specialAttributes: Array(6).fill('x'.repeat(40)) }, 'specialAttributes'],
  ])('rejects %j', async (b, field) => {
    const res = await request(setup().app)
      .post('/api/v1/sightings')
      .set(...AS_ALICE)
      .send(b);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toContain(field);
  });

  it('limits each user to 20 sightings a day', async () => {
    const res = await request(setup(20).app)
      .post('/api/v1/sightings')
      .set(...AS_ALICE)
      .send(body);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('replays an idempotent report', async () => {
    const { app, sightings } = setup();
    vi.mocked(sightings.byClientRef).mockResolvedValueOnce(sighting);
    const res = await request(app)
      .post('/api/v1/sightings')
      .set(...AS_ALICE)
      .set('Idempotency-Key', '6b1f3c2e-1d2a-4f5b-9c8d-7e6f5a4b3c2d')
      .send(body);
    expect(res.status).toBe(200);
    expect(sightings.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/sightings/:id', () => {
  it('returns the sighting with distance', async () => {
    const res = await request(setup().app).get(`/api/v1/sightings/${SIGHTING}?zip=97205`);
    expect(res.status).toBe(200);
    expect(res.body.distance).toBeCloseTo(1.3, 0);
    expect(res.body.archiveDate).toBe(sighting.archiveDate);
  });

  it('404s for unknown sightings', async () => {
    const res = await request(setup().app).get(`/api/v1/sightings/${STORE}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/stores/nearest', () => {
  it('returns the closest verified store in miles', async () => {
    const res = await request(setup().app).get('/api/v1/stores/nearest?lat=45.5206&lng=-122.7101');
    expect(res.status).toBe(200);
    expect(res.body.store.businessName).toBe('Store 01');
    expect(res.body.unit).toBe('mi');
  });

  it('requires coordinates', async () => {
    expect((await request(setup().app).get('/api/v1/stores/nearest')).status).toBe(400);
  });
});
