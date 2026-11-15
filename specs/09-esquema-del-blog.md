# SPEC 09 — Esquema del blog en la base de datos

> **Estado:** Aprobado
> **Depende de:** SPEC 03, SPEC 06, SPEC 07
> **Fecha:** 2026-11-15
> **Objetivo:** Crear en Postgres las tablas de categorías, posts, perfiles de autor, comentarios, valoraciones y votos "Útil" del blog, con su migración, un seed con los datos mock de SPEC 03 y funciones de lectura probadas, sin cambiar las páginas.

## Por qué existe este spec

SPEC 03 maquetó el blog con datos mock en `lib/blog-posts.ts`, incluidas valoraciones, comentarios, "Útil" y la respuesta del autor.
SPEC 06 dejó Drizzle y las migraciones, y SPEC 07 dejó la tabla `user` con los roles `lector` y `admin`.
Este spec crea **solo la estructura de datos**: tablas, migración, seed y funciones de lectura.
Las páginas siguen leyendo `lib/blog-posts.ts` y nada visible cambia.
Pasar `/blog`, `/blog/[slug]` y la home a la base va en un spec posterior, que solo tiene que llamar a las funciones de `db/blog.ts`.

Tres decisiones marcan el modelo:

- El cuerpo del artículo se guarda como `jsonb` con la misma forma `BlogBlock[]` de SPEC 03. Las plantillas no cambian.
- La valoración y el comentario son tablas separadas. Un usuario puntúa una vez por post y puede comentar varias veces. Las estrellas de un comentario salen de la valoración del mismo usuario en ese post.
- Los comentarios nacen `pendiente` y solo los `aprobado` son públicos.

**Referencias:** `node_modules/next/dist/docs/01-app/` no aplica: este spec no toca rutas. La documentación de Drizzle: `pgTable`, `pgEnum`, `jsonb().$type<>()`, `check`, `primaryKey`, `references({ onDelete })` y `onConflictDoUpdate`.

## Alcance

**Incluye:**

- `db/schema/blog.ts`, reexportado desde `db/schema/index.ts`, con:
  - Enums `post_status` (`borrador` | `publicado`) y `comment_status` (`pendiente` | `aprobado` | `oculto`).
  - Tablas `category`, `author_profile`, `post`, `post_rating`, `comment` y `comment_vote` (detalle en el modelo de datos).
- Migración `db/migrations/0002_blog.sql`, generada con `npm run db:generate -- --name blog`.
- `db/blog-body.ts`: esquema Zod `blogBodySchema` para `BlogBlock[]`. Sin `server-only`, para probarlo en el proyecto `server`.
- `db/blog.ts` (`import "server-only"`): funciones de lectura pública.
  - `getCategories()`.
  - `getPublishedPosts()`.
  - `getPublishedPostBySlug(slug)`.
  - `getRatingSummary(postId)`.
  - `getApprovedComments(postId)`.
  - Solo devuelven posts `publicado` y comentarios `aprobado`.
  - Validan `body` con `blogBodySchema` al leer. Un `body` inválido lanza un error que nombra el slug.
  - No devuelven emails ni datos de cuenta de quien comenta: solo nombre e imagen.
- Seed del blog en `db/seed/blog.ts`, exportando `seedBlog(db, { authorEmail })`, llamado desde `db/seed.ts`:
  - Toma categorías, autor y posts de `lib/blog-posts.ts`, sin duplicar los textos.
  - Usa el usuario existente con el email de `SEED_AUTHOR_EMAIL` como autor de los 8 posts, y le crea o actualiza su `author_profile` con el cargo y la bio de `blogAuthor`.
  - Crea 24 usuarios demo `lector` con email `@demo.invalid` y sin fila `account`.
  - Carga en `senales-sistema-a-medida` las 24 valoraciones, los 4 comentarios `aprobado` con sus respuestas, y los votos "Útil" de SPEC 03.
  - Los 8 posts quedan `publicado` con el `publishedAt` de SPEC 03.
  - Es idempotente: correrlo dos veces deja las mismas filas.
  - Se niega a correr con `NODE_ENV=production`.
  - Sin `SEED_AUTHOR_EMAIL`, o si ese usuario no existe, termina con código 1 y un mensaje que nombra la variable o el email.
- `.env.example` suma `SEED_AUTHOR_EMAIL` con un comentario: el usuario tiene que estar registrado antes de correr el seed.
- Tests:
  - Vitest `server`: `__tests__/server/blog-body.test.ts`. `blogBodySchema` acepta los cuerpos de los 8 posts mock y rechaza un bloque con `type` desconocido, un `h2` sin `id` y un objeto que no es array.
  - Vitest `db`: `__tests__/db/blog-schema.test.ts`, `__tests__/db/blog-queries.test.ts` y `__tests__/db/blog-seed.test.ts` (casos en los criterios de aceptación).
  - Helper `__tests__/db/blog-helpers.ts` con `resetBlog()`, que borra las filas de las seis tablas del blog y los usuarios `@demo.invalid`. Los tres archivos lo llaman en `beforeEach` y `afterEach`.
- `README.md`: en la sección "Base de datos", `SEED_AUTHOR_EMAIL`, el orden registrarse → `auth:make-admin` → `db:seed`, y que los usuarios demo no pueden iniciar sesión.

**Fuera de alcance (para specs futuros):**

- Pasar `/blog`, `/blog/[slug]` y la home a leer de la base, con su caché (`"use cache"`) y `generateStaticParams`.
- Borrar `lib/blog-posts.ts` o sus datos mock.
- Escrituras desde la app: publicar comentarios, puntuar, votar "Útil", responder como autor.
- UI de administración: crear y editar posts y categorías, moderar comentarios.
- Notificaciones de comentarios nuevos y antispam.
- Hilos de respuestas entre lectores.
- Varias categorías por post y etiquetas.
- Búsqueda de texto completo, paginación y contador de lecturas.
- Imágenes de portada.
- Anonimizar comentarios de un usuario borrado.
- Seed en producción.

## Modelo de datos

```ts
// db/schema/blog.ts — columnas en camelCase, snake_case en la base (casing de SPEC 06)
export const postStatus = pgEnum("post_status", ["borrador", "publicado"]);
export const commentStatus = pgEnum("comment_status", [
  "pendiente",
  "aprobado",
  "oculto",
]);

export const category = pgTable("category", {
  id: text().primaryKey(), // crypto.randomUUID() con $defaultFn
  slug: text().notNull().unique(), // BlogCategoryTag: "desarrollo-web", "sistemas", "saas", "ia"
  label: text().notNull(), // "Inteligencia artificial" (badge)
  filterLabel: text().notNull(), // "IA" (botón de filtro)
  serviceSlug: text().notNull(), // ServiceSlug del CTA
  position: integer().notNull(), // orden de los filtros
  createdAt,
  updatedAt,
});

export const authorProfile = pgTable("author_profile", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  jobTitle: text().notNull(), // "Fundador de Courroux Digital"
  bio: text().notNull(),
  createdAt,
  updatedAt,
});

export const post = pgTable("post", {
  id: text().primaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  excerpt: text().notNull(),
  body: jsonb().$type<BlogBlock[]>().notNull(),
  cta: text().notNull(),
  readingMinutes: integer().notNull(), // check > 0
  categoryId: text()
    .notNull()
    .references(() => category.id, { onDelete: "restrict" }),
  authorId: text()
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  status: postStatus().notNull().default("borrador"),
  publishedAt: timestamp(), // check: status = 'publicado' → published_at no nulo
  createdAt,
  updatedAt,
}); // índices: (status, published_at), (category_id), (author_id)

export const postRating = pgTable("post_rating", {
  postId: text()
    .notNull()
    .references(() => post.id, { onDelete: "cascade" }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  rating: smallint().notNull(), // check between 1 and 5
  createdAt,
  updatedAt,
}); // PK (post_id, user_id)

export const comment = pgTable("comment", {
  id: text().primaryKey(),
  postId: text()
    .notNull()
    .references(() => post.id, { onDelete: "cascade" }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  text: text().notNull(), // check: length(trim(text)) > 0
  status: commentStatus().notNull().default("pendiente"),
  replyText: text(), // respuesta del autor del post
  repliedAt: timestamp(), // check: los dos nulos o los dos no nulos
  createdAt,
  updatedAt,
}); // índices: (post_id, status, created_at), (user_id)

export const commentVote = pgTable("comment_vote", {
  commentId: text()
    .notNull()
    .references(() => comment.id, { onDelete: "cascade" }),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt,
}); // PK (comment_id, user_id)
```

```ts
// db/blog-body.ts
export const blogBodySchema: z.ZodType<BlogBlock[]>; // BlogBlock es el tipo de lib/blog-posts.ts

// db/blog.ts (server-only)
export type BlogCategoryRow = {
  slug: BlogCategoryTag;
  label: string;
  filterLabel: string;
  serviceSlug: ServiceSlug;
};
export type PostAuthor = {
  name: string;
  image: string | null;
  jobTitle: string | null;
  bio: string | null;
};
export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  publishedAt: Date;
  category: BlogCategoryRow;
  author: PostAuthor;
};
export type PostDetail = PostSummary & { body: BlogBlock[]; cta: string };
export type RatingSummary = {
  average: number; // 0 si no hay valoraciones; sin redondear
  total: number;
  distribution: Record<BlogRating, number>;
};
export type PublicComment = {
  id: string;
  authorName: string;
  authorImage: string | null;
  rating: BlogRating | null; // de post_rating del mismo usuario y post
  text: string;
  usefulCount: number; // count de comment_vote
  createdAt: Date;
  reply: { text: string; repliedAt: Date } | null;
};

export function getCategories(): Promise<BlogCategoryRow[]>; // por position
export function getPublishedPosts(): Promise<PostSummary[]>; // publishedAt descendente
export function getPublishedPostBySlug(
  slug: string,
): Promise<PostDetail | null>;
export function getRatingSummary(postId: string): Promise<RatingSummary>;
export function getApprovedComments(postId: string): Promise<PublicComment[]>; // createdAt descendente

// db/seed/blog.ts
export function seedBlog(
  db: NodePgDatabase<typeof schema>,
  opts: { authorEmail: string },
): Promise<void>;
```

Comportamiento al borrar:

| Se borra      | Efecto                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Un usuario    | Borra su `author_profile`, sus valoraciones, comentarios y votos. Falla si es autor de un post. |
| Un post       | Borra sus valoraciones, comentarios y los votos de esos comentarios.                            |
| Un comentario | Borra sus votos.                                                                                |
| Una categoría | Falla si tiene posts.                                                                           |

Datos del seed en `senales-sistema-a-medida`:

| Usuario demo          | Email                                               | Valoración | Comentario | Fecha del comentario | "Útil" | Respuesta del autor |
| --------------------- | --------------------------------------------------- | ---------- | ---------- | -------------------- | ------ | ------------------- |
| Lucía Fernández       | `lucia@demo.invalid`                                | 5          | sí         | 2026-11-14           | 12     | 2026-11-14          |
| Martín Gómez          | `martin@demo.invalid`                               | 4          | sí         | 2026-11-13           | 5      | —                   |
| Carla Ruiz            | `carla@demo.invalid`                                | 5          | sí         | 2026-11-12           | 8      | —                   |
| Diego Sosa            | `diego@demo.invalid`                                | 3          | sí         | 2026-11-11           | 2      | 2026-11-11          |
| Lector 05 … Lector 20 | `lector-05@demo.invalid` … `lector-20@demo.invalid` | 5          | no         | —                    | —      | —                   |
| Lector 21 … Lector 23 | `lector-21@demo.invalid` … `lector-23@demo.invalid` | 4          | no         | —                    | —      | —                   |
| Lector 24             | `lector-24@demo.invalid`                            | 2          | no         | —                    | —      | —                   |

Resultado: distribución 5★ 18, 4★ 4, 3★ 1, 2★ 1, 1★ 0, total 24, promedio 4,58 (se muestra "4,6").
Los votos "Útil" de cada comentario los dan los primeros N lectores `lector-05`… en orden, nunca quien escribió el comentario.
Los textos de los comentarios y respuestas son los de `lib/blog-posts.ts`. Las fechas son fijas: los textos "Hace 2 días" del mock no se guardan.

Variables de entorno nuevas:

| Variable            | Dónde                       | Ejemplo             |
| ------------------- | --------------------------- | ------------------- |
| `SEED_AUTHOR_EMAIL` | `.env.local` (solo el seed) | `autor@ejemplo.com` |

Convenciones:

- Ids `text` con `crypto.randomUUID()` por `$defaultFn`, como las tablas de Better Auth. Las tablas puente usan PK compuesta.
- Tablas en singular, como las de SPEC 07.
- Las claves naturales del seed son `category.slug`, `post.slug` y `user.email`. Las filas puente se insertan con `onConflictDoNothing`.
- `serviceSlug` se guarda como `text` y se tipa como `ServiceSlug` al leer. No es FK porque los servicios viven en `lib/services.ts`.
- `updatedAt` se actualiza con `$onUpdate(() => new Date())`.
- Solo `db/blog.ts` y el seed consultan estas tablas. Ningún Client Component importa `db/blog.ts` (`server-only`).

## Plan de implementación

1. **Esquema del cuerpo.** Crear `db/blog-body.ts` y `__tests__/server/blog-body.test.ts`. Prueba: `npm run test:run` pasa.
2. **Tablas y migración.** Crear `db/schema/blog.ts` con enums, tablas, índices y checks, reexportarlo en `db/schema/index.ts` y generar `0002_blog.sql` con `npm run db:generate -- --name blog`. Prueba: `npm run db:migrate` crea las seis tablas y los dos enums en `DB_CD26`, y un segundo `db:generate` no crea migraciones.
3. **Tests del esquema.** Crear `__tests__/db/blog-helpers.ts` y `__tests__/db/blog-schema.test.ts`. Prueba: `npm run test:db` pasa, incluidos los tests de auth existentes.
4. **Funciones de lectura.** Crear `db/blog.ts` y `__tests__/db/blog-queries.test.ts`, con datos insertados en cada test. Prueba: `npm run test:db` pasa.
5. **Seed.** Crear `db/seed/blog.ts`, llamarlo desde `db/seed.ts`, sumar `SEED_AUTHOR_EMAIL` a `.env.example` y escribir `__tests__/db/blog-seed.test.ts`. Prueba: con un usuario registrado, `npm run db:seed` carga los 8 posts en `DB_CD26`, y correrlo de nuevo no cambia la cantidad de filas.
6. **README.** Documentar `SEED_AUTHOR_EMAIL`, el orden de los pasos y los usuarios demo.

## Criterios de aceptación

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado y sin `DATABASE_URL`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado, incluidos los tests de auth de SPEC 07 y 08.
- [ ] Los jobs `checks`, `db` y `e2e` del CI pasan en un PR a `main`.
- [ ] `npm run db:migrate` crea `category`, `author_profile`, `post`, `post_rating`, `comment`, `comment_vote` y los enums `post_status` y `comment_status`.
- [ ] Después de la migración, `npm run db:generate` no crea migraciones nuevas.
- [ ] `/blog`, `/blog/[slug]` y la home se ven igual que antes y siguen leyendo `lib/blog-posts.ts`.
- [ ] `blogBodySchema` acepta el `body` de los 8 posts de `lib/blog-posts.ts` y rechaza un bloque `{ type: "video" }`, un `h2` sin `id` y un objeto que no es array.
- [ ] Insertar una segunda valoración del mismo usuario en el mismo post falla por la PK.
- [ ] Insertar una valoración 0 o 6 falla por el check.
- [ ] Insertar un post `publicado` con `published_at` nulo falla por el check.
- [ ] Insertar un comentario con `reply_text` y sin `replied_at` falla por el check.
- [ ] Un comentario nuevo sin `status` queda `pendiente`.
- [ ] Un mismo usuario puede guardar dos comentarios en el mismo post.
- [ ] Votar "Útil" dos veces con el mismo usuario en el mismo comentario falla por la PK.
- [ ] Borrar un lector borra sus valoraciones, comentarios y votos.
- [ ] Borrar un post borra sus valoraciones, comentarios y los votos de esos comentarios.
- [ ] Borrar el usuario autor de un post falla. Borrar una categoría con posts falla.
- [ ] `getPublishedPosts()` no devuelve posts `borrador` y los ordena por `publishedAt` descendente.
- [ ] `getPublishedPostBySlug` devuelve `null` para un slug que no existe y para un post `borrador`.
- [ ] `getPublishedPostBySlug` lanza un error que nombra el slug si el `body` guardado no cumple `blogBodySchema`.
- [ ] `getApprovedComments` no devuelve comentarios `pendiente` ni `oculto`.
- [ ] `getApprovedComments` devuelve `rating` con la valoración del mismo usuario, y `null` si ese usuario no puntuó.
- [ ] Ningún resultado de `db/blog.ts` incluye el email de quien comenta.
- [ ] `getRatingSummary` de un post sin valoraciones devuelve `{ average: 0, total: 0 }` y la distribución en ceros.
- [ ] Después de `seedBlog`, `getCategories()` devuelve las 4 categorías en el orden web, sistemas, saas, ia.
- [ ] Después de `seedBlog`, `getPublishedPosts()` devuelve los 8 posts en el orden de `blogPosts`, con el autor del email dado y su cargo "Fundador de Courroux Digital".
- [ ] Después de `seedBlog`, `getRatingSummary` de `senales-sistema-a-medida` da total 24, distribución 18, 4, 1, 1, 0 y un promedio que redondeado a una decimal es 4,6.
- [ ] Después de `seedBlog`, `getApprovedComments` de `senales-sistema-a-medida` devuelve Lucía, Martín, Carla y Diego, en ese orden, con "Útil" 12, 5, 8 y 2, y respuesta del autor solo en Lucía y Diego.
- [ ] Correr `seedBlog` dos veces deja la misma cantidad de filas en las seis tablas y en `user`.
- [ ] `seedBlog` con un email que no existe lanza un error que menciona ese email.
- [ ] `npm run db:seed` sin `SEED_AUTHOR_EMAIL` termina con código 1 y un mensaje que menciona `SEED_AUTHOR_EMAIL`.
- [ ] `NODE_ENV=production npm run db:seed` termina con código 1 sin insertar nada.
- [ ] Ningún usuario `@demo.invalid` tiene fila en `account`.
- [ ] `README.md` explica `SEED_AUTHOR_EMAIL`, el orden registrarse → `auth:make-admin` → `db:seed` y que los usuarios demo no pueden entrar.

## Decisiones

- **Sí:** solo esquema, seed y funciones de lectura. Separa la estructura de datos del cambio de las páginas, que trae caché y prerender. Elegido por el usuario.
- **No:** conectar las páginas en este spec. Con `cacheComponents` exige decidir `"use cache"`, invalidación y build sin base; va en su propio spec.
- **Sí:** `body` como `jsonb` con `BlogBlock[]`, validado con Zod al leer. Las plantillas de SPEC 03 reciben la misma forma. Elegido por el usuario.
- **No:** markdown ni una tabla `post_block`. El primero necesita un parser y SPEC 03 ya lo descartó; la segunda suma joins que nadie usa.
- **Sí:** una categoría por post con FK. Es el modelo de SPEC 03: badge, filtro y CTA salen de una sola categoría. Elegido por el usuario.
- **No:** varias categorías por post. Obliga a elegir una principal para el badge y el CTA.
- **Sí:** autor como FK a `user` y cargo y bio en `author_profile`. `user` no tiene esos campos y no conviene ensanchar la tabla de Better Auth. Elegido por el usuario.
- **Sí:** valoraciones y comentarios en tablas separadas. Se puede puntuar sin comentar y comentar más de una vez. Elegido por el usuario.
- **No:** valoración dentro del comentario.
- **Sí:** las estrellas de un comentario salen de `post_rating` del mismo usuario y post. Mantiene el diseño sin duplicar el dato. Elegido por el usuario.
- **Sí:** respuesta solo del autor, un nivel, en columnas de `comment`. Es lo que muestra el diseño. Elegido por el usuario.
- **No:** hilos con `parent_id`. Abre preguntas de profundidad y moderación que el diseño no tiene.
- **Sí:** `comment.status` con `pendiente` por defecto. Nada se publica sin aprobación. Elegido por el usuario.
- **Sí:** tabla `comment_vote` con PK compuesta y contador por `count`. Un voto por usuario, sin contador que se desincronice. Elegido por el usuario.
- **No:** columna `useful_count` en `comment`. Se desincroniza con los votos.
- **Sí:** `post.status` (`borrador` | `publicado`) con check sobre `published_at`. Permite guardar borradores. Elegido por el usuario.
- **Sí:** cascade en valoraciones, comentarios y votos, y `restrict` en autor y categoría. Borrar una cuenta borra lo que escribió; un post nunca queda sin autor ni categoría. Elegido por el usuario.
- **No:** anonimizar comentarios al borrar un usuario.
- **Sí:** el seed usa un usuario existente por `SEED_AUTHOR_EMAIL`. No hay credenciales en el repo. Elegido por el usuario.
- **No:** que el seed cree el usuario autor. El autor real terminaría siendo otro usuario.
- **Sí:** 24 usuarios demo `@demo.invalid` sin `account`. Reproducen la distribución de SPEC 03, nadie entra con ellos y `.invalid` nunca recibe email. Elegido por el usuario.
- **Sí:** el seed se niega a correr en producción. Los usuarios demo no deben llegar a una base real. Elegido por el usuario.
- **Sí:** seed idempotente con upsert por clave natural. Se puede correr en cada `docker compose up` sin duplicar. Elegido por el usuario.
- **No:** vaciar y recargar las tablas. Pierde datos cargados a mano.
- **Sí:** el seed toma los textos de `lib/blog-posts.ts`. Una sola fuente hasta que el spec de las páginas la reemplace.
- **Sí:** fechas fijas para los comentarios, posteriores al 2026-11-10 y en el orden del mock. "Hace 1 semana" quedaba antes de la publicación del post.
- **Sí:** ids `text` con `crypto.randomUUID()` y tablas en singular. Siguen la convención de las tablas de Better Auth.
- **Sí:** `serviceSlug` como `text`, sin FK. Los servicios viven en código, no en la base.
- **Sí:** las funciones públicas no devuelven emails. Son datos que van a terminar en páginas públicas.
- **Sí:** `db/blog.ts` junto a `db/health.ts`, y `db/blog-body.ts` sin `server-only`. El esquema Zod se prueba sin Postgres.

## Riesgos

| Riesgo                                                                                                  | Mitigación                                                                                                                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Los tests de auth borran `user` en `beforeEach` y fallan si quedó un post con `author_id` (`restrict`). | Los tests del blog llaman a `resetBlog()` en `beforeEach` y `afterEach`. `fileParallelism: false` evita que se crucen.                   |
| Un `body` mal formado entra a la base por un insert manual o Drizzle Studio.                            | `getPublishedPostBySlug` valida al leer y lanza con el slug. El seed también valida antes de insertar.                                   |
| `BlogBlock` cambia en `lib/blog-posts.ts` y `blogBodySchema` queda desalineado.                         | `blogBodySchema` se tipa como `z.ZodType<BlogBlock[]>`: un cambio en el tipo rompe `tsc`.                                                |
| El promedio 4,58 se muestra como "4,5" si se trunca en vez de redondear.                                | `average` se devuelve sin redondear y el criterio de aceptación verifica 4,6 redondeado. El formato es del spec que conecte las páginas. |
| `SEED_AUTHOR_EMAIL` apunta a un usuario `lector` y queda como autor visible.                            | El README pide correr `auth:make-admin` antes. El seed no cambia roles.                                                                  |
| Un usuario real se registra con un email `@demo.invalid` y el seed lo pisa.                             | `.invalid` es un dominio reservado y no puede verificar su email. El seed solo corre fuera de producción.                                |
| Drizzle no genera los `check` o la PK compuesta como se espera.                                         | El paso 2 revisa `0002_blog.sql` antes de migrar, y los tests de esquema prueban cada restricción contra la base.                        |

## Qué **no** incluye este spec

- Páginas del blog leyendo de la base.
- Borrar `lib/blog-posts.ts`.
- Publicar comentarios, puntuar, votar o responder desde la app.
- Administración de posts y moderación de comentarios.
- Notificaciones y antispam.
- Hilos entre lectores.
- Varias categorías, etiquetas, búsqueda, paginación e imágenes de portada.
- Anonimizar comentarios.
- Seed en producción.

Cada uno de estos, si llega, va en su propio spec.
