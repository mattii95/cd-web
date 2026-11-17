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
- `npm run test:e2e` — Playwright against `next build` + `next start` on port 3100 (`desktop` and `mobile` projects). Needs Postgres and Mailpit up (`docker compose up -d`) and `.env.test.local` (see Authentication)

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
- `npm run db:seed` — loads the blog (categories, 8 posts, ratings, comments) from the mock data in `lib/blog-posts.ts`. Idempotent; refuses to run with `NODE_ENV=production`. See "Blog seed" below.
- `npm run test:db` — runs the `db` Vitest project against the `_test` database. It refuses to run if the database name does not end in `_test`.

`GET /api/health` returns `200 {"status":"ok","db":"up"}` or `503 {"status":"error","db":"down"}`.

If the `docker/data` volume already existed, `docker/initdb/` did not run and `DB_CD26_test` is missing. Create it by hand:

```bash
docker exec postgres18 psql -U postgres -c 'CREATE DATABASE "DB_CD26_test";'
```

### Blog seed

The seed needs an existing user as the author of the 8 posts. Set `SEED_AUTHOR_EMAIL` in `.env.local` (see `.env.example`), then, in this order:

1. Register that user in the app.
2. `npm run auth:make-admin -- autor@ejemplo.com` (the seed does not change roles).
3. `npm run db:seed`.

Without `SEED_AUTHOR_EMAIL`, or if that user does not exist, the seed exits with code 1.

It also creates 24 demo users (`@demo.invalid`) for the ratings and comments. They have no `account` row, so they cannot sign in.

Post tags (`tag`, `post_tag`) are also loaded only by this seed, from `blogTags` and each post's `tags` in `lib/blog-posts.ts`. Until the post editor exists there is no screen to assign them.

## Blog images

Admins upload images at `/admin/medios`. Each upload is re-encoded to WebP (1920 px wide at most, no EXIF or GPS data) with `sharp`, and the file is saved to `MEDIA_DIR` as `<id>.webp`. The database keeps one row per image in `media`. Posts store the image `id`, and `/media/<id>` serves the file.

- `MEDIA_DIR`: folder for the files. Default `storage/media` (relative to the repo root, ignored by git). Use `test-results/media` in `.env.test.local` and in CI.
- **The folder must be persistent.** Mount it as a volume in production. Back it up together with the database: a row without its file answers 404 and logs `console.error`.
- **Serverless hosting does not work** with this storage, because the disk is lost on every deploy. Moving to another store only means replacing `lib/media/storage.ts`.
- Limits: JPEG, PNG, WebP or AVIF, up to 10 MB and 40 megapixels. The same image uploaded twice is stored once.
- An image used as a cover or inside a post cannot be deleted.

## Authentication

Accounts use Better Auth on top of Drizzle (`lib/auth/`), with email and password, email verification and password recovery. Roles are `lector` (default) and `admin`.

Add these variables to `.env.local` (see `.env.example`):

- `BETTER_AUTH_SECRET` — 32 characters or more. Generate one with `openssl rand -base64 32`.
- `BETTER_AUTH_URL` — `http://localhost:3000` in development.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — in development they point to Mailpit (`localhost`, `1025`, no user or password).

`.env.test.local` needs `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. The E2E run overrides the URL with port 3100.

Emails sent in development show up in Mailpit at http://localhost:8025. Open the link from there to verify an account or reset a password.

The first admin has to be promoted by hand. Register and verify the account, then run:

```bash
npm run auth:make-admin -- usuario@email.com
```

It exits with code 1 if the user does not exist. `/cuenta/perfil` and `/admin` need a session; `/admin` returns the 404 page for a `lector`.

### Sign in with Google, GitHub and Microsoft

Login and sign-up show a button for each provider that has credentials. With none set, no button shows. Providers are read on every request, so changing these variables only needs a server restart, not a new `npm run build`.

Set both variables of a provider in `.env.local`, or neither. With only one of the two, `/api/auth` fails and the error names the missing variable.

| Provider  | Variables                                       | Where to create the app                                                                          |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Google    | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`      | https://console.cloud.google.com → APIs & Services → Credentials → OAuth client ID (Web application) |
| GitHub    | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`      | https://github.com/settings/developers → OAuth Apps → New OAuth App                              |
| Microsoft | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | https://entra.microsoft.com → App registrations → New registration                               |

The callback URL of each app is `{BETTER_AUTH_URL}/api/auth/callback/{google|github|microsoft}`. In development, for example, `http://localhost:3000/api/auth/callback/github`.

- **Google:** while the consent screen is in Testing mode, only the test users you add can sign in. The basic scopes (`openid`, `email`, `profile`) need no verification to publish.
- **GitHub:** an app takes one callback URL. Create a separate app for production.
- **Microsoft:** choose "Accounts in any organizational directory and personal Microsoft accounts", because the app uses the `common` tenant. Copy the secret's **Value**, not its ID. Secrets expire (24 months at most).

An account with the same email is linked automatically for Google and GitHub. If the existing account has an unverified email, its password is deleted before linking, so nobody can take an account by registering someone else's email. Microsoft links only when Microsoft reports the email as verified.

`.env.test.local` and the CI `e2e` job use fake values (`test-google-id`, `test-google-secret`, and so on). The E2E tests only follow the redirect to the provider's `authorize` URL, and abort the request before it leaves the machine. The complete sign-in is tested by hand:

1. With real credentials, sign in with GitHub and a new email. It creates a `lector` user with a verified email and takes you to `/cuenta/perfil`.
2. Sign in with Google using the email of a verified account with a password. It links the account and the password keeps working.
3. Register with a password and do not verify the email. Then sign in with Google using that email. The password stops working.
4. Cancel on the provider's screen. It returns to `/cuenta/login` with an error message.
5. As an OAuth-only user, use "Recuperar" to set a password, then sign in with it.
