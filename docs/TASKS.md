# CrateDig — Development Tasks

This file breaks the 10 final user stories (US-01 to US-10) from the [PRD](PRD.md) (Specification #3) into development tasks. Each task lists:

- a short **description**
- the **feature or story** it delivers (PRD feature module and US-ID)
- **acceptance criteria (AC):** the task is "done" only when every AC is met, the code is merged to `main` under the [Workspace Rules](WORKSPACE_RULES.md), and CI passes

Routes refer to [`SITEMAP.md`](SITEMAP.md). Task IDs (`T-xx`) are used in branch names and commit messages. Data names follow PRD §3.2; enum values are stored in `snake_case` (PRD Appendix C).

**Size:** S ≈ under ½ day · M ≈ 1–2 days · L ≈ 3+ days.

**Global rules for every UI task:** dark navy `#0F172A` background with burnt orange `#F97316` primary actions; prices in USD (`$28.00`); distances in miles unless the user picked km; at 360 × 640 px portrait there is no horizontal scroll and tap targets are at least 44 × 44 px.

## Summary

| Epic | Tasks | Stories / Features |
|---|---|---|
| 0. Foundation | T-01 – T-07 | enables all |
| A. Guest-First Access & Auth | T-08 – T-10 | US-01 · 4.1 |
| B. Store Directory | T-11 – T-13 | US-07 · 2.3 |
| C. My Crate | T-14 – T-20 | US-02, US-03, US-04 · 1.1–1.3 |
| D. Sighting Reporting | T-21 – T-23 | US-06 · 2.2 |
| E. Radius & Keyword Search | T-24 – T-26 | US-05 · 2.1 |
| F. Discover Feed | T-27 – T-28 | US-01 · 2.4 |
| G. Stock Arrival Broadcasts | T-29 – T-31 | US-08 · 3.1 |
| H. Sighting Verification & Merchant Portal | T-32 – T-34 | US-09 · 3.2 |
| I. Store Manager Verification | T-35 | 4.3 |
| J. Profile & Preferences | T-36 | US-10 · 4.2 |
| K. Cross-cutting | T-37 – T-38 | §1.3 usage contexts |

---

## Epic 0 — Foundation

### T-01 · Client scaffold (React PWA) · M
**Description:** Create the Vite + React + TypeScript app in `client/` with routes for every site-map screen and a PWA manifest and service worker.
**Feature / Story:** Enables all stories.
**Acceptance criteria:**
- `npm run dev` serves the app; `npm run build` succeeds with no errors.
- `/` redirects to `/discover`; every route in `SITEMAP.md` §4 resolves (placeholder screens are fine); unknown routes show a 404 screen.
- The app can be installed (valid manifest and registered service worker per Lighthouse).

### T-02 · API scaffold (Express) · M
**Description:** Create the Express + TypeScript API in `api/` with `/api/v1` routing, env config, JSON errors, CORS and tests.
**Feature / Story:** Enables all stories.
**Acceptance criteria:**
- `GET /api/v1/health` returns `200 {"status":"ok"}`.
- Unknown routes return `404 { error: { code: "NOT_FOUND", … } }`; unhandled errors return `500` in the same format with no stack trace.
- `api/.env.example` lists every variable by name only; `npm test` passes.

### T-03 · Supabase base schema · M
**Description:** Initialise `supabase/` with migrations for the six PRD entities: `profiles` (User), `stores`, `master_records`, `sightings`, `crate_items`, `merchant_broadcasts`. Include their enums and RLS enabled on every table.
**Feature / Story:** PRD §3.2; enables all data-backed stories.
**Acceptance criteria:**
- `supabase db reset` applies all migrations and the seed from scratch with no errors.
- Columns, keys and enums match PRD §3.2 (e.g. `user_role` = `collector | store_manager | admin`, `sighting_status` = `active | sold_out | flagged | archived`, `condition_grade` = `mint | near_mint | vg_plus | vg | fair`, `list_type` = `collection | want_list`).
- A new auth user automatically gets a `profiles` row with role `collector` and `default_radius_miles = 10`.
- Cardinalities hold: one manager per store (`stores.manager_user_id` unique, nullable).

### T-04 · Tooling & CI · S
**Description:** ESLint, Prettier and type-check in both packages, plus a GitHub Actions workflow running lint, type-check, test and build on every PR.
**Feature / Story:** Workspace Rules (quality gate).
**Acceptance criteria:**
- `npm run lint`, `npm run typecheck` and `npm test` exist in `client/` and `api/`.
- Every PR to `main` shows the CI check, and any failure fails it.

### T-05 · External catalog integration (Discogs / MusicBrainz) · M
**Description:** An API proxy that searches Discogs (MusicBrainz as fallback), normalises results and upserts them into `master_records`.
**Feature / Story:** 1.1, 1.2, 2.2 · US-02, US-03, US-06.
**Acceptance criteria:**
- `GET /api/v1/catalog/search?q=` (≥ 2 chars) returns at most 20 results: `{ apiSourceId, artistName, albumTitle, songTitle, recordLabel, releaseYear, genre, coverArtUrl|null }`.
- Choosing a result upserts one `master_records` row keyed by `api_source_id` (no duplicates).
- If Discogs is unavailable or rate-limited, MusicBrainz is queried; if both fail, the endpoint returns `503 CATALOG_UNAVAILABLE`.
- API tokens stay on the server only; identical queries within 24 h are served from cache (test with a mocked upstream).

### T-06 · OpenAPI spec & deployment notes · S
**Description:** Create `docs/openapi.yaml` for the v1 endpoints and `docs/DEPLOYMENT.md`.
**Feature / Story:** Documentation for all stories.
**Acceptance criteria:**
- `openapi.yaml` passes lint (`npx @redocly/cli lint`) and covers every merged endpoint.
- `DEPLOYMENT.md` lists the environments, deploy steps and env var names.

### T-07 · Design system & app shell · M
**Description:** Theme tokens and shared components: the 5-tab bottom nav, top-right avatar menu, burnt orange button, radius/filter pills, typing-pill tag input, and the two-letter colored album initial badge.
**Feature / Story:** PRD Executive Summary (Approved Visual System) · §1.3; used by every story.
**Acceptance criteria:**
- Tokens define navy `#0F172A` and orange `#F97316`; body text vs background meets WCAG AA contrast.
- The bottom nav (Discover · Search · Report · Stores · My Crate) stays visible on every main screen and highlights the active tab.
- `AlbumBadge` shows `cover_art_url` when present; otherwise it shows two letters from artist and album with a color derived deterministically from them (the same album always gets the same color; unit test).
- `TagInput` adds a pill on Enter or comma, removes it with ×, and prevents duplicates.
- The avatar shows the user's initials and opens Profile (plus Merchant Dashboard for store managers); guests see a Log in button instead.

---

## Epic A — Guest-First Access & Auth (US-01, 4.1)

### T-08 · Guest-first routing & protected actions · S
**Description:** Guests start on `/discover` with read-only access. Protected actions redirect to `/login` and come back afterwards.
**Feature / Story:** 2.4, 4.1 · US-01.
**Acceptance criteria:**
- With no session, opening the app lands on `/discover` with no login wall.
- Guests can open `/search`, `/stores`, `/stores/:id`, `/sightings/:id`, `/broadcasts/:id` and `/albums/:id`.
- Tapping Report, My Crate, Add to crate, Report it again or favorite store as a guest goes to `/login?next=…`; after a successful login the user returns to `next`.
- `/welcome` can still be reached and offers Create account, Log in and "keep digging as a guest".

### T-09 · Sign up, log in, sign out · M
**Description:** Email + password auth with Supabase Auth on `/signup` and `/login`; sign out from `/profile`.
**Feature / Story:** 4.1 · US-01.
**Acceptance criteria:**
- Sign up requires display name, unique email, password and confirmation; the U.S. ZIP is optional and, if given, must be exactly 5 digits.
- After signing up or logging in, the user lands on `/discover` with their saved radius and genre preferences applied.
- Invalid credentials show an inline error that doesn't reveal whether the email exists.
- The session survives reloads; Sign out clears it and returns the user to guest mode on `/discover`.

### T-10 · Role-based access control (API + RLS) · M
**Description:** JWT middleware with role checks, plus RLS policies for every table.
**Feature / Story:** 4.1, 4.3.
**Acceptance criteria:**
- Read endpoints for feed, search, stores, sightings, albums and broadcasts work without a token; write endpoints return `401` without one.
- Merchant endpoints return `403` unless the caller is `store_manager` and is the `manager_user_id` of a `verified` store, and they only act on that store.
- RLS tests show users cannot read or modify another user's `crate_items` or profile.
- No API endpoint can change `stores.verification_status` (admin changes are database-only).

---

## Epic B — Store Directory (US-07)

### T-11 · Store data & U.S. seed · S
**Description:** Seed `stores` for one generic U.S. metro area (e.g. Portland, OR 97205) and load a U.S. ZIP-centroid table for ZIP fallback.
**Feature / Story:** 2.3 · US-07; PRD §1.3 (U.S. localization).
**Acceptance criteria:**
- The seed has at least 10 stores with U.S. street address, ZIP, `geo_lat`/`geo_lng`, Mon–Sun `operating_hours` JSON, U.S. phone, website, `payment_methods` and specialty `tags`; most are `verified` and at least one is `pending`.
- A `zip_centroids` table resolves any valid 5-digit ZIP to latitude/longitude (public Census ZCTA data).
- The seed also has sample master records, sightings (USD prices) and broadcasts so every screen shows realistic data.

### T-12 · Store directory API · S
**Description:** `GET /api/v1/stores?lat&lng|zip&radius` and `GET /api/v1/stores/:id`.
**Feature / Story:** 2.3 · US-07.
**Acceptance criteria:**
- The list is sorted by distance in miles (or km if requested), filtered by radius 5 / 10 / 25, and includes `isVerified`; distance math is unit-tested against known coordinates.
- `zip` works in place of `lat`/`lng`.
- Detail includes address, phone, website, hours, `isOpenNow` (in the store's local time), payment methods, tags, active sightings and recent broadcasts.

### T-13 · Store directory & profile screens · M
**Description:** The `/stores` and `/stores/:id` screens.
**Feature / Story:** 2.3 · US-07.
**Acceptance criteria:**
- `/stores` shows distance pills (within 5 / 10 / 25 mi) and cards with a circular letter icon, distance, U.S. address and a green check for verified stores.
- `/stores/:id` shows Open in Maps, a tap-to-call U.S. phone link, a website link, a Mon–Sun hours table, payment methods, specialty tags, active sightings (USD) and broadcasts.
- Signed-in collectors can favorite or unfavorite the store (saved to their favorite stores, US-10).
- Empty, loading and error states are handled.

---

## Epic C — My Crate (US-02, US-03, US-04)

### T-14 · Crate API · M
**Description:** `GET /api/v1/crate?listType&q&genre`, `POST /api/v1/crate`, `PATCH /api/v1/crate/:id` and `DELETE /api/v1/crate/:id`.
**Feature / Story:** 1.1, 1.2 · US-02, US-03.
**Acceptance criteria:**
- Every endpoint is authenticated and owner-only.
- `POST` accepts `apiSourceId` (upserting `master_records` via T-05), `listType`, an optional condition grade, special attributes, `purchasePriceUsd` (≥ 0, 2 decimals) and `userNotes`.
- Adding to Collection a record the user already owns returns `409 ALREADY_OWNED` unless `force=true`.
- Search matches title, artist or genre; inputs are validated (`400` with field errors).

### T-15 · My Crate screen · M
**Description:** The `/crate` screen with a Collection / Want List toggle.
**Feature / Story:** 1.1 · US-02; 1.2 · US-03.
**Acceptance criteria:**
- The segmented toggle switches between Collection and Want List and remembers the last tab.
- Includes a keyword search bar, an All genres filter and a burnt orange + Add record button.
- Item cards show the initial badge or cover, title, artist, and price paid in USD (Collection) or preferred pressing attributes (Want List).
- 500 items scroll smoothly (virtualised list).

### T-16 · Add a record screen · M
**Description:** The `/crate/add` screen: catalog lookup, destination, details.
**Feature / Story:** 1.1 · US-02; 1.2 · US-03.
**Acceptance criteria:**
- Typing at least 2 characters shows catalog results (300 ms debounce) with badge, title, artist and year.
- The user picks Collection or Want List and can add condition grade, special attributes (pills), price paid ($) and notes.
- A "You already own this" warning appears for duplicates in the Collection, with Cancel or Add anyway.
- Saves in at most 3 taps after choosing a result.

### T-17 · Album details screen · S
**Description:** The `/albums/:id` screen.
**Feature / Story:** 1.1, 1.2, 2.1 · US-02, US-03, US-05.
**Acceptance criteria:**
- Shows badge or cover, artist/composer, release year, label, key track, genre and catalog ID.
- Shows "In your Collection" or "On your Want List" when applicable, so users can avoid duplicate purchases in the store.
- Collectors see Add to Collection, Add to Want List and Report sighting; guests see "Log in to add or report".
- Lists nearby active sightings with store, distance, USD price and condition.

### T-18 · Crate item detail screen · S
**Description:** The `/crate/items/:id` screen: view and edit an item, or delete it.
**Feature / Story:** 1.1, 1.2 · US-02, US-03.
**Acceptance criteria:**
- Shows record metadata, condition, special attributes, price paid, notes and `acquired_at` (for acquired items).
- Notes, condition, attributes and price can be edited inline; delete asks for confirmation.
- The **Mark as acquired** button appears only on Want List items.

### T-19 · Acquire API with sighting sync · M
**Description:** `POST /api/v1/crate/:id/acquire { storeId | null, purchasePriceUsd? }`.
**Feature / Story:** 1.3 · US-04; PRD §3.1 (Want List Acquisition-to-Sighting Linkage).
**Acceptance criteria:**
- In one transaction: `list_type` → `collection`, `acquired_at = now()`, and `purchased_store_id = storeId` (or null for "Acquired elsewhere").
- When `storeId` is given, every `active` sighting at that store for that `record_id` becomes `sold_out`; sightings at other stores are untouched; the history row is kept, not deleted.
- Returns the updated item and the IDs of the sightings closed; calling it on a Collection item returns `409`.
- Integration tests cover store selected (sighting closed), "elsewhere" (no sighting changes) and rollback on failure.

### T-20 · Acquire store modal · M
**Description:** The modal opened by Mark as acquired on `/crate/items/:id`.
**Feature / Story:** 1.3 · US-04.
**Acceptance criteria:**
- The modal lists stores that have an active sighting of this record, nearest first with distance and USD price, plus an **Acquired elsewhere** option.
- An optional "price paid ($)" field is prefilled from the chosen sighting's price.
- Confirming moves the item to Collection with no re-entry, shows "Moved to Collection — marked sold out at *Store*", and the sighting shows Sold Out on `/sightings/:id`.
- Works offline: the action is queued and synced (T-37).

---

## Epic D — Sighting Reporting (US-06)

### T-21 · Sighting lifecycle & 180-day archive · M
**Description:** Sighting status rules plus a scheduled archive job.
**Feature / Story:** 2.2, 2.4 · US-06, US-01; PRD §3.1 (6-Month Feed Lifecycle).
**Acceptance criteria:**
- `archive_date` defaults to `sighting_timestamp + interval '180 days'`.
- A daily pg_cron job sets `status = 'archived'` on `active` sightings past `archive_date`; a test with a back-dated row proves it.
- Feed and search return only `active` sightings by default; `sold_out`, `flagged` and `archived` rows are never deleted.

### T-22 · Report sighting API · S
**Description:** `POST /api/v1/sightings` and `GET /api/v1/stores/nearest?lat&lng`.
**Feature / Story:** 2.2 · US-06.
**Acceptance criteria:**
- Requires auth; `apiSourceId`, `storeId` and `conditionGrade` are required; `priceUsd` (≥ 0, 2 decimals) and `specialAttributes` are optional.
- `sighting_timestamp` is set by the server; `status = active`, `store_verified = false`.
- `nearest` returns the closest verified store and its distance in miles.
- Rate limit: at most 20 sightings per user per 24 h (`429`).

### T-23 · Report a sighting screen (5 steps) · L
**Description:** The `/report` guided flow: catalog lookup → store → condition → USD price → special attributes.
**Feature / Story:** 2.2 · US-06.
**Acceptance criteria:**
- Step 1: catalog lookup after 2 characters auto-fills album metadata; it can be prefilled from Album details or "Report it again".
- Step 2: with GPS permission, the nearest store is **pre-selected automatically**; the dropdown still allows a manual override. Without GPS, stores are sorted by distance from the user's ZIP.
- Step 3: condition grade chips (Mint, Near Mint, VG+, VG, Fair). Step 4: optional `$` price. Step 5: optional attribute pills (colored vinyl, 180g, first pressing, remaster).
- With GPS on, a sighting can be submitted one-handed in under 30 seconds; on success it appears at the top of `/discover`.
- When offline, the submission is queued and sent when the connection returns (T-37).

---

## Epic E — Radius & Keyword Search (US-05)

### T-24 · Search API (GPS or ZIP) · M
**Description:** `GET /api/v1/search?q&genre&radius&lat&lng|zip` over active sightings.
**Feature / Story:** 2.1 · US-05.
**Acceptance criteria:**
- Matches artist, album or genre (case- and accent-insensitive).
- Location comes from `lat`/`lng`, or else `zip` (via `zip_centroids`); with neither, it returns `400 LOCATION_REQUIRED`.
- Only `active` sightings within the radius (5 / 10 / 25 mi) are returned, sorted by distance then newest, each with USD price, condition, `storeVerified` and distance.
- p95 response time is under 500 ms on 10k seeded sightings.

### T-25 · Search screen · M
**Description:** The `/search` screen.
**Feature / Story:** 2.1 · US-05.
**Acceptance criteria:**
- Has a keyword input, burnt orange radius pills (5 / 10 / 25 mi, defaulting to the user's radius or 10 mi for guests) and an All genres dropdown.
- Result cards show the initial badge, album, store, distance, `$` price, condition and a "Verified by store" check when applicable.
- If GPS is denied and no ZIP is saved, the user is asked for a 5-digit ZIP (guests keep it locally).
- The empty state suggests widening the radius or adding the album to the Want List.

### T-26 · Sighting details screen · S
**Description:** The `/sightings/:id` screen.
**Feature / Story:** 2.1, 2.2, 3.2 · US-05, US-06, US-09.
**Acceptance criteria:**
- Shows the album badge, store with distance in miles, reporter display name, USD price (e.g. `$28.00`), condition grade, special attributes, status pill (Active, Sold Out, Flagged or Archived), verified mark and archive date.
- **Report it again** opens `/report` prefilled with the same album and store (guests are sent to login first).
- Links to Album details and Store profile.

---

## Epic F — Discover Feed (US-01)

### T-27 · Feed API · S
**Description:** `GET /api/v1/feed?lat&lng|zip&radius&cursor` returns a mix of active sightings and broadcasts from the last 6 months.
**Feature / Story:** 2.4 · US-01; 3.1 · US-08.
**Acceptance criteria:**
- Items are typed `sighting | broadcast`, newest first, with cursor pagination (20 per page).
- Only items from the last 180 days and within the radius are included; sightings must be `active`.
- Works without auth; for signed-in users, items matching their genre preferences or favorite stores are marked `isForYou`.

### T-28 · Discover screen & broadcast details · M
**Description:** The `/discover` screen and the `/broadcasts/:id` screen.
**Feature / Story:** 2.4 · US-01; 3.1 · US-08.
**Acceptance criteria:**
- `/discover` loads as the landing screen for guests and members, showing sighting cards (badge, album, store, distance in mi, `$` price, time ago) and broadcast cards; it supports pull-to-refresh and infinite scroll.
- Guests see a light "Create an account to report and save" banner that doesn't block anything.
- `/broadcasts/:id` shows the store header with distance, the arrival summary, an optional photo link, featured album cards and Visit store profile.

---

## Epic G — Stock Arrival Broadcasts (US-08)

### T-29 · Broadcasts API · S
**Description:** `POST /api/v1/broadcasts`, `GET /api/v1/stores/:id/broadcasts` and `GET /api/v1/broadcasts/:id`.
**Feature / Story:** 3.1 · US-08.
**Acceptance criteria:**
- Only the verified manager of the store can post (`403` otherwise).
- `arrivalSummary` is required (at most 500 characters); `photoUrl` is optional but must be `https://`; `featuredIds` holds at most 10 master record IDs.
- `posted_at` is set by the server; the broadcast appears in the feed and on the store profile straight away.

### T-30 · Merchant broadcast screens · M
**Description:** The `/merchant/broadcasts` history and the `/merchant/broadcasts/new` composer with Preview.
**Feature / Story:** 3.1 · US-08.
**Acceptance criteria:**
- The composer shows a live 500-character counter, an optional photo URL field (validated), a catalog picker for up to 10 featured records, and a **Preview** that matches `/broadcasts/:id` before Publish.
- History lists past broadcasts newest first.
- Usable on phone and on a desktop browser at least 1024 px wide.

### T-31 · Broadcast web push · L
**Description:** Push subscriptions and VAPID web push when a broadcast is published.
**Feature / Story:** 3.1 · US-08; 4.2 · US-10.
**Acceptance criteria:**
- Users are only asked for permission from the Profile broadcast push toggle, never automatically.
- Opted-in collectors are notified within 60 s if the store is one of their favorites **or** within their default radius of their location/ZIP. Tapping the notification opens `/broadcasts/:id`.
- Opted-out or out-of-range users receive nothing (integration test with a mocked sender); dead subscriptions (404/410) are removed.
- A manual check on Android Chrome and iOS Safari 16.4+ (installed PWA) is recorded in the PR.

---

## Epic H — Sighting Verification & Merchant Portal (US-09)

### T-32 · Sighting verification API · S
**Description:** `PATCH /api/v1/sightings/:id { action: confirm | flag | mark_sold }`.
**Feature / Story:** 3.2 · US-09.
**Acceptance criteria:**
- Only the verified manager of the sighting's store may call it.
- `confirm` → `store_verified = true`; `flag` → `status = flagged`; `mark_sold` → `status = sold_out`. Rows are never deleted, and each change is logged with who made it and when.
- Flagged and sold-out sightings disappear from feed and search immediately but stay visible at their URL with their status.

### T-33 · Sighting verification screen · M
**Description:** The `/merchant/sightings` queue.
**Feature / Story:** 3.2 · US-09.
**Acceptance criteria:**
- Lists active sightings at the manager's store, unconfirmed first, with album badge, reporter, time, `$` price and condition.
- One-tap ✓ Confirm, Flag and Mark sold buttons, each with a 5 s undo.
- A manager can review 10 sightings in under 1 minute with no typing.

### T-34 · Merchant dashboard & edit store profile · M
**Description:** The `/merchant` dashboard and `/merchant/store` editor.
**Feature / Story:** 3.1, 3.2, 2.3 · US-08, US-09, US-07.
**Acceptance criteria:**
- The dashboard shows the green verified badge, a pending-sightings card with Review, a recent-broadcasts card with + New broadcast, and an Edit store profile button. It is reachable only from the avatar menu by verified managers.
- `/merchant/store` edits Mon–Sun open/close times, U.S. phone (validated), website URL, and payment-method and specialty-tag pills; changes show on `/stores/:id` straight away.
- The store's name, address and verification status cannot be edited here.

---

## Epic I — Store Manager Verification (4.3)

### T-35 · Business License URL application & backend approval · M
**Description:** At `/merchant/verify`, a collector picks a store and submits a Business License URL. An admin approves or rejects it **in the database only**, using a documented procedure.
**Feature / Story:** 4.3 Backend Admin Verification; 4.1.
**Acceptance criteria:**
- The form has a store dropdown and a `https://` URL input. Submitting sets `stores.license_doc_url`, `manager_user_id` (the applicant) and `verification_status = pending`.
- Stores that are already verified, or have a pending claim by someone else, cannot be chosen.
- The applicant sees the status (Pending, Verified or Rejected) on `/merchant/verify` and `/profile`.
- `docs/DEPLOYMENT.md` (or `supabase/README.md`) documents the admin procedure: a SQL snippet or function that sets `verified` (and the user's role to `store_manager`) or `rejected`.
- There is **no** admin route or screen in `client/`.

---

## Epic J — Profile & Preferences (US-10)

### T-36 · Profile & preferences screen · M
**Description:** The `/profile` screen (from the avatar) and `GET/PATCH /api/v1/me`.
**Feature / Story:** 4.2 · US-10.
**Acceptance criteria:**
- Edit display name, 5-digit U.S. ZIP fallback, default radius (5 / 10 / 25 mi; default 10) and distance unit (mi default; km optional).
- Genre preferences use typing pills and are saved to `genre_preferences`; favorite stores are listed and can be removed here.
- Has the broadcast push toggle (T-31), a "Become a store manager" link to `/merchant/verify` (with status if an application exists), and Sign out.
- Changes take effect immediately in Discover, Search and Stores.

---

## Epic K — Cross-cutting

### T-37 · Offline support & sync queue · L
**Description:** Service-worker caching and an IndexedDB queue for use in basement or brick-walled shops.
**Feature / Story:** PRD §1.3; supports US-02, US-03, US-04, US-06.
**Acceptance criteria:**
- With the network disabled, My Crate and the last 10 viewed store profiles still open.
- Sightings, crate edits and acquisitions made offline appear immediately and sync when the connection returns, with no duplicates (idempotency key).
- An offline banner is shown; screens that need a connection say so instead of hanging.

### T-38 · Dim-light accessibility & performance pass · M
**Description:** Audit the app for in-store use: contrast, reachability and low bandwidth.
**Feature / Story:** PRD §1.3 (Dimly Lit In-Store Visual Ergonomics, Lightweight Media); all collector stories.
**Acceptance criteria:**
- Lighthouse accessibility is at least 90 on `/discover`, `/search`, `/report`, `/stores` and `/crate`.
- Primary actions sit in the bottom half of the screen; text meets WCAG 2.1 AA on the navy background.
- No screen downloads images other than optional external cover/photo URLs; initial JS payload is at most 250 kB gzipped.

---

## Appendix — Prototype 2 conformance

Prototype 2 (a 20-screen walkthrough) matches the site-map routes, but it differs from Specification #3 in the places below. **Spec #3 wins** (owner decision). Each fix belongs to the task listed and is tested by that task's acceptance criteria.

| # | Prototype 2 behaviour | Required (Spec #3) | Task |
|---|---|---|---|
| P-1 | Vienna seed data: real Vienna stores, € prices, +43 phones, 4-digit postcodes (`1070`), "Find vinyl in Vienna's…" copy | Generic U.S. metro seed, USD (`$28.00`), U.S. phones, 5-digit ZIP validation, U.S. copy | T-09, T-11, T-36 |
| P-2 | Walkthrough starts at `/welcome`; no Discover screen shown | `/` and app launch go to `/discover`; `/welcome` is optional | T-08, T-28 |
| P-3 | Merchant sighting queue has only ✓ Confirm and Mark sold (copy says "flag what's wrong") | Add a **Flag** action (`status = flagged`) | T-32, T-33 |
| P-4 | Genres, payment methods and specialty tags are comma-separated text fields | Typing-pill `TagInput` | T-07, T-34, T-36 |
| P-5 | Report store dropdown is "nearest first" but nothing is pre-selected | Nearest store **auto-selected** when GPS is allowed; ZIP fallback otherwise | T-23 |
| P-6 | Login screen lists demo accounts and `password123` | Demo accounts live only in the dev seed; nothing about credentials appears in the UI | T-09, T-11 |
| P-7 | Crate item screen shows no acquire flow in the walkthrough | Want List items show **Mark as acquired** → acquire store modal | T-18, T-20 |
