## Commands

- `npm run dev` — dev server at http://localhost:3000
- `npm run build` — production build (also type-checks)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)
- Type-check only: `npx tsc --noEmit`

## Tests

- `npm test` — Vitest in watch mode (`client` project in jsdom, `server` project in node)
- `npm run test:run` — single Vitest run, as in CI
- `npm run test:coverage` — single run with coverage; report in `coverage/index.html`
- `npm run test:e2e` — Playwright against `next build` + `next start` on port 3100 (`desktop` and `mobile` projects)

Unit tests live in `__tests__/client/` (jsdom) and `__tests__/server/` (node). E2E tests live in `e2e/`.

Install Chromium once before the first E2E run: `npx playwright install chromium`.
