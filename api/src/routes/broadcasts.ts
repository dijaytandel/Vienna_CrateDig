import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { notifyBroadcast, type PushSender } from '../broadcasts/push.js';
import type { BroadcastRepository } from '../broadcasts/repository.js';
import type { FeedRepository } from '../feed/repository.js';
import {
  currentStoreId,
  currentUser,
  requireAuth,
  requireVerifiedManager,
} from '../middleware/auth.js';
import { HttpError } from '../middleware/httpError.js';
import { parse } from './parse.js';

const HISTORY_LIMIT = 50;

const noDb = () => new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');

const newBroadcast = z.object({
  arrivalSummary: z.string().trim().min(1, 'Describe what arrived').max(500),
  photoUrl: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((u) => u.startsWith('https://'), 'Photo link must start with https://')
    .nullish(),
  featuredIds: z
    .array(z.string().uuid())
    .max(10, 'Feature at most 10 records')
    .refine((ids) => new Set(ids).size === ids.length, 'Featured records must be different')
    .default([]),
});

/** POST /broadcasts: the verified manager publishes, then opted-in collectors get a push. */
export function broadcastWriteRouter(
  broadcasts?: BroadcastRepository,
  feed?: FeedRepository,
  auth?: AuthService,
  push?: PushSender,
) {
  const router = Router();
  router.post('/', ...requireVerifiedManager(auth), async (req, res) => {
    const body = parse(newBroadcast, req.body);
    if (!broadcasts || !feed) throw noDb();
    const known = new Set(await broadcasts.existingRecordIds(body.featuredIds));
    const missing = body.featuredIds.filter((id) => !known.has(id));
    if (missing.length > 0) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Request is invalid', {
        issues: [{ path: 'featuredIds', message: `Unknown records: ${missing.join(', ')}` }],
      });
    }
    const created = await broadcasts.create({
      storeId: currentStoreId(res),
      arrivalSummary: body.arrivalSummary,
      photoUrl: body.photoUrl ?? null,
      featuredIds: body.featuredIds,
    });
    const detail = await feed.broadcast(created.broadcastId);
    if (!detail) throw new HttpError(500, 'INTERNAL', 'The broadcast could not be read back');

    // Sent before responding: background work after the response is not reliable on serverless hosts.
    let notified = null;
    if (push) {
      try {
        notified = await notifyBroadcast(broadcasts, push, {
          broadcastId: detail.broadcastId,
          storeId: detail.store.storeId,
          businessName: detail.store.businessName,
          arrivalSummary: detail.arrivalSummary,
        });
      } catch (err) {
        console.error('broadcast push failed', err);
      }
    }
    res
      .status(201)
      .location(`/api/v1/broadcasts/${detail.broadcastId}`)
      .json({ ...detail, unit: 'mi', distance: 0, notified });
  });
  return router;
}

const storeParam = z.object({ id: z.string().uuid() });

/** GET /stores/:id/broadcasts: public history, newest first. */
export function storeBroadcastsRouter(broadcasts?: BroadcastRepository) {
  const router = Router();
  router.get('/:id/broadcasts', async (req, res) => {
    const { id } = parse(storeParam, req.params);
    if (!broadcasts) throw noDb();
    res.json({ broadcasts: await broadcasts.listForStore(id, HISTORY_LIMIT) });
  });
  return router;
}

/** GET /merchant/broadcasts: the caller's own store history. */
export function merchantBroadcastsRouter(broadcasts?: BroadcastRepository, auth?: AuthService) {
  const router = Router();
  router.get('/broadcasts', ...requireVerifiedManager(auth), async (_req, res) => {
    if (!broadcasts) throw noDb();
    const storeId = currentStoreId(res);
    res.json({ storeId, broadcasts: await broadcasts.listForStore(storeId, HISTORY_LIMIT) });
  });
  return router;
}

const subscription = z.object({
  endpoint: z
    .string()
    .max(2000)
    .url()
    .refine((u) => u.startsWith('https://'), 'Endpoint must be https'),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});
const unsubscribe = z.object({ endpoint: z.string().max(2000).url() });

/** Web push subscription management for the Profile broadcast toggle. */
export function pushRouter(
  broadcasts?: BroadcastRepository,
  auth?: AuthService,
  push?: PushSender,
) {
  const router = Router();
  router.get('/public-key', (_req, res) => {
    if (!push)
      throw new HttpError(503, 'PUSH_UNAVAILABLE', 'Push notifications are not configured');
    res.json({ publicKey: push.publicKey });
  });
  router.put('/subscription', requireAuth(auth), async (req, res) => {
    const body = parse(subscription, req.body);
    if (!broadcasts) throw noDb();
    await broadcasts.saveSubscription(currentUser(res).id, {
      endpoint: body.endpoint,
      keys: body.keys,
    });
    res.status(204).end();
  });
  router.delete('/subscription', requireAuth(auth), async (req, res) => {
    const body = parse(unsubscribe, req.body);
    if (!broadcasts) throw noDb();
    await broadcasts.removeSubscription(body.endpoint, currentUser(res).id);
    res.status(204).end();
  });
  return router;
}
