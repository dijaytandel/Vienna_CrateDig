import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import type { MasterRecordRepository } from '../catalog/repository.js';
import type { CatalogService } from '../catalog/service.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/httpError.js';
import type { SightingRepository } from '../sightings/repository.js';
import { boundingBox, distanceMiles, toUnit } from '../stores/geo.js';
import type { StoreRepository } from '../stores/repository.js';
import { optional, originFields, resolveOptionalOrigin } from './origin.js';
import { parse } from './parse.js';

export const DAILY_SIGHTING_LIMIT = 20;
const grade = z.enum(['mint', 'near_mint', 'vg_plus', 'vg', 'fair']);

const createBody = z
  .object({
    apiSourceId: z
      .string()
      .regex(/^(discogs:[1-9]\d*|musicbrainz:[0-9a-f-]{36})$/)
      .optional(),
    recordId: z.string().uuid().optional(),
    storeId: z.string().uuid(),
    conditionGrade: grade,
    priceUsd: z
      .number()
      .min(0)
      .max(999999.99)
      .refine((n) => Number(n.toFixed(2)) === n, 'At most 2 decimals')
      .nullish(),
    specialAttributes: z
      .array(z.string().trim().min(1).max(40))
      .max(10)
      // Stored joined with ', ' in a 200-character column.
      .refine(
        (tags) => tags.join(', ').length <= 200,
        'Attributes are too long (200 characters total)',
      )
      .optional(),
  })
  .refine((b) => Boolean(b.apiSourceId) !== Boolean(b.recordId), {
    message: 'Provide either apiSourceId or recordId',
    path: ['apiSourceId'],
  });

const detailQuery = z.object({ ...originFields, unit: z.enum(['mi', 'km']).default('mi') });
const idParam = z.object({ id: z.string().uuid() });
const round1 = (n: number) => Math.round(n * 10) / 10;

export function sightingsRouter(
  sightings: SightingRepository | undefined,
  stores: StoreRepository | undefined,
  catalog: CatalogService,
  records: MasterRecordRepository | undefined,
  auth: AuthService | undefined,
  now: () => Date,
) {
  const router = Router();
  const repo = () => {
    if (!sightings || !stores) {
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    }
    return { sightings, stores };
  };

  router.get('/:id', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const q = parse(detailQuery, req.query);
    const db = repo();
    const origin = await resolveOptionalOrigin(q, (zip) => db.stores.zipCentroid(zip));
    const s = await db.sightings.get(id);
    if (!s) throw new HttpError(404, 'NOT_FOUND', 'No such sighting');
    const distance = origin
      ? round1(
          toUnit(distanceMiles(origin.lat, origin.lng, s.store.geoLat, s.store.geoLng), q.unit),
        )
      : null;
    res.json({ ...s, distance, unit: q.unit });
  });

  router.post('/', requireAuth(auth), async (req, res) => {
    const body = parse(createBody, req.body);
    const clientRef = parse(z.string().uuid().optional(), req.get('idempotency-key') || undefined);
    const db = repo();
    const userId = currentUser(res).id;
    if (clientRef) {
      const existing = await db.sightings.byClientRef(userId, clientRef);
      if (existing) {
        res.status(200).json(existing);
        return;
      }
    }
    const since = new Date(now().getTime() - 24 * 3600 * 1000);
    if ((await db.sightings.countSince(userId, since)) >= DAILY_SIGHTING_LIMIT) {
      res.setHeader('Retry-After', '3600');
      throw new HttpError(
        429,
        'RATE_LIMITED',
        `You can report up to ${DAILY_SIGHTING_LIMIT} sightings a day`,
      );
    }
    let recordId = body.recordId;
    if (body.apiSourceId) {
      if (!records) {
        throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
      }
      const record = await catalog.getById(body.apiSourceId);
      if (!record) throw new HttpError(404, 'NOT_FOUND', `No catalog record ${body.apiSourceId}`);
      recordId = await records.upsert(record);
    }
    const created = await db.sightings.create(userId, {
      recordId: recordId!,
      storeId: body.storeId,
      priceUsd: body.priceUsd ?? 0,
      conditionGrade: body.conditionGrade,
      specialAttributes: body.specialAttributes?.length ? body.specialAttributes.join(', ') : null,
      clientRef,
    });
    res.status(201).json(created);
  });

  return router;
}

const nearestQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  verifiedOnly: optional(z.enum(['true', 'false'])),
});

/** Closest verified store to a GPS fix, widening the search box until one is found. */
export function nearestStoreRouter(stores: StoreRepository | undefined) {
  const router = Router();
  router.get('/nearest', async (req, res) => {
    const q = parse(nearestQuery, req.query);
    if (!stores) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    const verifiedOnly = q.verifiedOnly !== 'false';
    for (const miles of [5, 25, 100, 500]) {
      const candidates = (await stores.listInBox(boundingBox(q.lat, q.lng, miles)))
        .filter((s) => !verifiedOnly || s.isVerified)
        .map((s) => ({ ...s, distance: distanceMiles(q.lat, q.lng, s.geoLat, s.geoLng) }))
        .filter((s) => s.distance <= miles)
        .sort((a, b) => a.distance - b.distance);
      if (candidates[0]) {
        res.json({
          store: { ...candidates[0], distance: round1(candidates[0].distance) },
          unit: 'mi',
        });
        return;
      }
    }
    throw new HttpError(404, 'NO_STORE_NEARBY', 'No verified store within 500 miles');
  });
  return router;
}
