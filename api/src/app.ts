import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { supabaseAuth, type AuthService } from './auth/service.js';
import { discogsProvider, musicBrainzProvider } from './catalog/providers.js';
import { supabaseMasterRecords, type MasterRecordRepository } from './catalog/repository.js';
import { createCatalogService, type CatalogService } from './catalog/service.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { supabaseCrate, type CrateRepository } from './crate/repository.js';
import { supabaseRecords, type RecordRepository } from './records/repository.js';
import { catalogRouter } from './routes/catalog.js';
import { crateRouter } from './routes/crate.js';
import { recordsRouter } from './routes/records.js';
import { searchRouter } from './routes/search.js';
import { supabaseSearch, type SearchRepository } from './search/repository.js';
import { nearestStoreRouter, sightingsRouter } from './routes/sightings.js';
import { supabaseSightings, type SightingRepository } from './sightings/repository.js';
import { healthRouter } from './routes/health.js';
import { storesRouter } from './routes/stores.js';
import { supabaseStores, type StoreRepository } from './stores/repository.js';

export interface AppOptions {
  auth?: AuthService;
  catalog?: CatalogService;
  records?: MasterRecordRepository;
  stores?: StoreRepository;
  crate?: CrateRepository;
  recordDetails?: RecordRepository;
  sightings?: SightingRepository;
  search?: SearchRepository;
  now?: () => Date;
  configure?: (v1: Router, auth?: AuthService) => void;
}

const defaultCatalog = () =>
  createCatalogService([discogsProvider(env.DISCOGS_TOKEN), musicBrainzProvider()]);

const defaultAuth = () =>
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseAuth(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : undefined;

const defaultRecords = () =>
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseMasterRecords(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : undefined;

const defaultStores = () =>
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseStores(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : undefined;

const withDb =
  <T>(make: (url: string, key: string) => T) =>
  () =>
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? make(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : undefined;

export function createApp({
  auth = defaultAuth(),
  catalog = defaultCatalog(),
  records = defaultRecords(),
  stores = defaultStores(),
  crate = withDb(supabaseCrate)(),
  recordDetails = withDb(supabaseRecords)(),
  sightings = withDb(supabaseSightings)(),
  search = withDb(supabaseSearch)(),
  now,
  configure,
}: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '100kb' }));

  const v1 = Router();
  v1.use('/health', healthRouter);
  v1.use('/catalog', catalogRouter(catalog, records, auth));
  v1.use('/stores', nearestStoreRouter(stores));
  v1.use('/stores', storesRouter(stores, now));
  v1.use(
    '/sightings',
    sightingsRouter(sightings, stores, catalog, records, auth, now ?? (() => new Date())),
  );
  v1.use('/crate', crateRouter(crate, catalog, records, auth));
  v1.use('/records', recordsRouter(recordDetails, stores));
  v1.use('/search', searchRouter(search, stores));
  configure?.(v1, auth);
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
