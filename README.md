# CrateDig

A mobile-first web app for discovering vinyl at independent record stores across U.S. metro areas ("GasBuddy for vinyl records").

CrateDig helps:

- **Guests** browse the local Discover feed, search sightings and explore stores straight away, with no login wall.
- **Experienced collectors** confirm a specific pressing is on a local shelf, with its USD price, before driving across town.
- **Emerging collectors** discover nearby shops and keep a Collection and Want List to avoid duplicate purchases.
- **Verified store managers** post stock arrival broadcasts and confirm or close out crowdsourced sightings at their store.

CrateDig is built to **enhance, not replace,** in-person crate-digging. It is a community-driven local discovery tool.

**Out of scope:** remote e-commerce, automated POS sync, shipping fulfillment, file hosting, and any public admin UI.

## Live app

**https://main.d2403pxp27mt6v.amplifyapp.com** (best on a phone; add it to your home screen to install the PWA).

The client is on AWS Amplify Hosting, the API on AWS Lambda (proxied at `/api/v1`), and the database on hosted Supabase, all in `us-west-2`. Demo stores are in Portland, OR: allow location or enter ZIP `97205`. Sign up with any email; the hosted project does not require email confirmation. [Deployment](docs/DEPLOYMENT.md) covers redeploying with `scripts/deploy-aws.sh`.

## Features

| Area | What you can do | Route |
|---|---|---|
| Discover | Sightings and store broadcasts near you, newest first; "For you" tags from favorite stores and genres; pull to refresh | `/discover` |
| Search | Find active sightings by artist, album or genre within 5, 10 or 25 mi (km optional), by GPS or ZIP | `/search` |
| Stores | Nearby stores sorted by distance; profile with hours, "open now", tap-to-call, maps, payments, sightings and broadcasts | `/stores`, `/stores/:id` |
| Report a sighting | 5 steps: album from Discogs/MusicBrainz, store (GPS preselects the nearest), condition and USD price, tags, review. 20 per day | `/report` |
| Sighting details | Store, USD price, condition, tags, when it was reported and its verification status | `/sightings/:id` |
| My Crate | Collection and Want List with condition, price paid, notes and tags; "Mark as acquired" moves a Want List record to the Collection | `/crate` |
| Profile | Display name, home ZIP, default radius, miles or km, genres, favorite stores, broadcast notifications | `/profile` |
| Store managers | Apply with a business license link; once approved, confirm/flag/mark sold sightings, edit store details and post stock broadcasts with push notifications | `/merchant/*` |
| Offline | My Crate and the last 10 store pages open without signal; reports and crate changes made offline sync on reconnect | everywhere |

Guests can use Discover, Search, Stores and every detail page. Reporting, My Crate, Profile and the merchant pages ask for a login.

Store manager applications are approved or rejected in the database; there is no admin UI ([how](docs/DEPLOYMENT.md#6-store-manager-verification-admin-procedure)).

## Run it locally

Needs Node 22, Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start                       # local Postgres, Auth and the Portland demo data
supabase status -o env               # prints API_URL, ANON_KEY and SERVICE_ROLE_KEY

# API on http://localhost:3000/api/v1
cd api && npm ci
SUPABASE_URL=<API_URL> SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> npm run dev

# Client on http://localhost:5173 (proxies /api to the API)
cd client && npm ci
cp .env.example .env.local           # set VITE_SUPABASE_URL=<API_URL> and VITE_SUPABASE_ANON_KEY=<ANON_KEY>
npm run dev
```

The demo data is 12 record stores in Portland, OR (try ZIP `97205`). No accounts are seeded: sign up in the app; local sign-up needs no email confirmation. To try the merchant pages, apply at `/merchant/verify` and approve the claim with the SQL in [Deployment](docs/DEPLOYMENT.md#6-store-manager-verification-admin-procedure).

Optional API variables: `DISCOGS_TOKEN` (genres and cover art in catalog search) and `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (push notifications). All variables are listed in [Deployment](docs/DEPLOYMENT.md#2-environment-variables).

## Checks

CI runs all of these on every pull request:

```bash
cd client && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run size
cd api && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
supabase test db                     # pgTAP tests for RLS, triggers and SQL functions
npx @redocly/cli lint docs/openapi.yaml
```

`npm run size` fails if the JavaScript loaded on first visit is over 250 kB gzipped.

## Tech stack

- **Client:** React 19, Vite, TypeScript, React Router, installable PWA (Workbox)
- **API:** Node 22, Express 5, TypeScript, Zod; REST under `/api/v1` ([OpenAPI](docs/openapi.yaml))
- **Database and auth:** Supabase (PostgreSQL with row-level security, Supabase Auth)
- **Catalog:** Discogs, with MusicBrainz as the fallback
- **Push:** Web Push (VAPID)

## Docs

| Doc | Contents |
|---|---|
| [PRD](docs/PRD.md) | Specification #3 (final): strategy, scope, data model, navigation, auth flow, screen matrix |
| [Site map](docs/SITEMAP.md) | Roles, hierarchy, navigation and the route-by-route screen inventory |
| [Task list](docs/TASKS.md) | Development tasks with acceptance criteria, mapped to US-01 – US-10 |
| [Workspace rules](docs/WORKSPACE_RULES.md) | Naming, branching, commits, PR and review process |
| [OpenAPI](docs/openapi.yaml) | REST API v1 contract, linted in CI |
| [Deployment](docs/DEPLOYMENT.md) | Environments, env var names, deploy and rollback steps |

## Repo layout

| Path         | Purpose                                         |
| ------------ | ----------------------------------------------- |
| `client/`    | React PWA (local dev: Vite)                     |
| `api/`       | Express API (local dev: Node)                   |
| `supabase/`  | SQL migrations + seeds                          |
| `docs/`      | PRD, site map, OpenAPI, deployment notes        |
