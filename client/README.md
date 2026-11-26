# client

CrateDig's mobile-first React PWA (Vite + TypeScript + React Router).

```bash
npm install
npm run dev        # http://localhost:5173 (redirects to /discover)
npm test           # vitest
npm run typecheck
npm run build      # outputs dist/ with the service worker and manifest
```

- Routes are listed in `src/app/routes.ts` and mirror [`docs/SITEMAP.md`](../docs/SITEMAP.md) §4. Screens are placeholders until their tasks land.
- Theme tokens (navy `#0F172A`, orange `#F97316`) live in `src/index.css`.
- PWA settings (manifest, Workbox) live in `vite.config.ts`. Icons are in `public/icons/`.
