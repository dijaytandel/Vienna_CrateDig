import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { MasterRecordRepository } from '../catalog/repository.js';
import { createCatalogService } from '../catalog/service.js';
import type { CatalogProvider, CatalogResult } from '../catalog/types.js';
import type { CrateItem, CrateRepository } from '../crate/repository.js';
import { AS_ALICE, fakeAuth } from '../test/fakeAuth.js';

const RECORD_ID = '00000000-0000-4000-9000-000000000001';
const ITEM_ID = '00000000-0000-4000-a000-000000000001';
const STORE_ID = '00000000-0000-4000-8000-000000000001';

const nevermind: CatalogResult = {
  apiSourceId: 'discogs:249504',
  artistName: 'Nirvana',
  albumTitle: 'Nevermind',
  songTitle: null,
  recordLabel: 'DGC',
  releaseYear: 1991,
  genre: 'Rock',
  coverArtUrl: null,
};

const item = (over: Partial<CrateItem> = {}): CrateItem => ({
  crateItemId: ITEM_ID,
  listType: 'collection',
  conditionGrade: null,
  specialAttributes: [],
  purchasePriceUsd: null,
  userNotes: null,
  acquiredAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  purchasedStore: null,
  record: { recordId: RECORD_ID, ...nevermind },
  ...over,
});

function setup(owned = false) {
  const upstream: CatalogProvider = {
    name: 'mock',
    search: vi.fn(async () => []),
    getById: vi.fn(async (id: string) => (id === nevermind.apiSourceId ? nevermind : null)),
  };
  const records: MasterRecordRepository = { upsert: vi.fn(async () => RECORD_ID) };
  const crate: CrateRepository = {
    list: vi.fn(async () => [item()]),
    get: vi.fn(async (_u, id) => (id === ITEM_ID ? item() : null)),
    byClientRef: vi.fn(async () => null),
    hasRecord: vi.fn(async () => owned),
    insert: vi.fn(async (_u, i) => item({ listType: i.listType })),
    update: vi.fn(async (_u, id, p) => (id === ITEM_ID ? item({ userNotes: p.userNotes }) : null)),
    remove: vi.fn(async (_u, id) => id === ITEM_ID),
    acquire: vi.fn(async (_u, id, storeId) =>
      id !== ITEM_ID
        ? { ok: false as const, reason: 'not_found' as const }
        : {
            ok: true as const,
            item: item({ acquiredAt: '2026-11-02T00:00:00Z' }),
            closedSightingIds: storeId ? ['s1'] : [],
          },
    ),
  };
  const app = createApp({
    auth: fakeAuth({ alice: 'collector' }),
    catalog: createCatalogService([upstream]),
    records,
    crate,
  });
  return { app, crate, records };
}

describe('crate API', () => {
  it('requires a signed-in user on every endpoint', async () => {
    const { app } = setup();
    for (const [method, path] of [
      ['get', '/api/v1/crate'],
      ['post', '/api/v1/crate'],
      ['patch', `/api/v1/crate/${ITEM_ID}`],
      ['delete', `/api/v1/crate/${ITEM_ID}`],
      ['post', `/api/v1/crate/${ITEM_ID}/acquire`],
    ] as const) {
      const res = await request(app)[method](path);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it('lists only the caller’s items with filters', async () => {
    const { app, crate } = setup();
    const res = await request(app)
      .get('/api/v1/crate?listType=want_list&q=nirv&genre=Rock')
      .set(...AS_ALICE);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(crate.list).toHaveBeenCalledWith('alice', {
      listType: 'want_list',
      q: 'nirv',
      genre: 'Rock',
    });
  });

  it('adds a catalog record and saves it as a master record', async () => {
    const { app, crate, records } = setup();
    const res = await request(app)
      .post('/api/v1/crate')
      .set(...AS_ALICE)
      .send({
        apiSourceId: 'discogs:249504',
        listType: 'collection',
        conditionGrade: 'vg_plus',
        specialAttributes: ['180g'],
        purchasePriceUsd: 24.99,
        userNotes: 'Found at Groove',
      });
    expect(res.status).toBe(201);
    expect(records.upsert).toHaveBeenCalledWith(nevermind);
    expect(crate.insert).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({ recordId: RECORD_ID, purchasePriceUsd: 24.99 }),
    );
  });

  it('accepts an existing record id without a catalog call', async () => {
    const { app, records } = setup();
    const res = await request(app)
      .post('/api/v1/crate')
      .set(...AS_ALICE)
      .send({ recordId: RECORD_ID, listType: 'want_list' });
    expect(res.status).toBe(201);
    expect(records.upsert).not.toHaveBeenCalled();
  });

  it('warns about duplicates unless forced', async () => {
    const { app } = setup(true);
    const body = { recordId: RECORD_ID, listType: 'collection' };
    const dup = await request(app)
      .post('/api/v1/crate')
      .set(...AS_ALICE)
      .send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ALREADY_OWNED');
    const forced = await request(app)
      .post('/api/v1/crate')
      .set(...AS_ALICE)
      .send({ ...body, force: true });
    expect(forced.status).toBe(201);
  });

  it('replays an idempotent add instead of duplicating it', async () => {
    const { app, crate } = setup();
    vi.mocked(crate.byClientRef).mockResolvedValueOnce(item());
    const res = await request(app)
      .post('/api/v1/crate')
      .set(...AS_ALICE)
      .set('Idempotency-Key', '6b1f3c2e-1d2a-4f5b-9c8d-7e6f5a4b3c2d')
      .send({ recordId: RECORD_ID, listType: 'collection' });
    expect(res.status).toBe(200);
    expect(crate.insert).not.toHaveBeenCalled();
  });

  it.each([
    [{ listType: 'collection' }, 'apiSourceId'],
    [{ recordId: RECORD_ID, listType: 'shelf' }, 'listType'],
    [{ recordId: RECORD_ID, listType: 'collection', purchasePriceUsd: -1 }, 'purchasePriceUsd'],
    [{ recordId: RECORD_ID, listType: 'collection', purchasePriceUsd: 1.234 }, 'purchasePriceUsd'],
    [{ recordId: RECORD_ID, listType: 'collection', userNotes: 'x'.repeat(1001) }, 'userNotes'],
  ])('rejects invalid input %j with field errors', async (body, field) => {
    const { app } = setup();
    const res = await request(app)
      .post('/api/v1/crate')
      .set(...AS_ALICE)
      .send(body);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toContain(field);
  });

  it('edits and deletes owned items, 404 otherwise', async () => {
    const { app } = setup();
    const other = '00000000-0000-4000-a000-000000000099';
    const patch = await request(app)
      .patch(`/api/v1/crate/${ITEM_ID}`)
      .set(...AS_ALICE)
      .send({ userNotes: 'Cleaned' });
    expect(patch.body.userNotes).toBe('Cleaned');
    expect(
      (
        await request(app)
          .patch(`/api/v1/crate/${other}`)
          .set(...AS_ALICE)
          .send({ userNotes: 'x' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/v1/crate/${ITEM_ID}`)
          .set(...AS_ALICE)
      ).status,
    ).toBe(204);
    expect(
      (
        await request(app)
          .delete(`/api/v1/crate/${other}`)
          .set(...AS_ALICE)
      ).status,
    ).toBe(404);
  });

  it('acquires at a store and returns the closed sightings', async () => {
    const { app, crate } = setup();
    const res = await request(app)
      .post(`/api/v1/crate/${ITEM_ID}/acquire`)
      .set(...AS_ALICE)
      .send({ storeId: STORE_ID, purchasePriceUsd: 20 });
    expect(res.status).toBe(200);
    expect(res.body.closedSightingIds).toEqual(['s1']);
    expect(crate.acquire).toHaveBeenCalledWith('alice', ITEM_ID, STORE_ID, 20);
  });

  it('acquires elsewhere and refuses Collection items', async () => {
    const { app, crate } = setup();
    const elsewhere = await request(app)
      .post(`/api/v1/crate/${ITEM_ID}/acquire`)
      .set(...AS_ALICE)
      .send({ storeId: null });
    expect(elsewhere.body.closedSightingIds).toEqual([]);
    vi.mocked(crate.acquire).mockResolvedValueOnce({ ok: false, reason: 'not_want_list' });
    const res = await request(app)
      .post(`/api/v1/crate/${ITEM_ID}/acquire`)
      .set(...AS_ALICE)
      .send({ storeId: null });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_ON_WANT_LIST');
  });
});
