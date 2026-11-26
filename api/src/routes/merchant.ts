import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { currentStoreId, requireVerifiedManager } from '../middleware/auth.js';
import { HttpError } from '../middleware/httpError.js';
import type { SightingRepository } from '../sightings/repository.js';
import type { StoreRepository } from '../stores/repository.js';
import { parse } from './parse.js';

const QUEUE_LIMIT = 100;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Use HH:MM (24-hour)');
const dayHours = z
  .object({ open: time, close: time })
  .refine((h) => h.open < h.close, 'Closing time must be after opening time')
  .nullable();
const tags = z.array(z.string().trim().min(1).max(40)).max(10);

/** Accepts common U.S. formats and stores `(503) 555-0100`. */
const usPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const digits = v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a 10-digit U.S. phone number' });
      return z.NEVER;
    }
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  });

const storePatch = z
  .object({
    phone: z.union([usPhone, z.literal('').transform(() => null), z.null()]).optional(),
    websiteUrl: z
      .union([
        z
          .string()
          .trim()
          .max(500)
          .url()
          .refine((u) => /^https?:\/\//.test(u), 'Website must start with http:// or https://'),
        z.literal('').transform(() => null),
        z.null(),
      ])
      .optional(),
    operatingHours: z
      .object(
        Object.fromEntries(DAYS.map((d) => [d, dayHours])) as Record<
          (typeof DAYS)[number],
          typeof dayHours
        >,
      )
      .strict()
      .optional(),
    paymentMethods: tags.optional(),
    tags: tags.optional(),
  })
  .strict();

/** The verified manager's sighting queue and store editor. */
export function merchantRouter(
  sightings?: SightingRepository,
  stores?: StoreRepository,
  auth?: AuthService,
) {
  const router = Router();
  router.get('/sightings', ...requireVerifiedManager(auth), async (_req, res) => {
    if (!sightings)
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    const storeId = currentStoreId(res);
    res.json({ storeId, sightings: await sightings.listActiveForStore(storeId, QUEUE_LIMIT) });
  });
  router.patch('/store', ...requireVerifiedManager(auth), async (req, res) => {
    const patch = parse(storePatch, req.body);
    if (!stores) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    const storeId = currentStoreId(res);
    await stores.updateManaged(storeId, patch);
    const found = await stores.getById(storeId);
    if (!found) throw new HttpError(404, 'NOT_FOUND', 'No such store');
    res.json(found.store);
  });
  return router;
}
