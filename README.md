# CrateDig

A mobile-first web app for discovering vinyl at independent record stores across U.S. metro areas ("GasBuddy for vinyl records").

CrateDig helps:

- **Guests** browse the local Discover feed, search sightings and explore stores straight away, with no login wall.
- **Experienced collectors** confirm a specific pressing is on a local shelf, with its USD price, before driving across town.
- **Emerging collectors** discover nearby shops and keep a Collection and Want List to avoid duplicate purchases.
- **Verified store managers** post stock arrival broadcasts and confirm or close out crowdsourced sightings at their store.

CrateDig is built to **enhance, not replace,** in-person crate-digging. It is a community-driven local discovery tool.

**Out of scope:** remote e-commerce, automated POS sync, shipping fulfillment, file hosting, and any public admin UI.

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
