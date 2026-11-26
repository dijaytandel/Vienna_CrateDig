import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { discogsProvider, musicBrainzProvider } from './catalog/providers.js';
import { supabaseMasterRecords, type MasterRecordRepository } from './catalog/repository.js';
import { createCatalogService, type CatalogService } from './catalog/service.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { catalogRouter } from './routes/catalog.js';
import { healthRouter } from './routes/health.js';

export interface AppOptions {
  catalog?: CatalogService;
  records?: MasterRecordRepository;
  configure?: (v1: Router) => void;
}

const defaultCatalog = () =>
  createCatalogService([discogsProvider(env.DISCOGS_TOKEN), musicBrainzProvider()]);

const defaultRecords = () =>
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? supabaseMasterRecords(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : undefined;

export function createApp({
  catalog = defaultCatalog(),
  records = defaultRecords(),
  configure,
}: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '100kb' }));

  const v1 = Router();
  v1.use('/health', healthRouter);
  v1.use('/catalog', catalogRouter(catalog, records));
  configure?.(v1);
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
