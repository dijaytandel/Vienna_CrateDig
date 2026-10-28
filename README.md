# CrateDig

A mobile-first web app for local record-store discovery in Vienna.

CrateDig helps:

- **Experienced collectors** confirm a specific album pressing is in stock at a local store before travelling across town.
- **Emerging collectors** explore nearby stores and organize their personal collection to avoid duplicate purchases.

CrateDig is built to **enhance, not replace,** in-person crate-digging. It is a community-driven local discovery tool.

**Out of scope:** remote e-commerce, automated POS sync, shipping fulfillment.

## Repo layout

| Path         | Purpose                                         |
| ------------ | ----------------------------------------------- |
| `client/`    | React PWA (local dev: Vite)                     |
| `api/`       | Express API (local dev: Node)                   |
| `supabase/`  | SQL migrations + seeds                          |
| `docs/`      | PRD, site map, OpenAPI, deployment notes        |
