import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../middleware/httpError.js';
import type { RecordRepository } from '../records/repository.js';
import { distanceMiles, toUnit } from '../stores/geo.js';
import type { StoreRepository } from '../stores/repository.js';
import { originFields, resolveOrigin } from './origin.js';
import { parse } from './parse.js';

const query = z.object({ ...originFields, unit: z.enum(['mi', 'km']).default('mi') });
const idParam = z.object({ id: z.string().uuid() });
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Album details: the master record plus its active sightings, nearest first when a location is given. */
export function recordsRouter(records?: RecordRepository, stores?: StoreRepository) {
  const router = Router();
  router.get('/:id', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const q = parse(query, req.query);
    if (!records || !stores) {
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    }
    const origin = await resolveOrigin(q, (zip) => stores.zipCentroid(zip));
    const found = await records.get(id);
    if (!found) throw new HttpError(404, 'NOT_FOUND', 'No such record');
    const sightings = found.sightings.map(({ store, ...s }) => {
      const miles = origin
        ? distanceMiles(origin.lat, origin.lng, store.geoLat, store.geoLng)
        : null;
      return {
        ...s,
        store: { storeId: store.storeId, businessName: store.businessName },
        distance: miles === null ? null : round1(toUnit(miles, q.unit)),
        _miles: miles,
      };
    });
    if (origin) sightings.sort((a, b) => a._miles! - b._miles!);
    res.json({
      ...found.record,
      unit: q.unit,
      origin,
      activeSightings: sightings.map(({ _miles, ...s }) => (void _miles, s)),
    });
  });
  return router;
}
