# CrateDig — Phase 1 Development Tasks

This file breaks the 9 selected user stories (US-01 to US-09) from the [PRD](PRD.md) into development tasks. Each task lists:

- a short **description**
- the **feature or story** it delivers (PRD feature module and US-ID)
- **acceptance criteria (AC):** the task is "done" only when every AC is met, the code is merged to `main` under the [Workspace Rules](WORKSPACE_RULES.md), and the CI checks pass

Route names refer to the site map (`docs/SITEMAP.md`). Task IDs (`T-xx`) are used in branch names and commit messages.

**Size:** S ≈ under ½ day · M ≈ 1–2 days · L ≈ 3+ days.

## Summary

| Epic | Tasks | Stories |
|---|---|---|
| 0. Foundation | T-01 – T-06 | enables all |
| A. Identity & Administration | T-07 – T-11 | 4.1, 4.2 |
| B. Store Directory | T-12 – T-14 | US-06 |
| C. Collection & Want List | T-15 – T-20 | US-01, US-02, US-03 |
| D. Crowdsourced Sightings | T-21 – T-23 | US-05 |
| E. Radius & Keyword Search | T-24 – T-26 | US-04 |
| F. Map & Visual Feed | T-27 – T-28 | US-07 |
| G. Stock Arrival Broadcasts | T-29 – T-31 | US-08 |
| H. Sighting Verification | T-32 – T-34 | US-09 |
| I. Cross-cutting | T-35 – T-36 | §1.3 usage contexts |

---

## Epic 0 — Foundation

### T-01 · Client scaffold (React PWA) · M
**Description:** Create the Vite + React + TypeScript app in `client/` with routing for every site-map route, a bottom tab bar, and a PWA manifest and service worker.
**Feature / Story:** Enables all stories; PRD §1.3 (mobile-first, one-handed portrait).
**Acceptance criteria:**
- `npm run dev` in `client/` serves the app; `npm run build` produces a production build with no errors.
- Every route in `SITEMAP.md` §4 resolves to a placeholder screen; unknown routes show a 404 screen.
- The bottom tab bar shows Discover · Search · Report (+) · Stores · My Crate, and the active tab is highlighted.
- The app can be installed (Chrome DevTools/Lighthouse reports a valid manifest and a registered service worker).
- At 360 × 640 px portrait there is no horizontal scroll, and every tappable element is at least 44 × 44 px.

### T-02 · API scaffold (Express) · M
**Description:** Create the Express + TypeScript API in `api/` with versioned routing, env config, JSON error handling, CORS and a test runner.
**Feature / Story:** Enables all stories.
**Acceptance criteria:**
- `npm run dev` starts the API, and `GET /api/v1/health` returns `200 {"status":"ok"}`.
- Unknown routes return `404` with body `{ "error": { "code": "NOT_FOUND", "message": … } }`; unhandled errors return `500` in the same format with no stack trace.
- Config is loaded from `.env`; `api/.env.example` lists every required variable without real values.
- `npm test` runs and includes at least one passing test for the health endpoint.

### T-03 · Supabase project & base schema · M
**Description:** Initialise `supabase/` (local CLI config) with the base migration: PostGIS extension, `profiles` table linked to `auth.users`, a `user_role` enum (`collector`, `store_manager`, `admin`), and seed scaffolding.
**Feature / Story:** 4.1 Role Authentication; enables all data-backed stories.
**Acceptance criteria:**
- `supabase db reset` applies all migrations and `seed.sql` from scratch with no errors.
- A new auth user automatically gets a `profiles` row with role `collector` (trigger).
- Row Level Security (RLS) is enabled on every table in the `public` schema.
- Migration files follow the naming rule in the Workspace Rules.

### T-04 · Tooling & CI · S
**Description:** Add ESLint, Prettier and TypeScript checks to `client/` and `api/`, plus a GitHub Actions workflow that runs lint, type-check, test and build on every pull request.
**Feature / Story:** Workspace Rules (quality gate).
**Acceptance criteria:**
- `npm run lint`, `npm run typecheck` and `npm test` exist in both packages.
- Every PR to `main` shows a CI check, and a lint, type or test failure makes it fail.
- Branch protection on `main` requires that check to pass.

### T-05 · External catalog integration · M
**Description:** Add an API proxy to an external record catalog (Discogs API, read-only), normalise its results and cache them in an `albums` table.
**Feature / Story:** 1.1, 1.2, 2.1; PRD §4 decision "Catalog data source".
**Acceptance criteria:**
- `GET /api/v1/catalog/search?q=` returns at most 20 normalised results: `{ catalogId, title, artist, year, genres[], format, label, catalogNumber, coverUrl }`.
- `GET /api/v1/catalog/:catalogId` returns one album and upserts it into `albums`.
- The catalog API token exists only on the server and never appears in client bundles or responses.
- An identical query within 24 h is served from cache (verified by a test with a mocked upstream).
- If the upstream API is rate-limited or unreachable, the endpoint returns `503 CATALOG_UNAVAILABLE` and the client shows a friendly message.

### T-06 · OpenAPI spec & deployment notes · S
**Description:** Create `docs/openapi.yaml` for the v1 endpoints and `docs/DEPLOYMENT.md` describing environments and secrets.
**Feature / Story:** Documentation for all stories.
**Acceptance criteria:**
- `openapi.yaml` validates (e.g. `npx @redocly/cli lint`) and covers every endpoint merged so far.
- `DEPLOYMENT.md` lists the environments (local, preview, production), how to deploy each package, and every required env var (names only).

---

## Epic A — Identity & Administration (4.1, 4.2)

### T-07 · Sign up / sign in / sign out · M
**Description:** Email + password authentication with Supabase Auth, the `/welcome`, `/login` and `/signup` screens, and protected routes.
**Feature / Story:** 4.1 Role Authentication.
**Acceptance criteria:**
- A user can sign up, confirm their email, sign in and sign out; the session survives a page reload.
- Guests are sent to `/login` from protected routes, and returned to the route they asked for after signing in.
- Guests can still browse `/stores` and `/stores/:id`.
- Invalid credentials show an inline error and do not reveal whether the email exists.

### T-08 · Role-based access control (API + RLS) · M
**Description:** API middleware that checks the Supabase JWT and the user's role, plus RLS policies for every table.
**Feature / Story:** 4.1 Role Authentication.
**Acceptance criteria:**
- `requireAuth` returns `401` for missing or invalid tokens; `requireRole('store_manager')` returns `403` for collectors.
- Store-manager actions only work on the manager's linked store (`403` for any other store).
- RLS tests show a user cannot read or modify another user's crate items or verification documents.
- Automated tests cover the matrix of guest, collector, store manager and admin against one protected endpoint per role.

### T-09 · Profile & preferences · M
**Description:** The `/profile` screen and `GET/PATCH /api/v1/me` for display name, distance unit, default radius, location permission status and push opt-in.
**Feature / Story:** 4.2 Preferences & Profile; PRD §4 decision "Radius units".
**Acceptance criteria:**
- The distance unit defaults to **miles**; switching to **km** is saved and immediately changes every distance and radius label in the app.
- The default radius can be set to 5, 10 or 25 (in the chosen unit) and is used as the starting radius in Search and Discover.
- The screen shows the current browser location permission state and explains how to enable it if it was denied.
- The push notification toggle subscribes or unsubscribes the device (works with T-31).

### T-10 · Merchant verification: corporate email binding · M
**Description:** At `/merchant/verify`, path A: the user picks a store and enters an email address on that store's registered domain; a confirmation link then grants the `store_manager` role and links them to the store.
**Feature / Story:** 4.1 Role Authentication; PRD §4 decision "Merchant verification".
**Acceptance criteria:**
- Emails whose domain does not match `stores.email_domain` are rejected, with a suggestion to use path B.
- The confirmation link is single-use and expires after 24 h.
- After confirmation, the user's role is `store_manager`, `store_managers(user_id, store_id)` is created, and the Merchant Portal entry appears in the menu.
- Each verification is recorded with method `email`, timestamp and the email address used.

### T-11 · Merchant verification: document application & admin review · L
**Description:** Path B: the user uploads proof documents (stored in a private Supabase Storage bucket); an admin reviews the application at `/admin/verifications`.
**Feature / Story:** 4.1 Role Authentication; PRD §4 decision "Merchant verification".
**Acceptance criteria:**
- The applicant can upload 1–3 files (PDF/JPG/PNG, at most 10 MB each) and sees the status *Pending / Approved / Rejected*.
- Documents can only be read by the applicant and admins (storage policies are tested).
- An admin can approve an application, which grants `store_manager` and links the store, or reject it with a required reason that the applicant sees.
- Only `admin` users can reach `/admin/verifications` (server-side check, not just a hidden menu item).

---

## Epic B — Store Directory (US-06)

### T-12 · Stores schema & Vienna seed data · S
**Description:** A `stores` table (name, address, `location geography(Point)`, opening hours, phone, policies, website, `email_domain`, `is_verified`), seeded with real independent record shops in Vienna.
**Feature / Story:** 2.3 Store Directory · US-06.
**Acceptance criteria:**
- The migration creates `stores` with a GiST index on `location`.
- `seed.sql` inserts at least 10 Vienna stores with valid coordinates and opening hours.
- Opening hours are structured (per weekday open/close) so the app can work out "open now".

### T-13 · Store directory API · S
**Description:** `GET /api/v1/stores?lat&lng&radius&unit` and `GET /api/v1/stores/:id`.
**Feature / Story:** 2.3 Store Directory · US-06.
**Acceptance criteria:**
- The list is sorted by distance and includes `distance` in the requested unit; radius filtering is correct for both mi and km (unit test with known coordinates).
- Without `lat`/`lng`, stores are returned alphabetically.
- The detail endpoint includes hours, phone, policies, `isOpenNow` (Europe/Vienna time) and the 10 most recent non-expired sightings.

### T-14 · Store directory & store profile screens · M
**Description:** The `/stores` and `/stores/:id` screens.
**Feature / Story:** 2.3 Store Directory · US-06.
**Acceptance criteria:**
- As a novice collector, I can see nearby stores with their distance (in my unit) and an open-now badge, without signing in.
- The profile shows the address with an "Open in Maps" link, tap-to-call phone, hours for every day, policies, recent sightings and recent broadcasts.
- An empty state appears when no stores are within the radius.
- Loading and error states are handled; the list renders in under 1 s on a 4G throttle using seed data.

---

## Epic C — Collection & Want List (US-01, US-02, US-03)

### T-15 · Crate schema · S
**Description:** A `crate_items` table (`user_id`, `album_id`, `list` enum `collection|want`, `pressing_notes`, `condition`, `notes`, `acquired_at`, timestamps) with RLS so each user can only access their own rows.
**Feature / Story:** 1.1, 1.2, 1.3 · US-01, US-02, US-03.
**Acceptance criteria:**
- The migration applies cleanly, with RLS tests for owner and non-owner access.
- Indexes exist on `(user_id, list)` and `(user_id, album_id)`.
- The same album can exist several times in a collection (different pressings), and each entry keeps its own pressing notes.

### T-16 · Crate API · M
**Description:** `GET /api/v1/crate?list=`, `POST /api/v1/crate`, `PATCH /api/v1/crate/:id`, `DELETE /api/v1/crate/:id`.
**Feature / Story:** 1.1, 1.2 · US-01, US-02.
**Acceptance criteria:**
- Every endpoint requires authentication and only touches the caller's items.
- `POST` accepts a `catalogId` (calling T-05 to upsert the album) and returns `409 ALREADY_OWNED` with the existing item when the user already owns that album, unless `force=true`.
- List results support `q` (title or artist), `genre` filter and sorting by artist, title or date added.
- Input is validated (e.g. `zod`), and invalid input returns `400` with field errors.

### T-17 · Add record screen (catalog lookup) · M
**Description:** At `/crate/add`, search the external catalog and add a result to the Collection or Want List with pressing and condition notes.
**Feature / Story:** 1.1 Collection Cataloging · US-01; 1.2 · US-02.
**Acceptance criteria:**
- Typing at least 2 characters shows catalog results (debounced 300 ms) with cover, title, artist, year and format.
- The user chooses Collection or Want List, can add pressing notes and condition, and saves in at most 3 taps after picking a result.
- When the album is already in the Collection, a "You already own this" warning lets the user cancel or add anyway.

### T-18 · Collection screen · M
**Description:** The `/crate/collection` screen listing owned records.
**Feature / Story:** 1.1 Collection Cataloging · US-01.
**Acceptance criteria:**
- Shows every owned record with cover, title, artist, year and pressing notes; supports search and genre filter.
- A collection of 500 items scrolls smoothly (virtualised list) on a mid-range phone.
- Album detail (`/albums/:id`) and search results show an "In your collection" badge for owned albums, so the user can avoid a duplicate purchase in the store.

### T-19 · Want List screen · M
**Description:** The `/crate/wants` screen listing wanted albums and target pressings.
**Feature / Story:** 1.2 Want List Management · US-02.
**Acceptance criteria:**
- Shows wanted albums with their target pressing notes; supports search.
- Items with at least one non-expired sighting within the user's default radius show a "Spotted nearby" badge that links to those sightings.
- The list loads in under 1 s from cache when offline (works with T-35).

### T-20 · Want → Collection transfer · S
**Description:** A "Mark as acquired" action on `/crate/items/:id`, backed by `POST /api/v1/crate/:id/acquire`.
**Feature / Story:** 1.3 Want-to-Collection Transfer · US-03.
**Acceptance criteria:**
- One tap plus a confirmation moves the item from Want List to Collection, keeping title, artist, pressing and notes; the user re-enters nothing.
- `acquired_at` is set and the user can optionally add condition notes in the same dialog.
- The move is a single atomic update (no window where the item is missing or duplicated).
- The action works offline and syncs when the connection returns (works with T-35).
- Calling acquire on an item already in the Collection returns `409`.

---

## Epic D — Crowdsourced Sightings (US-05)

### T-21 · Sightings schema & 30-day expiry · M
**Description:** A `sightings` table (`album_id`, `store_id`, `reporter_id`, `reported_at`, `price_note`, `condition` enum, `status` enum `reported|verified|flagged|sold|expired`, `expires_at`, `verified_by`, `verified_at`) and a scheduled expiry job.
**Feature / Story:** 2.2 Crowdsourced Reporting · US-05; PRD §4 decision "Sighting freshness".
**Acceptance criteria:**
- `expires_at` defaults to `reported_at + interval '30 days'`.
- A scheduled job (pg_cron, daily) sets `status = 'expired'` on rows past `expires_at`; a test with a back-dated row proves it.
- Feed, search, store and want-list queries exclude expired, sold and flagged sightings by default.
- The condition enum uses the standard Goldmine scale (M, NM, VG+, VG, G+, G, F, P).

### T-22 · Report sighting API · S
**Description:** `POST /api/v1/sightings`.
**Feature / Story:** 2.2 Crowdsourced Reporting · US-05.
**Acceptance criteria:**
- Requires authentication; `catalogId`, `storeId` and `condition` are required; `priceNote` is optional (at most 60 characters).
- `reported_at` is set by the server; client-supplied timestamps are ignored.
- Rate limit: at most 20 sightings per user per 24 h (`429` beyond that).
- A newly created sighting appears in feed and search queries straight away.

### T-23 · Report sighting screen · M
**Description:** The `/report` screen: pick an album, pick a store, add a price note and condition, then submit.
**Feature / Story:** 2.2 Crowdsourced Reporting · US-05.
**Acceptance criteria:**
- Store choices are sorted by distance; the nearest store is preselected when the user is within 200 m of it.
- The whole flow can be done one-handed in under 30 s, with every required field reachable without scrolling on a 360 × 640 screen.
- On success the user sees a confirmation and the sighting appears on Discover.
- When offline, the report is queued and sent automatically once the connection returns (works with T-35).

---

## Epic E — Radius & Keyword Search (US-04)

### T-24 · Radius search API · M
**Description:** `GET /api/v1/search?q&lat&lng&radius&unit&genre` returns albums matching the keyword that have active sightings within the radius.
**Feature / Story:** 2.1 Radius & Keyword Search · US-04.
**Acceptance criteria:**
- Matches album title or artist (case- and accent-insensitive, so "Bjork" finds "Björk").
- Only active (non-expired, not sold, not flagged) sightings within the radius are counted; radius conversion is unit-tested for mi and km.
- Each result includes the album, nearest store, distance, most recent sighting time and verification status; results are sorted by distance, then recency.
- p95 response time is under 500 ms on a seed of 10k sightings.

### T-25 · Search screen · M
**Description:** The `/search` screen with keyword input, radius chips, filters and a list/map toggle.
**Feature / Story:** 2.1 Radius & Keyword Search · US-04.
**Acceptance criteria:**
- Radius chips show 5 / 10 / 25 in the user's unit, with the user's default radius preselected.
- Each result shows "Spotted *n* days ago at *Store* · *x* mi/km" and a ✓ badge when the store has verified it.
- An empty state suggests widening the radius or adding the album to the Want List.
- If location permission is denied, the user is asked to allow it or enter a district/postcode.

### T-26 · Album detail screen · S
**Description:** The `/albums/:id` screen: catalog metadata, crate status and nearby sightings.
**Feature / Story:** 2.1 · US-04; 1.1 · US-01; 1.2 · US-02.
**Acceptance criteria:**
- Shows cover, title, artist, year, label, format and genres from the catalog.
- Shows an "In your collection" or "On your Want List" badge when applicable.
- Lists active nearby sightings with store, distance, price note, condition and status.
- Has actions: Add to Collection, Add to Want List, Report sighting (prefilled album).

---

## Epic F — Map & Visual Feed (US-07)

### T-27 · Feed API · S
**Description:** `GET /api/v1/feed?lat&lng&radius&unit&cursor` returns a reverse-chronological mix of active sightings and broadcasts.
**Feature / Story:** 2.4 Map & Visual Feed · US-07; 3.1 · US-08.
**Acceptance criteria:**
- Items are typed (`sighting` | `broadcast`) and sorted newest first, with cursor pagination (page size 20).
- Only items within the radius are returned, and expired sightings never appear.
- Each item has the coordinates the map needs to place a pin.

### T-28 · Discover screen & sighting detail · L
**Description:** The `/` screen with a Map/Feed toggle (Leaflet + OpenStreetMap tiles), plus `/sightings/:id` and `/broadcasts/:id`.
**Feature / Story:** 2.4 Map & Visual Feed · US-07.
**Acceptance criteria:**
- The map centres on the user's location and shows one pin per store with active sightings; tapping a pin shows a preview card that links to the detail screen.
- The feed shows cards with cover, album, store, time ago, condition and status; it supports pull-to-refresh and infinite scroll.
- Sighting detail shows the status (reported, verified, flagged, sold or expired) and "Expires on *date*".
- Changing the radius in the top bar updates both map and feed.

---

## Epic G — Stock Arrival Broadcasts (US-08)

### T-29 · Broadcasts schema & API · S
**Description:** A `broadcasts` table (`store_id`, `author_id`, `title`, `body`, optional highlighted `album_ids`, `created_at`), `POST /api/v1/broadcasts` and `GET /api/v1/stores/:id/broadcasts`.
**Feature / Story:** 3.1 Stock Arrival Broadcasts · US-08.
**Acceptance criteria:**
- Only a `store_manager` linked to the store can post (`403` otherwise).
- `title` is required (at most 80 characters); `body` can be up to 500 characters.
- Rate limit: at most 5 broadcasts per store per 24 h.
- New broadcasts appear in the feed API and on the store profile.

### T-30 · Merchant broadcast screens · M
**Description:** The `/merchant/broadcasts` and `/merchant/broadcasts/new` screens.
**Feature / Story:** 3.1 Stock Arrival Broadcasts · US-08.
**Acceptance criteria:**
- A store manager can write a broadcast, optionally attach up to 10 highlighted albums from the catalog, preview it and publish it in under 1 minute.
- The list shows past broadcasts with posted time and the number of push notifications sent.
- The screens work on both a phone and a desktop browser (at least 1024 px wide) at the counter.

### T-31 · Web push delivery · L
**Description:** Push subscriptions in the service worker, stored in `push_subscriptions`. Publishing a broadcast sends a web push (VAPID) to opted-in collectors whose default radius includes the store.
**Feature / Story:** 3.1 · US-08; 4.2 Preferences; PRD §4 decision "Broadcast delivery".
**Acceptance criteria:**
- Users are only asked for push permission from the opt-in toggle (T-09), never automatically on first load.
- After a broadcast is published, opted-in collectors within range receive a notification within 60 s; tapping it opens `/broadcasts/:id`.
- Collectors who have opted out or are out of range do not receive it (integration test with mocked push sender).
- Expired or invalid subscriptions (HTTP 404/410 from the push service) are deleted automatically.
- Works on Android Chrome and on iOS Safari 16.4+ when the app is installed to the home screen; a manual check on both is recorded in the PR.

---

## Epic H — Sighting Verification (US-09)

### T-32 · Sighting status API · S
**Description:** `PATCH /api/v1/sightings/:id/status` with `verified | flagged | sold`.
**Feature / Story:** 3.2 Sighting Verification · US-09.
**Acceptance criteria:**
- Only a store manager linked to the sighting's store can change it (`403` otherwise).
- Sets `verified_by` and `verified_at`; each change is written to `sighting_status_history`.
- Marking a sighting `verified` resets `expires_at` to 30 days after the verification.
- Flagged and sold sightings disappear from feed and search immediately.

### T-33 · Verification queue screen · M
**Description:** The `/merchant/sightings` screen listing sightings at the manager's store, with quick actions.
**Feature / Story:** 3.2 Sighting Verification · US-09.
**Acceptance criteria:**
- Shows unreviewed sightings first, with album, reporter display name, time, price note and condition.
- Each sighting has one-tap Confirm, Flag inaccurate and Mark sold buttons, each with undo for 5 s.
- Collectors see a ✓ "Verified by store" badge on confirmed sightings everywhere sightings are shown.
- A manager can review 10 sightings in under 1 minute (no extra data entry, per PRD §1.2).

### T-34 · Merchant dashboard & store profile editing · S
**Description:** The `/merchant` dashboard and `/merchant/store` edit screen.
**Feature / Story:** 3.1, 3.2 · US-08, US-09; 2.3 Store Directory.
**Acceptance criteria:**
- The dashboard shows the number of pending sightings, recent broadcasts and a "New broadcast" shortcut.
- A manager can edit their store's hours, phone and policies, and the changes appear on `/stores/:id` straight away.
- A manager cannot edit another store, or the store's name and location (admin only).

---

## Epic I — Cross-cutting

### T-35 · Offline support & sync queue · L
**Description:** Service worker caching and a local IndexedDB queue so the app works in basement shops with no signal.
**Feature / Story:** PRD §1.3 (intermittent coverage, optimistic local caching); supports US-01, US-02, US-03, US-05.
**Acceptance criteria:**
- With the network disabled in DevTools: Collection, Want List and the last 10 viewed store profiles still open.
- Sighting reports and crate changes made offline appear immediately (optimistic UI) and sync automatically when the connection returns, without duplicates (idempotency key).
- An offline banner appears while disconnected; screens that need a connection show a clear message instead of hanging.

### T-36 · Accessibility & in-store usability pass · M
**Description:** Audit and fix accessibility and readability for low-light, one-handed use in stores.
**Feature / Story:** PRD §1.3 usage contexts; all collector stories.
**Acceptance criteria:**
- Lighthouse accessibility score is at least 90 on Discover, Search, Report, Stores and My Crate.
- Text contrast meets WCAG 2.1 AA; every primary action sits in the bottom half of the screen.
- Every interactive element has an accessible name and can be reached with the keyboard.
