# api

CrateDig's Express 5 + TypeScript API. All routes are under `/api/v1`.

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:3000/api/v1/health
npm test           # vitest + supertest
npm run typecheck
npm run build && npm start
```

- Folders follow [`docs/WORKSPACE_RULES.md`](../docs/WORKSPACE_RULES.md): `src/{routes,controllers,services,middleware}`.
- Errors always use the shape `{ "error": { "code", "message", "details"? } }`. Throw `HttpError` from a handler to send one.
- Environment variables are checked at startup in `src/config/env.ts`. `.env.example` lists them by name only.
