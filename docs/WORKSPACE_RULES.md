# CrateDig — Workspace Rules

The coding workflow for everyone contributing to this repo. If a rule here conflicts with a tool default, the rule wins.

## 1. Stack baseline

| Area | Choice |
|---|---|
| Language | TypeScript (strict) in `client/` and `api/` |
| Client | React + Vite PWA |
| API | Express on Node LTS |
| Database / Auth / Storage | Supabase (Postgres + PostGIS) |
| Formatting / Linting | Prettier + ESLint, enforced in CI |
| Package manager | npm (commit `package-lock.json`) |

## 2. Naming conventions

### Files & folders

| Thing | Convention | Example |
|---|---|---|
| React component file | `PascalCase.tsx`, one component per file | `SightingCard.tsx` |
| React hook | `useCamelCase.ts` | `useGeolocation.ts` |
| Other TS modules | `camelCase.ts` | `distance.ts`, `crateService.ts` |
| Test files | next to the source, `*.test.ts(x)` | `distance.test.ts` |
| Folders | `kebab-case` | `merchant-portal/` |
| Client feature folders | `client/src/features/<feature>/` | `features/crate/` |
| API layers | `api/src/{routes,controllers,services,middleware}/` | `routes/sightings.ts` |
| SQL migrations | `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_description>.sql` | `20261101120000_create_sightings.sql` |
| Docs | `UPPER_SNAKE.md` for top-level docs | `SITEMAP.md` |

### Code

| Thing | Convention | Example |
|---|---|---|
| Variables, functions | `camelCase`, verbs for functions | `reportSighting()` |
| Booleans | `is/has/can/should` prefix | `isOpenNow`, `hasExpired` |
| Components, types, interfaces | `PascalCase`, no `I` prefix | `Sighting`, `CrateItem` |
| Constants | `UPPER_SNAKE_CASE` | `SIGHTING_TTL_DAYS = 30` |
| Enums / union values | lowercase string literals | `'reported' \| 'verified'` |
| Env vars | `UPPER_SNAKE_CASE`; client-exposed ones must start with `VITE_` | `VITE_SUPABASE_URL`, `DISCOGS_TOKEN` |

### Database

- Tables are plural `snake_case` (`crate_items`, `sightings`); columns are `snake_case`.
- Primary key `id uuid default gen_random_uuid()`; foreign keys are `<singular>_id` (`store_id`).
- Timestamps are `timestamptz` named `*_at` (`created_at`, `expires_at`).
- Enum types are singular `snake_case` (`sighting_status`).
- The API converts `snake_case` (DB) to `camelCase` (JSON) at the service layer.

### API

- Base path is `/api/v1`. Resources are plural, `kebab-case` nouns (`/sightings`, `/push-subscriptions`).
- Actions that aren't plain CRUD are sub-resources with a verb (`POST /crate/:id/acquire`).
- Query params and JSON fields are `camelCase`.
- Errors always use the shape `{ "error": { "code": "UPPER_SNAKE", "message": "...", "details"?: {} } }`.
- Every new or changed endpoint is documented in `docs/openapi.yaml` in the same PR.

## 3. Branching strategy (GitHub Flow)

- `main` is always deployable and **protected**: no direct pushes, no force-pushes, PR and green CI required.
- Create short-lived branches from the latest `main`, one task per branch:

| Prefix | Use | Example |
|---|---|---|
| `feature/` | New functionality (a task in `TASKS.md`) | `feature/T-20-want-to-collection-transfer` |
| `fix/` | Bug fix | `fix/T-24-radius-km-conversion` |
| `docs/` | Documentation only | `docs/openapi-sightings` |
| `chore/` | Tooling, deps, CI, refactors with no behaviour change | `chore/T-04-ci-workflow` |
| `db/` | Migration-only changes | `db/T-21-sightings-expiry` |

- Format: `<prefix>/<task-id>-<kebab-summary>`. Include the task ID whenever one exists.
- Keep branches current by rebasing on `main` (`git pull --rebase origin main`) and resolving conflicts locally.
- Delete the branch after merge.
- Releases are tagged on `main` with SemVer (`v0.1.0` = Phase 1 MVP).

## 4. Commit message guidelines (Conventional Commits)

```
<type>(<scope>): <imperative summary, ≤ 72 chars>

<optional body: what and why, wrapped at 72>

Refs: T-xx
```

- **type:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`, `db`.
- **scope:** `client`, `api`, `db`, `docs`, `ci`, or a feature (`crate`, `sightings`, `search`, `merchant`, `auth`).
- Write the summary in the imperative mood ("add", not "added"), lowercase, with no trailing period.
- Make one logical change per commit. Commits must not break the build.
- Add `BREAKING CHANGE:` in the footer for incompatible API or schema changes.
- Never commit secrets, `.env` files or generated build output.

Examples:

```
feat(crate): add mark-as-acquired transfer endpoint

Refs: T-20
```

```
fix(search): convert km radius to metres before ST_DWithin

Refs: T-24
```

## 5. Pull request & review process

1. **Open early.** Open a draft PR as soon as the branch has a meaningful commit. Mark it *Ready for review* once every acceptance criterion for the task is met.
2. **Title** follows the commit format: `feat(crate): want-to-collection transfer (T-20)`.
3. **Description** must include:
   - a summary of what changed and why
   - the linked task and story (`Closes T-20 · US-03`)
   - the acceptance criteria checklist copied from `TASKS.md`, all ticked
   - screenshots or a short recording for UI changes (mobile 360 px width; desktop too for Merchant Portal screens)
   - notes on migrations, new env vars or OpenAPI changes
4. **Size:** aim for under 400 changed lines (excluding lockfiles and generated files). Split anything larger.
5. **Required checks before merge:**
   - CI green (lint, type-check, tests, build)
   - at least **1 approving review** from another team member; the author never approves their own PR
   - all review conversations resolved
   - `openapi.yaml` and docs updated where relevant
   - new migrations apply cleanly with `supabase db reset`
6. **Reviewer duties:** respond within 1 working day. Check correctness against the ACs, security (auth checks, RLS, no secrets), naming and the rules in this file, and test coverage. Prefix optional comments with `nit:`.
7. **Merging:** use **squash and merge**; the squash commit message must follow the Conventional Commits format. The author merges after approval, then deletes the branch.
8. **Definition of Done:** every AC is met, the PR is merged to `main`, CI is green on `main`, and the task is ticked in `TASKS.md` (or its issue is closed).

## 6. Testing expectations

- **API:** unit tests for services and integration tests for each endpoint (happy path, auth failure, validation failure).
- **DB:** tests for RLS policies and the expiry job (T-21).
- **Client:** component tests for screens with logic (forms, toggles, offline queue).
- Bug fixes include a regression test.

## 7. Security & secrets

- Secrets live only in `.env` (git-ignored) and in the hosting provider's secret store. `.env.example` lists names only.
- The Supabase `service_role` key and the catalog API token are server-only and must never be used in `client/`.
- Every table has RLS enabled; any policy change needs a reviewer to confirm it explicitly.
