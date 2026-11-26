import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { AS_ALICE, fakeAuth } from '../test/fakeAuth.js';
import { ClaimError, type VerificationRepository } from '../verification/repository.js';

const STORE = '00000000-0000-4000-8000-000000000002';
const claim = {
  storeId: STORE,
  businessName: 'Spin City',
  city: 'Portland',
  state: 'OR',
  status: 'pending',
  licenseDocUrl: 'https://license.test/a',
};

function setup(claimImpl?: VerificationRepository['claim']) {
  const verification = {
    myClaim: vi.fn(async () => claim),
    claimable: vi.fn(async () => [{ storeId: STORE, businessName: 'Spin City' }]),
    claim: vi.fn(claimImpl ?? (async () => {})),
  } as unknown as VerificationRepository;
  const app = createApp({ auth: fakeAuth({ alice: 'collector' }), verification });
  return { app, verification };
}

describe('/api/v1/merchant verification', () => {
  it('requires login', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/v1/merchant/verification')).status).toBe(401);
    expect((await request(app).post('/api/v1/merchant/verification').send({})).status).toBe(401);
  });

  it('shows the caller’s claim and the stores they can apply for', async () => {
    const { app, verification } = setup();
    const mine = await request(app)
      .get('/api/v1/merchant/verification')
      .set(...AS_ALICE);
    expect(mine.body).toEqual({ claim });
    const list = await request(app)
      .get('/api/v1/merchant/claimable-stores')
      .set(...AS_ALICE);
    expect(list.body.stores).toHaveLength(1);
    expect(verification.claimable).toHaveBeenCalledWith('alice');
  });

  it('submits a claim with an https license URL', async () => {
    const { app, verification } = setup();
    const res = await request(app)
      .post('/api/v1/merchant/verification')
      .set(...AS_ALICE)
      .send({ storeId: STORE, licenseDocUrl: 'https://license.test/a' });
    expect(res.status).toBe(201);
    expect(res.body.claim.status).toBe('pending');
    expect(verification.claim).toHaveBeenCalledWith('alice', STORE, 'https://license.test/a');
  });

  it.each([
    [{ storeId: STORE, licenseDocUrl: 'http://license.test/a' }, 'licenseDocUrl'],
    [{ storeId: 'nope', licenseDocUrl: 'https://license.test/a' }, 'storeId'],
    [{ storeId: STORE, licenseDocUrl: 'https://l.test', verification_status: 'verified' }, ''],
  ])('rejects %j', async (body, path) => {
    const { app, verification } = setup();
    const res = await request(app)
      .post('/api/v1/merchant/verification')
      .set(...AS_ALICE)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.issues[0].path).toBe(path);
    expect(verification.claim).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
  ] as const)('maps a %i claim error', async (status, code) => {
    const { app } = setup(async () => {
      throw new ClaimError(status, 'this store already has a pending claim');
    });
    const res = await request(app)
      .post('/api/v1/merchant/verification')
      .set(...AS_ALICE)
      .send({ storeId: STORE, licenseDocUrl: 'https://license.test/a' });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });
});
