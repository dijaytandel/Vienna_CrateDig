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
| `VAPID_PUBLIC_KEY` | no | — | Web push public key (`npx web-push generate-vapid-keys`). Without the key pair, broadcasts publish but no push is sent |
| `VAPID_PRIVATE_KEY` | no | — | Web push private key. Keep secret |
| `VAPID_SUBJECT` | no | `mailto:hello@cratedig.app` | Contact the push services can reach |

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

## 6. Store manager verification (admin procedure)

There is no admin screen. A collector applies at `/merchant/verify` with a business-license URL, which sets the store's `manager_user_id`, `license_doc_url` and `verification_status = 'pending'`. An admin reviews it in the Supabase SQL editor (runs as `postgres`):

```sql
-- 1. Pending claims, oldest first
select s.store_id, s.business_name, s.city, s.state, s.license_doc_url,
       p.display_name, p.email, s.updated_at
from public.stores s join public.profiles p on p.user_id = s.manager_user_id
where s.verification_status = 'pending'
order by s.updated_at;

-- 2a. Approve: store becomes verified, applicant becomes store_manager
select public.admin_review_store('<store_id>', 'verified');

-- 2b. Reject: store shows Rejected to the applicant, applicant stays a collector
select public.admin_review_store('<store_id>', 'rejected');
```

- `admin_review_store` cannot be called through the API or by signed-in users; only the database owner can run it.
- A rejected store is hidden from the public directory, feed and search until someone applies again with a new license.
- The applicant sees the new status on `/merchant/verify` and `/profile` the next time it loads. After approval they need to reload the app (or sign in again) for the Merchant menu to appear.

