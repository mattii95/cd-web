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

`npm run test:run` runs only the `client` and `server` projects and does not need Docker. Database tests live in `__tests__/db/` and run with `npm run test:db` (needs Postgres up).

## Database

Postgres 18 via Docker, accessed with Drizzle ORM (`db/`).

1. Copy `.env.example` to `.env` (read by `docker compose`) and create `.env.local` with `DATABASE_URL` for development.
2. Create `.env.test.local` with `DATABASE_URL` pointing to `DB_CD26_test` (see the comment in `.env.example`).
3. `docker compose up -d` — starts Postgres, pgAdmin and Mailpit. With an empty volume it creates `DB_CD26` and `DB_CD26_test`.
4. `npm run db:migrate` — applies the migrations to the database in `DATABASE_URL`.

Scripts:

- `npm run db:generate` — generates a migration from changes in `db/schema/`. Commit the result; do not edit merged migrations.
- `npm run db:migrate` — applies pending migrations.
- `npm run db:studio` — opens Drizzle Studio.
- `npm run db:seed` — runs `db/seed.ts` (no data yet).
- `npm run test:db` — runs the `db` Vitest project against the `_test` database. It refuses to run if the database name does not end in `_test`.

`GET /api/health` returns `200 {"status":"ok","db":"up"}` or `503 {"status":"error","db":"down"}`.

If the `docker/data` volume already existed, `docker/initdb/` did not run and `DB_CD26_test` is missing. Create it by hand:

```bash
docker exec postgres18 psql -U postgres -c 'CREATE DATABASE "DB_CD26_test";'
```
