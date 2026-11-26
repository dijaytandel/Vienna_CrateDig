import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import type { ProfileRepository } from '../me/repository.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/httpError.js';
import type { StoreRepository } from '../stores/repository.js';
import { parse } from './parse.js';

const patchBody = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    defaultZip: z
      .string()
      .regex(/^\d{5}$/, 'Enter a 5-digit ZIP code')
      .nullable(),
    radiusMiles: z.union([z.literal(5), z.literal(10), z.literal(25)]),
    distanceUnit: z.enum(['mi', 'km']),
    genres: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .transform((g) => [...new Set(g)]),
    favoriteStoreIds: z
      .array(z.string().uuid())
      .max(100)
      .transform((ids) => [...new Set(ids)]),
  })
  .partial()
  .strict();

/** The signed-in user's profile and preferences. */
export function meRouter(
  profiles?: ProfileRepository,
  stores?: StoreRepository,
  auth?: AuthService,
) {
  const router = Router();
  const repo = () => {
    if (!profiles)
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    return profiles;
  };
  router.get('/', requireAuth(auth), async (_req, res) => {
    const me = await repo().get(currentUser(res).id);
    if (!me) throw new HttpError(404, 'NOT_FOUND', 'No profile for this account');
    res.json(me);
  });
  router.patch('/', requireAuth(auth), async (req, res) => {
    const patch = parse(patchBody, req.body);
    if (patch.defaultZip && stores && !(await stores.zipCentroid(patch.defaultZip))) {
      throw new HttpError(400, 'ZIP_NOT_FOUND', `We couldn't find ZIP ${patch.defaultZip}`);
    }
    const me = await repo().update(currentUser(res).id, patch);
    if (!me) throw new HttpError(404, 'NOT_FOUND', 'No profile for this account');
    res.json(me);
  });
  return router;
}
