import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { fakeAuth } from '../test/fakeAuth.js';
import { currentStoreId, currentUser, requireAuth, requireVerifiedManager } from './auth.js';

const users = {
  alice: 'collector',
  mara: 'store_manager',
  pending: 'store_manager',
} as const;

function app(auth = fakeAuth(users, { mara: 'store-1' })) {
  return createApp({
    auth,
    catalog: { search: async () => [], getById: async () => null },
    configure(v1, configured) {
      v1.get('/me', requireAuth(configured), (_req, res) => {
        res.json(currentUser(res));
      });
      v1.post('/merchant/ping', ...requireVerifiedManager(configured), (_req, res) => {
        res.json({ storeId: currentStoreId(res) });
      });
    },
  });
}

describe('requireAuth', () => {
  it('returns 401 without a token, with a malformed header, or with a bad token', async () => {
    for (const header of [undefined, 'alice', 'Basic alice', 'Bearer nobody']) {
      const req = request(app()).get('/api/v1/me');
      const res = await (header ? req.set('Authorization', header) : req);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.headers['www-authenticate']).toMatch(/^Bearer/);
    }
  });

  it('exposes the caller', async () => {
    const res = await request(app()).get('/api/v1/me').set('Authorization', 'Bearer alice');
    expect(res.body).toEqual({ id: 'alice', role: 'collector' });
  });

  it('returns 503 when auth is not configured', async () => {
    const res = await request(createApp({ auth: undefined }))
      .post('/api/v1/catalog/records')
      .set('Authorization', 'Bearer alice')
      .send({ apiSourceId: 'discogs:1' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AUTH_UNAVAILABLE');
  });
});

describe('requireVerifiedManager', () => {
  it.each([
    ['a collector', 'alice'],
    ['a manager without a verified store', 'pending'],
  ])('returns 403 for %s', async (_, token) => {
    const res = await request(app())
      .post('/api/v1/merchant/ping')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('scopes the request to the manager’s own verified store', async () => {
    const res = await request(app())
      .post('/api/v1/merchant/ping')
      .set('Authorization', 'Bearer mara');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ storeId: 'store-1' });
  });

  it('returns 401 before 403 for guests', async () => {
    const res = await request(app()).post('/api/v1/merchant/ping');
    expect(res.status).toBe(401);
  });
});
