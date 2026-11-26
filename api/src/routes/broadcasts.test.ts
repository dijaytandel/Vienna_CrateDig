import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { notifyBroadcast, type PushSender } from '../broadcasts/push.js';
import type {
  BroadcastRepository,
  BroadcastSummary,
  PushSubscriptionJson,
  PushTarget,
} from '../broadcasts/repository.js';
import type { BroadcastDetail, FeedRepository } from '../feed/repository.js';
import { AS_ALICE, fakeAuth } from '../test/fakeAuth.js';

const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
const STORE = uuid(900);
const RECORD = uuid(500);
const AS_MANAGER = ['Authorization', 'Bearer mgr'] as const;
const AS_PENDING = ['Authorization', 'Bearer pending'] as const;

const sub = (n: number): PushSubscriptionJson => ({
  endpoint: `https://push.test/${n}`,
  keys: { p256dh: 'k', auth: 'a' },
});

function setup({
  targets = [] as PushTarget[],
  statuses = {} as Record<string, number>,
  withPush = true,
} = {}) {
  const saved: BroadcastSummary[] = [];
  const broadcasts: BroadcastRepository = {
    create: vi.fn(async (b) => {
      const row = {
        broadcastId: uuid(700 + saved.length),
        arrivalSummary: b.arrivalSummary,
        photoUrl: b.photoUrl,
        featuredIds: b.featuredIds,
        postedAt: new Date().toISOString(),
      };
      saved.unshift(row);
      return row;
    }),
    listForStore: vi.fn(async () => saved),
    existingRecordIds: vi.fn(async (ids: string[]) => ids.filter((id) => id === RECORD)),
    pushTargets: vi.fn(async () => targets),
    saveSubscription: vi.fn(async () => {}),
    removeSubscription: vi.fn(async () => {}),
  };
  const feed: FeedRepository = {
    page: vi.fn(),
    preferences: vi.fn(),
    broadcast: vi.fn(async (id: string): Promise<BroadcastDetail | null> => {
      const b = saved.find((s) => s.broadcastId === id);
      return b
        ? {
            broadcastId: b.broadcastId,
            arrivalSummary: b.arrivalSummary,
            photoUrl: b.photoUrl,
            postedAt: b.postedAt,
            store: {
              storeId: STORE,
              businessName: 'Low End Theory',
              isVerified: true,
              streetAddress: '1 Main St',
              city: 'Portland',
              state: 'OR',
              zip: '97205',
              geoLat: 45.5,
              geoLng: -122.7,
            },
            featured: [],
          }
        : null;
    }),
  };
  const send = vi.fn(async (s: PushSubscriptionJson) => statuses[s.endpoint] ?? 201);
  const push: PushSender = { publicKey: 'BPUBLIC', send };
  const app = createApp({
    auth: fakeAuth(
      { alice: 'collector', mgr: 'store_manager', pending: 'store_manager' },
      { mgr: STORE },
    ),
    broadcasts,
    feed,
    push: withPush ? push : undefined,
  });
  return { app, broadcasts, send };
}

describe('POST /api/v1/broadcasts', () => {
  const body = { arrivalSummary: '  200 fresh soul 45s  ', featuredIds: [RECORD] };

  it('publishes for the verified manager and returns the detail', async () => {
    const { app, broadcasts } = setup();
    const res = await request(app)
      .post('/api/v1/broadcasts')
      .set(...AS_MANAGER)
      .send({ ...body, photoUrl: 'https://example.com/a.jpg' });
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/broadcasts/${res.body.broadcastId}`);
    expect(res.body).toMatchObject({
      arrivalSummary: '200 fresh soul 45s',
      photoUrl: 'https://example.com/a.jpg',
      store: { storeId: STORE },
    });
    expect(broadcasts.create).toHaveBeenCalledWith({
      storeId: STORE,
      arrivalSummary: '200 fresh soul 45s',
      photoUrl: 'https://example.com/a.jpg',
      featuredIds: [RECORD],
    });
  });

  it.each([
    ['no token', null, 401],
    ['a collector', AS_ALICE, 403],
    ['a manager whose store is not verified', AS_PENDING, 403],
  ])('rejects %s', async (_label, header, status) => {
    const { app, broadcasts } = setup();
    const req = request(app).post('/api/v1/broadcasts');
    if (header) void req.set(...header);
    expect((await req.send(body)).status).toBe(status);
    expect(broadcasts.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ arrivalSummary: '' }, 'arrivalSummary'],
    [{ arrivalSummary: 'x'.repeat(501) }, 'arrivalSummary'],
    [{ arrivalSummary: 'ok', photoUrl: 'http://example.com/a.jpg' }, 'photoUrl'],
    [
      { arrivalSummary: 'ok', featuredIds: Array.from({ length: 11 }, (_, i) => uuid(i)) },
      'featuredIds',
    ],
    [{ arrivalSummary: 'ok', featuredIds: [RECORD, RECORD] }, 'featuredIds'],
    [{ arrivalSummary: 'ok', featuredIds: [uuid(1)] }, 'featuredIds'],
  ])('validates %j', async (input, path) => {
    const { app, broadcasts } = setup();
    const res = await request(app)
      .post('/api/v1/broadcasts')
      .set(...AS_MANAGER)
      .send(input);
    expect(res.status).toBe(400);
    expect(res.body.error.details.issues[0].path).toBe(path);
    expect(broadcasts.create).not.toHaveBeenCalled();
  });

  it('pushes to every target device and drops dead subscriptions', async () => {
    const { app, send, broadcasts } = setup({
      targets: [
        { userId: 'u1', subscriptions: [sub(1), sub(2)] },
        { userId: 'u2', subscriptions: [sub(3)] },
      ],
      statuses: { 'https://push.test/2': 410, 'https://push.test/3': 404 },
    });
    const res = await request(app)
      .post('/api/v1/broadcasts')
      .set(...AS_MANAGER)
      .send(body);
    expect(res.body.notified).toEqual({ sent: 1, removed: 2, failed: 0 });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[0]![1]).toEqual({
      title: 'New arrivals at Low End Theory',
      body: '200 fresh soul 45s',
      url: `/broadcasts/${res.body.broadcastId}`,
      tag: `broadcast-${res.body.broadcastId}`,
    });
    expect(broadcasts.pushTargets).toHaveBeenCalledWith(STORE);
    expect(broadcasts.removeSubscription).toHaveBeenCalledWith('https://push.test/2');
    expect(broadcasts.removeSubscription).toHaveBeenCalledWith('https://push.test/3');
  });

  it('sends nothing when nobody is opted in or in range', async () => {
    const { app, send } = setup({ targets: [] });
    const res = await request(app)
      .post('/api/v1/broadcasts')
      .set(...AS_MANAGER)
      .send(body);
    expect(res.status).toBe(201);
    expect(send).not.toHaveBeenCalled();
  });

  it('still publishes when push is not configured', async () => {
    const { app } = setup({ withPush: false });
    const res = await request(app)
      .post('/api/v1/broadcasts')
      .set(...AS_MANAGER)
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body.notified).toBeNull();
  });
});

describe('notifyBroadcast', () => {
  it('counts network failures without removing the subscription', async () => {
    const repo = {
      pushTargets: async () => [{ userId: 'u', subscriptions: [sub(1)] }],
      removeSubscription: vi.fn(),
    } as unknown as BroadcastRepository;
    const sender: PushSender = { publicKey: 'k', send: () => Promise.reject(new Error('down')) };
    const result = await notifyBroadcast(repo, sender, {
      broadcastId: 'b',
      storeId: 's',
      businessName: 'X',
      arrivalSummary: 'y'.repeat(300),
    });
    expect(result).toEqual({ sent: 0, removed: 0, failed: 1 });
    expect(repo.removeSubscription).not.toHaveBeenCalled();
  });
});

describe('broadcast history', () => {
  it('lists a store’s broadcasts publicly, newest first', async () => {
    const { app, broadcasts } = setup();
    await request(app)
      .post('/api/v1/broadcasts')
      .set(...AS_MANAGER)
      .send({ arrivalSummary: 'a' });
    await request(app)
      .post('/api/v1/broadcasts')
      .set(...AS_MANAGER)
      .send({ arrivalSummary: 'b' });
    const res = await request(app).get(`/api/v1/stores/${STORE}/broadcasts`);
    expect(res.status).toBe(200);
    expect(res.body.broadcasts.map((b: BroadcastSummary) => b.arrivalSummary)).toEqual(['b', 'a']);
    expect(broadcasts.listForStore).toHaveBeenCalledWith(STORE, 50);
  });

  it('rejects a bad store id', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/v1/stores/nope/broadcasts')).status).toBe(400);
  });

  it('gives the manager their own history', async () => {
    const { app } = setup();
    const res = await request(app)
      .get('/api/v1/merchant/broadcasts')
      .set(...AS_MANAGER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ storeId: STORE, broadcasts: [] });
    expect(
      (
        await request(app)
          .get('/api/v1/merchant/broadcasts')
          .set(...AS_ALICE)
      ).status,
    ).toBe(403);
  });
});

describe('push subscriptions', () => {
  const subscription = sub(9);

  it('exposes the VAPID public key, or 503 without push', async () => {
    expect((await request(setup().app).get('/api/v1/push/public-key')).body).toEqual({
      publicKey: 'BPUBLIC',
    });
    expect(
      (await request(setup({ withPush: false }).app).get('/api/v1/push/public-key')).status,
    ).toBe(503);
  });

  it('saves and removes the caller’s subscription', async () => {
    const { app, broadcasts } = setup();
    const put = await request(app)
      .put('/api/v1/push/subscription')
      .set(...AS_ALICE)
      .send(subscription);
    expect(put.status).toBe(204);
    expect(broadcasts.saveSubscription).toHaveBeenCalledWith('alice', subscription);
    const del = await request(app)
      .delete('/api/v1/push/subscription')
      .set(...AS_ALICE)
      .send({ endpoint: subscription.endpoint });
    expect(del.status).toBe(204);
    expect(broadcasts.removeSubscription).toHaveBeenCalledWith(subscription.endpoint, 'alice');
  });

  it('requires login and an https endpoint with keys', async () => {
    const { app } = setup();
    expect((await request(app).put('/api/v1/push/subscription').send(subscription)).status).toBe(
      401,
    );
    const bad = await request(app)
      .put('/api/v1/push/subscription')
      .set(...AS_ALICE)
      .send({ endpoint: 'http://push.test/1', keys: {} });
    expect(bad.status).toBe(400);
  });
});
