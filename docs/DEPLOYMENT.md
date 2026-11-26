# CrateDig — Deployment

How CrateDig is built and deployed. **No hosting provider is chosen yet** for the client and the API. These steps work on any static host and any Node 22 host. Supabase hosts the database.

## 1. Environments

| Environment | Client | API | Database | Deployed from |
|---|---|---|---|---|
| Local | `npm run dev` on :5173 (PWA: `npm run build && npm run preview` on :4173) | `npm run dev` on :3000 | `supabase start` (Docker) | working tree |
| CI | built and tested only | built and tested only | `supabase db start` applies all migrations and the seed | every PR and push to `main` |
| Production | static host | Node 22 host | Supabase Cloud project | `main`, after CI is green |

There is no shared staging environment in Phase 1. Check a PR locally before merging.

## 2. Environment variables

Secrets live only in `.env` files (git-ignored) and in the host's secret store. `api/.env.example` lists the names.

### API (`api/`)

| Name | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `test` or `production` |
| `PORT` | no | `3000` | HTTP port (most hosts set this) |
| `CORS_ORIGIN` | in production | `http://localhost:5173` | Comma-separated client origins allowed by CORS |
| `SUPABASE_URL` | for writes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for writes | — | Service-role key; server only, never sent to the client |
| `DISCOGS_TOKEN` | no | — | Discogs personal access token. Without it, catalog search uses MusicBrainz only |

When `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, endpoints that write to the database return `503 DATABASE_UNAVAILABLE`.

### Client (`client/`)

Vite only exposes variables prefixed `VITE_`, and they end up in the public bundle, so they must never hold secrets. They are read at build time.

| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL, for Supabase Auth. If unset, the app runs in guest-only mode. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key. Never the service-role key. |
| `VITE_API_URL` | API base URL including `/api/v1`, e.g. `https://api.example.com/api/v1`. Defaults to `/api/v1` on the same origin; `vite` and `vite preview` proxy `/api` to `http://localhost:3000` (override with `API_PROXY_TARGET`). The API's `CORS_ORIGIN` must include the client origin. |

## 3. Deploy steps

Deploy in this order: database → API → client. Each layer must stay compatible with the one before it.

### 3.1 Database (Supabase Cloud)

```bash
supabase login
supabase link --project-ref <project-ref>   # once per machine
supabase db push                            # applies new files in supabase/migrations/
```

- `supabase/seed.sql` is demo data for local use and CI only. Do not run it in production.
- Migrations only ever move forward. To undo a change, add a new migration; never edit one that has already been applied.

### 3.2 API (Node 22 host)

```bash
cd api
npm ci
npm run build        # outputs dist/
npm start            # node dist/server.js
```

- Set the variables from §2 in the host's secret store.
- Health check path: `GET /api/v1/health`, which returns `200 {"status":"ok"}`.
- The catalog cache is in memory, so each instance has its own and a restart clears it.

### 3.3 Client (static host)

```bash
cd client
npm ci
npm run build        # outputs dist/
```

- Publish `client/dist/`.
- **SPA fallback:** serve `index.html` for unknown paths so deep links like `/stores/123` load.
- **Caching:**
  - Serve `sw.js`, `registerSW.js`, `manifest.webmanifest` and `index.html` with `Cache-Control: no-cache`, so new versions reach installed PWAs.
  - Files under `assets/` are content-hashed and can be cached for a year.
- **HTTPS is required** for the service worker and geolocation.
- Add the client's origin to the API's `CORS_ORIGIN`.

## 4. Release checklist

1. CI is green on `main`.
2. `supabase db push` has applied any new migrations.
3. API deployed; `GET /api/v1/health` returns 200.
4. Client deployed; `/discover` loads and a deep link survives a reload.
5. `docs/openapi.yaml` matches the deployed endpoints.

## 5. Rollback

- **Client / API:** redeploy the previous build, or the previous commit of `main`.
- **Database:** write and push a new migration that reverses the change. Additive migrations (new tables or nullable columns) usually need no rollback when the code is rolled back.
