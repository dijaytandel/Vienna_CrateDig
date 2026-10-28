# CrateDig

A mobile-first web app for local record-store discovery in Vienna.

CrateDig helps:

- **Experienced collectors** confirm a specific album pressing is in stock at a local store before travelling across town.
- **Emerging collectors** explore nearby stores and organize their personal collection to avoid duplicate purchases.
- **Independent store managers** announce fresh stock arrivals and verify crowdsourced sightings at their store.

CrateDig is built to **enhance, not replace,** in-person crate-digging. It is a community-driven local discovery tool.

**Out of scope:** remote e-commerce, automated POS sync, shipping fulfillment.

See the [PRD](docs/PRD.md) for Phase 1 features and user stories, the [task list](docs/TASKS.md) for development tasks, and the [workspace rules](docs/WORKSPACE_RULES.md) before contributing.

## Repo layout

| Path         | Purpose                                         |
| ------------ | ----------------------------------------------- |
| `client/`    | React PWA (local dev: Vite)                     |
| `api/`       | Express API (local dev: Node)                   |
| `supabase/`  | SQL migrations + seeds                          |
| `docs/`      | PRD, site map, OpenAPI, deployment notes        |
