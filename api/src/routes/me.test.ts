import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { Profile, ProfileRepository } from '../me/repository.js';
import type { StoreRepository } from '../stores/repository.js';
import { AS_ALICE, fakeAuth } from '../test/fakeAuth.js';

const PROFILE: Profile = {
  userId: 'alice',
  email: 'a@x.test',
  displayName: 'Alice',
  role: 'collector',
  defaultZip: '97205',
  radiusMiles: 10,
  distanceUnit: 'mi',
  genres: [],
  favoriteStoreIds: [],
  pushBroadcastsEnabled: false,
};
const S1 = '00000000-0000-4000-8000-000000000001';

function setup() {
  const profiles = {
    get: vi.fn(async () => PROFILE),
    update: vi.fn(async (_id: string, patch: object) => ({ ...PROFILE, ...patch })),
  } as unknown as ProfileRepository;
  const stores = {
    zipCentroid: vi.fn(async (zip: string) => (zip === '00000' ? null : { lat: 1, lng: 2 })),
  } as unknown as StoreRepository;
  return { app: createApp({ auth: fakeAuth({ alice: 'collector' }), profiles, stores }), profiles };
}

describe('/api/v1/me', () => {
  it('requires login', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/v1/me')).status).toBe(401);
  });

  it('returns the profile', async () => {
    const { app } = setup();
    const res = await request(app)
      .get('/api/v1/me')
      .set(...AS_ALICE);
    expect(res.body).toEqual(PROFILE);
  });

  it('saves preferences, trimming and de-duplicating', async () => {
    const { app, profiles } = setup();
    const res = await request(app)
      .patch('/api/v1/me')
      .set(...AS_ALICE)
      .send({
        displayName: ' Ali ',
        defaultZip: '10001',
        radiusMiles: 25,
        distanceUnit: 'km',
        genres: ['Jazz', 'Jazz', 'Soul'],
        favoriteStoreIds: [S1, S1],
      });
    expect(res.status).toBe(200);
    expect(profiles.update).toHaveBeenCalledWith('alice', {
      displayName: 'Ali',
      defaultZip: '10001',
      radiusMiles: 25,
      distanceUnit: 'km',
      genres: ['Jazz', 'Soul'],
      favoriteStoreIds: [S1],
    });
    expect(res.body.distanceUnit).toBe('km');
  });

  it.each([
    [{ defaultZip: '1234' }, 400],
    [{ defaultZip: '00000' }, 400],
    [{ radiusMiles: 15 }, 400],
    [{ distanceUnit: 'ft' }, 400],
    [{ displayName: '' }, 400],
    [{ role: 'admin' }, 400],
  ])('rejects %j', async (body, status) => {
    const { app, profiles } = setup();
    const res = await request(app)
      .patch('/api/v1/me')
      .set(...AS_ALICE)
      .send(body);
    expect(res.status).toBe(status);
    expect(profiles.update).not.toHaveBeenCalled();
  });
});
