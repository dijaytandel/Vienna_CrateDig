import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/httpError.js';
import {
  boundingBox,
  distanceMiles,
  isOpenNow,
  KM_PER_MI,
  timeZoneForState,
  toUnit,
} from '../stores/geo.js';
import type { StoreRepository } from '../stores/repository.js';
import { parse } from './parse.js';

const RADII = [5, 10, 25] as const;

const listQuery = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    zip: z
      .string()
      .regex(/^\d{5}$/, 'Must be a 5-digit ZIP')
      .optional(),
    radius: z.coerce
      .number()
      .refine((r) => (RADII as readonly number[]).includes(r), 'Must be 5, 10 or 25')
      .default(10),
    unit: z.enum(['mi', 'km']).default('mi'),
  })
  .refine((q) => (q.lat === undefined) === (q.lng === undefined), {
    message: 'Provide both lat and lng',
    path: ['lat'],
  })
  .refine((q) => q.lat !== undefined || q.zip !== undefined, {
    message: 'Provide lat and lng, or zip',
    path: ['zip'],
  });

const idParams = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
});

const round1 = (n: number) => Math.round(n * 10) / 10;

export function storesRouter(stores?: StoreRepository, now: () => Date = () => new Date()) {
  const router = Router();
  const repo = () => {
    if (!stores) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    return stores;
  };

  router.get('/', async (req, res) => {
    const q = parse(listQuery, req.query);
    const db = repo();

    let origin: { lat: number; lng: number; source: 'coordinates' | 'zip' };
    if (q.lat !== undefined && q.lng !== undefined) {
      origin = { lat: q.lat, lng: q.lng, source: 'coordinates' };
    } else {
      const centroid = await db.zipCentroid(q.zip!);
      if (!centroid) throw new HttpError(404, 'ZIP_NOT_FOUND', `No location for ZIP ${q.zip}`);
      origin = { ...centroid, source: 'zip' };
    }

    const radiusMiles = q.unit === 'km' ? q.radius / KM_PER_MI : q.radius;
    const candidates = await db.listInBox(boundingBox(origin.lat, origin.lng, radiusMiles));
    const results = candidates
      .map((s) => ({ s, miles: distanceMiles(origin.lat, origin.lng, s.geoLat, s.geoLng) }))
      .filter(({ miles }) => miles <= radiusMiles)
      .sort((a, b) => a.miles - b.miles)
      .map(({ s, miles }) => ({ ...s, distance: round1(toUnit(miles, q.unit)) }));

    res.json({ origin, unit: q.unit, radius: q.radius, stores: results });
  });

  router.get('/:id', async (req, res) => {
    const result = idParams.safeParse(req.params);
    const found = result.success ? await repo().getById(result.data.id) : null;
    if (!found) throw new HttpError(404, 'NOT_FOUND', `No store ${req.params.id}`);

    const timeZone = timeZoneForState(found.store.state);
    res.json({
      ...found.store,
      timeZone,
      isOpenNow: isOpenNow(found.store.operatingHours, timeZone, now()),
      activeSightings: found.sightings,
      recentBroadcasts: found.broadcasts,
    });
  });

  return router;
}
