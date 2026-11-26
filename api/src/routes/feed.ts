import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import type { FeedItem, FeedPreferences, FeedRepository } from '../feed/repository.js';
import { optionalUser } from '../middleware/auth.js';
import { HttpError } from '../middleware/httpError.js';
import { distanceMiles, KM_PER_MI, toUnit } from '../stores/geo.js';
import type { StoreRepository } from '../stores/repository.js';
import {
  optional,
  originFields,
  radiusField,
  resolveOptionalOrigin,
  resolveOrigin,
} from './origin.js';
import { parse } from './parse.js';

export const FEED_PAGE_SIZE = 20;

const round1 = (n: number) => Math.round(n * 10) / 10;

const encodeCursor = (item: FeedItem) =>
  Buffer.from(JSON.stringify([item.postedAt, item.id])).toString('base64url');

function decodeCursor(cursor: string) {
  try {
    const [postedAt, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as unknown[];
    if (
      typeof postedAt === 'string' &&
      !Number.isNaN(Date.parse(postedAt)) &&
      typeof id === 'string' &&
      z.string().uuid().safeParse(id).success
    ) {
      return { postedAt, id };
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, 'VALIDATION_ERROR', 'Request is invalid', {
    issues: [{ path: 'cursor', message: 'Invalid cursor' }],
  });
}

const genreWords = (genre: string | null) =>
  (genre ?? '')
    .split(/[,/;]/)
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);

function isForYou(item: FeedItem, prefs: FeedPreferences | null) {
  if (!prefs) return false;
  if (prefs.favoriteStoreIds.includes(item.store.storeId)) return true;
  if (item.type !== 'sighting') return false;
  const wanted = new Set(prefs.genres.map((g) => g.trim().toLowerCase()));
  return genreWords(item.record.genre).some((g) => wanted.has(g));
}

const feedQuery = z.object({
  radius: radiusField,
  unit: z.enum(['mi', 'km']).default('mi'),
  cursor: optional(z.string().max(200)),
  ...originFields,
});

/** Discover feed: works for guests; a valid bearer token adds `isForYou`. */
export function feedRouter(feed?: FeedRepository, stores?: StoreRepository, auth?: AuthService) {
  const router = Router();
  router.get('/', async (req, res) => {
    const q = parse(feedQuery, req.query);
    const before = q.cursor ? decodeCursor(q.cursor) : null;
    if (!feed || !stores) {
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    }
    const origin = await resolveOrigin(q, (zip) => stores.zipCentroid(zip));
    if (!origin) {
      throw new HttpError(400, 'LOCATION_REQUIRED', 'Provide lat and lng, or a 5-digit zip');
    }
    const user = await optionalUser(req, auth);
    const radiusMiles = q.unit === 'km' ? q.radius / KM_PER_MI : q.radius;
    const [rows, prefs] = await Promise.all([
      feed.page({
        lat: origin.lat,
        lng: origin.lng,
        radiusMiles,
        before,
        limit: FEED_PAGE_SIZE + 1,
      }),
      user ? feed.preferences(user.id) : null,
    ]);
    const page = rows.slice(0, FEED_PAGE_SIZE);
    const items = page.map(({ distanceMiles: miles, ...item }) => ({
      ...item,
      distance: round1(toUnit(miles, q.unit)),
      isForYou: isForYou({ ...item, distanceMiles: miles } as FeedItem, prefs),
    }));
    res.json({
      origin,
      unit: q.unit,
      radius: q.radius,
      items,
      nextCursor: rows.length > FEED_PAGE_SIZE ? encodeCursor(page.at(-1)!) : null,
    });
  });
  return router;
}

const detailQuery = z.object({ ...originFields, unit: z.enum(['mi', 'km']).default('mi') });
const idParam = z.object({ id: z.string().uuid() });

export function broadcastsRouter(feed?: FeedRepository, stores?: StoreRepository) {
  const router = Router();
  router.get('/:id', async (req, res) => {
    const { id } = parse(idParam, req.params);
    const q = parse(detailQuery, req.query);
    if (!feed || !stores) {
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is not configured');
    }
    const [origin, found] = await Promise.all([
      resolveOptionalOrigin(q, (zip) => stores.zipCentroid(zip)),
      feed.broadcast(id),
    ]);
    if (!found) throw new HttpError(404, 'NOT_FOUND', 'No such broadcast');
    const miles = origin
      ? distanceMiles(origin.lat, origin.lng, found.store.geoLat, found.store.geoLng)
      : null;
    res.json({
      ...found,
      unit: q.unit,
      distance: miles === null ? null : round1(toUnit(miles, q.unit)),
    });
  });
  return router;
}
