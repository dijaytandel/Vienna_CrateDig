import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { SightingDetail, SightingRepository } from '../sightings/repository.js';
import type { StoreRepository } from '../stores/repository.js';
import { AS_ALICE, fakeAuth } from '../test/fakeAuth.js';

const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const STORE = uuid(900);
const OTHER = uuid(901);
const AS_MANAGER = ['Authorization', 'Bearer mgr'] as const;

const sighting = (n: number, storeId = STORE, status: SightingDetail['status'] = 'active') =>
  ({
    sightingId: uuid(n),
    priceUsd: 20,
    conditionGrade: 'vg',
    specialAttributes: null,
    storeVerified: false,
    status,
    sightingTimestamp: '2026-11-20T00:00:00.000Z',
    archiveDate: '2027-05-19T00:00:00.000Z',
    reporter: { userId: 'alice', displayName: 'Alice' },
    record: { recordId: uuid(500), artistName: 'A', albumTitle: 'B' },
    store: { storeId, businessName: 'S', isVerified: true },
  }) as unknown as SightingDetail;

function setup() {
  const rows = [sighting(1), sighting(2, OTHER), sighting(3, STORE, 'archived')];
  const sightings = {
    get: vi.fn(async (id: string) => rows.find((r) => r.sightingId === id) ?? null),
    moderate: vi.fn(async (_actor: string, id: string, action: string) => {
      const r = rows.find((x) => x.sightingId === id)!;
      return {
        ...r,
        storeVerified: action === 'confirm' || r.storeVerified,
        status: action === 'flag' ? 'flagged' : action === 'mark_sold' ? 'sold_out' : r.status,
      };
    }),
    listActiveForStore: vi.fn(async () => [rows[0]]),
  } as unknown as SightingRepository;
  const stores = {
    updateManaged: vi.fn(async () => {}),
    getById: vi.fn(async () => ({ store: { storeId: STORE }, sightings: [], broadcasts: [] })),
  } as unknown as StoreRepository;
  const app = createApp({
    auth: fakeAuth({ alice: 'collector', mgr: 'store_manager' }, { mgr: STORE }),
    sightings,
    stores,
  });
  return { app, sightings, stores };
}

describe('PATCH /api/v1/sightings/:id', () => {
  it.each([
    ['confirm', { storeVerified: true, status: 'active' }],
    ['flag', { status: 'flagged' }],
    ['mark_sold', { status: 'sold_out' }],
  ])('%s', async (action, expected) => {
    const { app, sightings } = setup();
    const res = await request(app)
      .patch(`/api/v1/sightings/${uuid(1)}`)
      .set(...AS_MANAGER)
      .send({ action });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(expected);
    expect(sightings.moderate).toHaveBeenCalledWith('mgr', uuid(1), action);
  });

  it('rejects collectors, other stores, archived rows and bad actions', async () => {
    const { app, sightings } = setup();
    const patch = (id: string, body: object, as: readonly [string, string] = AS_MANAGER) =>
      request(app)
        .patch(`/api/v1/sightings/${id}`)
        .set(...as)
        .send(body);
    expect((await patch(uuid(1), { action: 'confirm' }, AS_ALICE)).status).toBe(403);
    expect((await patch(uuid(2), { action: 'confirm' })).status).toBe(403);
    expect((await patch(uuid(3), { action: 'flag' })).status).toBe(409);
    expect((await patch(uuid(1), { action: 'delete' })).status).toBe(400);
    expect((await patch(uuid(9), { action: 'flag' })).status).toBe(404);
    expect(sightings.moderate).not.toHaveBeenCalled();
  });
});

describe('/api/v1/merchant', () => {
  it('lists the manager’s queue', async () => {
    const { app, sightings } = setup();
    const res = await request(app)
      .get('/api/v1/merchant/sightings')
      .set(...AS_MANAGER);
    expect(res.status).toBe(200);
    expect(res.body.storeId).toBe(STORE);
    expect(res.body.sightings).toHaveLength(1);
    expect(sightings.listActiveForStore).toHaveBeenCalledWith(STORE, 100);
    expect(
      (
        await request(app)
          .get('/api/v1/merchant/sightings')
          .set(...AS_ALICE)
      ).status,
    ).toBe(403);
  });

  it('updates editable store fields with normalized phone and hours', async () => {
    const { app, stores } = setup();
    const res = await request(app)
      .patch('/api/v1/merchant/store')
      .set(...AS_MANAGER)
      .send({
        phone: '+1 503.555.0100',
        websiteUrl: '',
        operatingHours: {
          mon: { open: '10:00', close: '19:00' },
          tue: null,
          wed: null,
          thu: null,
          fri: { open: '10:00', close: '24:00' },
          sat: null,
          sun: null,
        },
        paymentMethods: ['Cash', 'Card'],
        tags: ['Jazz'],
      });
    expect(res.status).toBe(200);
    expect(stores.updateManaged).toHaveBeenCalledWith(STORE, {
      phone: '(503) 555-0100',
      websiteUrl: null,
      operatingHours: expect.objectContaining({ fri: { open: '10:00', close: '24:00' } }),
      paymentMethods: ['Cash', 'Card'],
      tags: ['Jazz'],
    });
  });

  it.each([
    [{ phone: '555-0100' }, 'phone'],
    [{ websiteUrl: 'ftp://x.test' }, 'websiteUrl'],
    [{ operatingHours: { mon: { open: '19:00', close: '10:00' } } }, 'operatingHours.mon'],
    [{ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, 'tags'],
    [{ businessName: 'New name' }, ''],
  ])('rejects %j', async (body, path) => {
    const { app, stores } = setup();
    const res = await request(app)
      .patch('/api/v1/merchant/store')
      .set(...AS_MANAGER)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.issues[0].path).toBe(path);
    expect(stores.updateManaged).not.toHaveBeenCalled();
  });
});
