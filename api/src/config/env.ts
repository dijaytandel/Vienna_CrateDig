import 'dotenv/config';
import { z } from 'zod';

const blankAsUndefined = (v: unknown) => (v === '' ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DISCOGS_TOKEN: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:hello@cratedig.app'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(
  Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, blankAsUndefined(v)])),
);
