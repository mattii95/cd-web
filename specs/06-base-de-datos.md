# SPEC 06 — Base de datos

> **Estado:** Aprobado
> **Depende de:** SPEC 05
> **Fecha:** 2026-11-14
> **Objetivo:** Conectar la app al Postgres de `docker-compose.yaml` con Drizzle ORM, con migraciones versionadas, una base de test aparte, `/api/health` y un job de CI, sin tablas de dominio.

## Por qué existe este spec

SPEC 04 y SPEC 05 dejaron las cuentas, la base de datos y los tests contra Postgres para un spec posterior.
El spec de cuentas va a necesitar tablas de usuarios y sesiones, y su esquema depende del proveedor de auth que se elija.
Por eso este spec deja lista **solo la infraestructura**: conexión, migraciones, seed, variables de entorno, tests y CI.
La primera tabla real llega con el spec de cuentas, que solo tiene que sumar su esquema y generar su migración.

`docker-compose.yaml` ya levanta Postgres 18, pgAdmin y Mailpit, pero tiene dos problemas que este spec corrige:

- El healthcheck usa la contraseña como nombre de base (`pg_isready -U postgres -d 123654on`).
- Las credenciales están escritas en el archivo versionado.

Con `cacheComponents`, una consulta a la base es I/O sin caché.
El código de este spec no consulta la base durante el build: `/api/health` llama a `connection()` antes de consultar, y las páginas no usan la base.

**Referencias:** `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` (`loadEnvConfig` de `@next/env`) y `01-getting-started/15-route-handlers.md` (route handlers con Cache Components).

## Alcance

**Incluye:**

- Dependencias:
  - `drizzle-orm`, `pg`, `zod` y `server-only`.
  - De desarrollo: `drizzle-kit`, `@types/pg`, `@next/env` y `tsx`.
- Variables de entorno:
  - `.env.example` versionado con `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` y un comentario con la URL de test.
  - `.env` (sin versionar) con las variables que lee `docker compose`.
  - `.env.local` (sin versionar) con `DATABASE_URL` de desarrollo.
  - `.env.test.local` (sin versionar) con `DATABASE_URL` apuntando a `DB_CD26_test`.
  - `.gitignore` suma `!.env.example`, `/docker/data` y `/docker/pgadmin`.
- `docker-compose.yaml`:
  - El servicio `postgres` lee `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` de `.env` con `${VAR:?mensaje}`. Si falta una, `docker compose up` falla con el mensaje.
  - Healthcheck corregido: `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}`.
  - Monta `./docker/initdb` en `/docker-entrypoint-initdb.d`.
  - pgAdmin, Mailpit y la red no cambian.
- `docker/initdb/01-test-db.sql`: `CREATE DATABASE "DB_CD26_test";`. Corre solo cuando el volumen está vacío.
- Carpeta `db/` en la raíz:
  - `db/env.ts`: valida `DATABASE_URL` con Zod (URL con protocolo `postgres:` o `postgresql:`). Exporta `getDatabaseUrl()`. La validación corre al llamar la función, no al importar el módulo.
  - `db/client.ts`: `import "server-only"`. Exporta `getDb()`, que crea un único `Pool` de `pg` y la instancia de Drizzle la primera vez que se llama. En desarrollo guarda el pool en `globalThis` para no abrir conexiones nuevas en cada recarga.
  - `db/schema/index.ts`: barrel del esquema, sin tablas. Un comentario explica que cada spec suma su archivo en `db/schema/` y lo reexporta acá.
  - `db/migrations/`: migraciones SQL generadas por `drizzle-kit`, versionadas. Incluye `0000_init.sql`, vacía, y `meta/_journal.json`.
  - `db/health.ts`: exporta `checkDatabase()`, que corre `SELECT 1` y devuelve `{ ok: true }` o `{ ok: false }`. Nunca lanza.
  - `db/seed.ts`: script que se conecta, no inserta nada todavía y cierra el pool. Un comentario indica dónde van los datos de cada spec.
- `drizzle.config.ts` en la raíz: carga el entorno con `loadEnvConfig`, `dialect: "postgresql"`, `schema: "./db/schema"`, `out: "./db/migrations"`, `casing: "snake_case"` y `strict: true`.
- Scripts en `package.json`:
  - `"db:generate": "drizzle-kit generate"`.
  - `"db:migrate": "drizzle-kit migrate"`.
  - `"db:studio": "drizzle-kit studio"`.
  - `"db:seed": "tsx --conditions=react-server db/seed.ts"`.
  - `"test:db": "vitest run --project db"`.
- `app/api/health/route.ts`: `GET` que llama a `await connection()` y después a `checkDatabase()`.
  - Base disponible: `200` con `{ "status": "ok", "db": "up" }`.
  - Base caída o sin `DATABASE_URL`: `503` con `{ "status": "error", "db": "down" }`.
  - Header `Cache-Control: no-store` en los dos casos.
  - No expone mensajes de error ni la URL de conexión.
- Vitest:
  - Alias de `server-only` a `__tests__/stubs/server-only.ts` (módulo vacío) en los proyectos `server` y `db`.
  - Proyecto nuevo `db`: entorno `node`, incluye `__tests__/db/**/*.test.ts`, `globalSetup: "./__tests__/db/global-setup.ts"` y `fileParallelism: false`.
  - `test:run` excluye el proyecto `db` y sigue sin necesitar Docker.
- `__tests__/db/global-setup.ts`: carga el entorno de test con `loadEnvConfig`, se niega a correr si el nombre de la base no termina en `_test`, y aplica las migraciones con el `migrate` de `drizzle-orm/node-postgres/migrator`.
- Tests:
  - `__tests__/server/env.test.ts`: `getDatabaseUrl()` con una URL válida, sin variable, con una URL `http://` y con un texto que no es URL.
  - `__tests__/db/connection.test.ts`: `SELECT 1` devuelve 1 y existe la tabla `drizzle.__drizzle_migrations`.
  - `__tests__/db/health.test.ts`: `checkDatabase()` devuelve `{ ok: true }` con la base de test, y `{ ok: false }` con una URL a un puerto cerrado.
- `.github/workflows/ci.yml` suma el job `db`:
  - Service `postgres:18` con `POSTGRES_DB: DB_CD26_test` y healthcheck con `pg_isready`.
  - `DATABASE_URL` como variable del job, apuntando al service.
  - Pasos: `npm ci`, `npm run db:migrate` y `npm run test:db`.
  - Los jobs `checks` y `e2e` no cambian.
- `README.md` suma una sección "Base de datos": copiar `.env.example`, `docker compose up -d`, los scripts `db:*` y `test:db`, y cómo crear `DB_CD26_test` a mano si el volumen ya existía.

**Fuera de alcance (para specs futuros):**

- Tablas de dominio: usuarios, sesiones, comentarios, reseñas, newsletter o mensajes de contacto.
- Proveedor de auth y su adaptador de Drizzle.
- Pasar los posts del blog y los servicios de `lib/*.ts` a la base.
- Datos en el seed.
- Base de producción, hosting gestionado, pooling externo (PgBouncer) y SSL.
- Backups y restauración.
- Reseteo de tablas entre tests: no hay tablas todavía.
- Tests E2E contra la base: el job `e2e` sigue sin Postgres.
- Cambiar la contraseña de desarrollo que quedó en el historial de git.

## Modelo de datos

Este spec no agrega tablas de dominio.
Solo agrega la forma del cliente, del entorno y del health check:

```ts
// db/env.ts
export function getDatabaseUrl(): string; // lanza un Error con "DATABASE_URL" en el mensaje si falta o es inválida

// db/client.ts
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";
export function getDb(): NodePgDatabase<typeof schema>; // un solo Pool por proceso
export function closeDb(): Promise<void>; // para scripts y tests

// db/health.ts
export type DatabaseHealth = { ok: boolean };
export function checkDatabase(url?: string): Promise<DatabaseHealth>; // url opcional solo para tests
```

```json
// GET /api/health
{ "status": "ok", "db": "up" }      // 200
{ "status": "error", "db": "down" } // 503
```

Variables de entorno:

| Variable            | Dónde                                | Ejemplo                                                    |
| ------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `POSTGRES_USER`     | `.env` (docker compose)              | `postgres`                                                 |
| `POSTGRES_PASSWORD` | `.env` (docker compose)              | `cambiame`                                                 |
| `POSTGRES_DB`       | `.env` (docker compose)              | `DB_CD26`                                                  |
| `DATABASE_URL`      | `.env.local` (dev)                   | `postgres://postgres:cambiame@localhost:5432/DB_CD26`      |
| `DATABASE_URL`      | `.env.test.local` (Vitest `db`) y CI | `postgres://postgres:cambiame@localhost:5432/DB_CD26_test` |

Convenciones:

- Columnas en `snake_case` en la base y `camelCase` en TypeScript, por `casing: "snake_case"`.
- Un archivo por dominio en `db/schema/` (por ejemplo `db/schema/accounts.ts`), reexportado desde `db/schema/index.ts`.
- Las migraciones se generan con `npm run db:generate` y se versionan. No se editan después de mergeadas.
- Solo el código de servidor importa `db/client.ts`. `server-only` hace fallar el build si un Client Component lo importa.
- Los tests que tocan la base van en `__tests__/db/` y solo corren con `npm run test:db`.

## Plan de implementación

1. **Entorno y Docker.** Crear `.env.example` y sumar `!.env.example`, `/docker/data` y `/docker/pgadmin` a `.gitignore`. Cambiar `docker-compose.yaml` para leer las variables de `.env`, corregir el healthcheck y montar `docker/initdb/`. Crear `docker/initdb/01-test-db.sql`. Prueba: con el volumen vacío, `docker compose up -d` deja `postgres18` en `healthy` y existen `DB_CD26` y `DB_CD26_test`.
2. **Validación del entorno.** Instalar `zod`. Crear `db/env.ts` y `__tests__/server/env.test.ts`. Prueba: `npm run test:run` pasa.
3. **Cliente.** Instalar `drizzle-orm`, `pg`, `server-only` y `@types/pg`. Crear `db/schema/index.ts` y `db/client.ts`. Crear `__tests__/stubs/server-only.ts` y sumar el alias a los proyectos `server` y `db` en `vitest.config.mts`. Prueba: `npx tsc --noEmit` pasa.
4. **Migraciones.** Instalar `drizzle-kit` y `@next/env`. Crear `drizzle.config.ts` y los scripts `db:generate`, `db:migrate` y `db:studio`. Generar `0000_init.sql` con `npx drizzle-kit generate --custom --name init`. Prueba: `npm run db:migrate` crea `drizzle.__drizzle_migrations` en `DB_CD26`.
5. **Proyecto `db` de Vitest.** Crear `__tests__/db/global-setup.ts`, sumar el proyecto `db` a `vitest.config.mts`, excluirlo de `test:run` y sumar el script `test:db`. Escribir `__tests__/db/connection.test.ts`. Prueba: `npm run test:db` pasa y `npm run test:run` pasa con Docker apagado.
6. **Health check.** Crear `db/health.ts` y `__tests__/db/health.test.ts`. Crear `app/api/health/route.ts`. Prueba: con Docker levantado `curl -i localhost:3000/api/health` da 200, y con Docker apagado da 503.
7. **Seed.** Instalar `tsx`. Crear `db/seed.ts` y el script `db:seed`. Prueba: `npm run db:seed` termina con código 0 y no deja el proceso colgado.
8. **CI.** Sumar el job `db` a `.github/workflows/ci.yml`.
9. **README.** Sumar la sección "Base de datos".

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado y sin `DATABASE_URL`.
- [ ] El build no prerenderiza `/api/health`: la ruta figura como dinámica en la salida de `next build`.
- [ ] `docker-compose.yaml` no tiene ninguna contraseña ni usuario de Postgres escritos. Los lee de `.env`.
- [ ] Sin `.env`, `docker compose up -d` falla con un mensaje que nombra la variable que falta.
- [ ] Con el volumen vacío, `docker compose up -d` deja `postgres18` en estado `healthy`.
- [ ] Con el volumen vacío, existen las bases `DB_CD26` y `DB_CD26_test` después del primer arranque.
- [ ] `.env.example` está versionado. `.env`, `.env.local` y `.env.test.local` no aparecen en `git status`.
- [ ] `docker/data/` y `docker/pgadmin/` no aparecen en `git status` después de levantar Docker.
- [ ] `getDatabaseUrl()` lanza un error que menciona `DATABASE_URL` si la variable falta, es `http://…` o no es una URL.
- [ ] Importar `db/client.ts` desde un archivo con `"use client"` hace fallar `npm run build`.
- [ ] `npm run db:migrate` aplica `0000_init.sql` y crea la tabla `drizzle.__drizzle_migrations`.
- [ ] Correr `npm run db:migrate` dos veces seguidas no da error.
- [ ] `npm run db:generate` sin cambios en el esquema no crea migraciones nuevas.
- [ ] `npm run db:seed` termina con código 0.
- [ ] `npm run db:studio` abre Drizzle Studio conectado a `DB_CD26`.
- [ ] `npm run test:run` pasa con Docker apagado y no corre el proyecto `db`.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] Con `DATABASE_URL` apuntando a `DB_CD26`, `npm run test:db` falla antes de correr los tests, con un mensaje que pide una base `_test`.
- [ ] `GET /api/health` con la base disponible responde 200 con `{ "status": "ok", "db": "up" }` y `Cache-Control: no-store`.
- [ ] `GET /api/health` con Docker apagado responde 503 con `{ "status": "error", "db": "down" }`, sin la URL ni el mensaje de error en la respuesta.
- [ ] Diez requests seguidos a `/api/health` en `next dev` no aumentan la cantidad de conexiones en `pg_stat_activity` más allá del tamaño del pool.
- [ ] El job `db` del CI corre en un PR a `main` y pasa.
- [ ] Los jobs `checks` y `e2e` siguen pasando sin Postgres.
- [ ] `README.md` explica cómo levantar la base, los scripts `db:*` y `test:db`, y cómo crear `DB_CD26_test` a mano.

## Decisiones

- **Sí:** Drizzle ORM. Esquema en TypeScript, migraciones SQL legibles, sin paso de generate del cliente. Elegido por el usuario.
- **No:** Prisma. Suma un cliente generado y un paso extra en cada cambio de esquema.
- **No:** Kysely o SQL crudo. Más trabajo para migraciones y tipos.
- **Sí:** `node-postgres` (`pg`) como driver. Es el más probado y anda con cualquier Postgres.
- **No:** `postgres.js` ni Neon serverless. El segundo ata el proyecto a un proveedor de deploy.
- **Sí:** `drizzle-kit generate` + `migrate`, con migraciones versionadas. Desarrollo, test, CI y producción aplican el mismo SQL.
- **No:** `drizzle-kit push`. Desarrollo y producción podrían divergir sin que nadie lo note.
- **Sí:** solo infraestructura, sin tablas de dominio. El esquema de cuentas depende del proveedor de auth, que todavía no se eligió.
- **No:** crear `users` y `sessions` ahora. El adaptador del proveedor podría exigir otro esquema.
- **No:** una tabla descartable para probar. Se prueba con `SELECT 1` y la tabla de migraciones de Drizzle.
- **Sí:** una migración `0000_init.sql` vacía. Crea `meta/_journal.json`, así `db:migrate` y el `globalSetup` tienen qué aplicar desde el primer día.
- **Sí:** los posts y los servicios siguen en `lib/*.ts`. Se prerenderizan sin base y nada visible cambia.
- **Sí:** carpeta `db/` en la raíz. Separa el código con I/O de `lib/`, que hoy son contenido y funciones puras.
- **No:** `lib/db/`.
- **Sí:** credenciales en `.env` y `.env.local`, con `.env.example` versionado. El compose deja de tener contraseñas escritas.
- **Sí:** `${VAR:?mensaje}` en el compose. Falla rápido y claro si falta `.env`, en vez de arrancar con valores por defecto.
- **Sí:** `.env.test.local` para la base de test. `loadEnvConfig` con `NODE_ENV=test` lee `.env.test.local` y no lee `.env.local`, así los tests nunca toman la URL de desarrollo.
- **Sí:** base `DB_CD26_test` aparte, creada por `docker/initdb/`. Los tests no tocan los datos de desarrollo.
- **No:** crear la base desde el `globalSetup`. Mezcla administración con tests.
- **Sí:** el `globalSetup` se niega a correr si la base no termina en `_test`. Evita migrar o, más adelante, vaciar la base de desarrollo por error.
- **Sí:** proyecto `db` de Vitest aparte, con `test:db`. `test:run` y el job `checks` siguen sin necesitar Docker.
- **No:** tests de base dentro del proyecto `server`. Obligaría a tener Postgres levantado para cualquier test.
- **Sí:** `fileParallelism: false` en el proyecto `db`. Los tests que lleguen con tablas no van a pisarse los datos.
- **Sí:** job `db` en CI con un service `postgres:18`. Detecta migraciones rotas en cada PR.
- **Sí:** Zod para validar el entorno. Da un error claro y se reutiliza después en formularios y server actions.
- **Sí:** validación al llamar `getDatabaseUrl()`, no al importar. El build y los jobs sin base no fallan por importar un módulo.
- **Sí:** `server-only` en `db/client.ts`. Un Client Component que lo importe rompe el build en vez de filtrar la conexión al navegador.
- **Sí:** alias de `server-only` a un módulo vacío en Vitest. Es la mitigación prevista en SPEC 05.
- **Sí:** pool en `globalThis` en desarrollo. Las recargas de Turbopack no abren un pool nuevo cada vez.
- **Sí:** `/api/health` con `connection()` antes de la consulta. Con `cacheComponents`, sin eso el build intentaría prerenderizar la ruta y consultar la base.
- **Sí:** la lógica del health en `db/health.ts` y el route handler fino. Se prueba en Vitest sin depender de `next/server`.
- **Sí:** el health no expone errores ni la URL. Es una ruta pública.
- **Sí:** `db/seed.ts` vacío con `tsx --conditions=react-server`. `tsx` resuelve `@/` y la condición `react-server` hace que `server-only` no lance fuera de Next.
- **No:** correr el seed con Node directo. Node no resuelve el alias `@/` de `tsconfig.json`.
- **Sí:** `@next/env` en `drizzle.config.ts`, el seed y el `globalSetup`. Carga los `.env*` igual que Next.
- **Sí:** `casing: "snake_case"`. Columnas en `snake_case` en la base sin escribir el nombre a mano en cada columna.

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docker/initdb/` no corre si el volumen `docker/data` ya existe, y `DB_CD26_test` no se crea. | El README documenta el `CREATE DATABASE "DB_CD26_test";` manual. El `globalSetup` falla con un mensaje que lo indica.              |
| La contraseña de desarrollo quedó en el historial de git.                                     | Es una base local sin datos reales. `.env.example` usa otra contraseña de ejemplo. Rotarla en otros entornos queda fuera del spec. |
| `connection()` no alcanza y el build intenta prerenderizar `/api/health`.                     | El criterio "la ruta figura como dinámica" lo verifica. Si falla, se revisa la guía de route handlers con Cache Components.        |
| `drizzle-kit migrate` con una carpeta de migraciones vacía o sin journal falla.               | Se genera `0000_init.sql` con `--custom` en el paso 4.                                                                             |
| `server-only` lanza al importarse fuera de Next (Vitest, `tsx`, `drizzle-kit`).               | Alias en Vitest, `--conditions=react-server` en `tsx`. `drizzle.config.ts` solo importa el esquema, que no usa `server-only`.      |
| El pool de `pg` deja el proceso del seed o de Vitest colgado al terminar.                     | `closeDb()` se llama al final del seed y en el `teardown` del `globalSetup`.                                                       |
| Un nombre de base con mayúsculas (`DB_CD26`) necesita comillas en SQL.                        | `01-test-db.sql` usa `"DB_CD26_test"` entre comillas. Las URLs de conexión no las necesitan.                                       |
| El puerto 5432 está ocupado por otro Postgres local.                                          | Fuera del spec. Se puede cambiar el puerto del host en el compose y en `DATABASE_URL`.                                             |

## Qué **no** incluye este spec

- Tablas de dominio y proveedor de auth.
- Posts y servicios en la base.
- Datos en el seed.
- Base de producción, pooling externo, SSL y backups.
- Tests E2E contra la base.
- Rotar la contraseña que quedó en el historial.

Cada uno de estos, si llega, va en su propio spec.
