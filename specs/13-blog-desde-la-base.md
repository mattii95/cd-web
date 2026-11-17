# SPEC 13 — Blog desde la base

> **Estado:** Implementado
> **Depende de:** SPEC 03, SPEC 09, SPEC 10, SPEC 11, SPEC 12
> **Fecha:** 2026-11-16
> **Objetivo:** Que `/blog`, `/blog/[slug]` y la vista previa de la home lean de la base con lecturas cacheadas, y que la app deje de importar los datos mock de `lib/blog-posts.ts`.

## Por qué existe este spec

SPEC 09 a 12 dejaron en `db/blog.ts` el esquema, el seed y las funciones de lectura paginadas.
Las páginas siguen leyendo `lib/blog-posts.ts`, y el seed copia ese mismo mock a la base: hoy hay dos fuentes con los mismos datos.
Este spec hace que la base sea la única fuente de las páginas públicas.

Cuatro decisiones marcan el diseño:

- Las lecturas públicas usan `"use cache"` con `cacheLife("hours")` y `cacheTag`. Cada lectura va dentro de `<Suspense>`, después de `await connection()`. Así el build sigue sin tocar la base y la caché se llena en runtime.
- Los filtros de `/blog` viven en la URL (`?categoria=` y `?etiqueta=`) y se resuelven en la consulta. "Cargar más" pagina con el cursor de SPEC 12.
- Los datos mock pasan a `db/seed/blog-data.ts`, que solo usa el seed. En `lib/blog-posts.ts` quedan los tipos y los formateadores.
- Votar, comentar, valorar y ordenar comentarios siguen siendo visuales o se quitan. Las escrituras van en otro spec.

**Referencias:**

- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`: `cacheLife` y `cacheTag`, y cómo se comporta en el prerender.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` § "Status codes": un `notFound()` durante el streaming responde 200 con `noindex`.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` § "With Cache Components".

## Alcance

**Incluye:**

- **Capa de datos (`db/blog.ts`):**
  - `getPublishedPosts(params?: PostListParams)` suma los filtros opcionales `category` (slug de categoría) y `tag` (slug de etiqueta). Las etiquetas del post filtrado siguen viniendo completas.
  - `getRelatedPosts(postId: string, n = 3)` es nueva. Devuelve primero los publicados de la misma categoría y después los más recientes de otras, sin el propio post, por `published_at` descendente dentro de cada grupo. Usa una consulta más la de etiquetas.
- **Lecturas cacheadas (`db/blog-cache.ts`, nuevo, `server-only`):**
  - Las funciones `cachedCategories`, `cachedTags`, `cachedPublishedPosts`, `cachedPostBySlug`, `cachedRelatedPosts`, `cachedRatingSummary` y `cachedApprovedComments`.
  - Cada una tiene `"use cache"`, `cacheLife("hours")` y `cacheTag("blog")`. Además, `cachedPostBySlug` suma `cacheTag("post:<slug>")` y `cachedRatingSummary` y `cachedApprovedComments` suman `cacheTag("comments:<postId>")`.
  - Las páginas y las acciones llaman solo a estas funciones, nunca a `db/blog.ts` directo.
- **`/blog` (`app/(site)/blog/page.tsx`):**
  - Lee `searchParams.categoria` y `searchParams.etiqueta`. Un valor que no está en `cachedCategories()` o `cachedTags()` se ignora y se trata como "Todos" o "Todas".
  - El contenido va dentro de `<Suspense>` con un skeleton de destacado y tarjetas. Adentro se hace `await connection()` y se piden la primera página filtrada, las categorías y las etiquetas.
  - Los botones de categoría y etiqueta pasan a ser `<Link scroll={false}>` a `/blog?categoria=…&etiqueta=…`. Cambiar uno conserva el otro, y "Todos" o "Todas" quitan su parámetro.
  - El destacado es el primer post de la primera página del resultado filtrado, y el resto va a la grilla.
  - "Cargar más" va debajo de la grilla y suma tarjetas con `loadMorePostsAction`. No se muestra si `nextCursor` es `null`. Mientras carga queda `disabled` con `aria-busy` y "Cargando…". Si falla, muestra "No pudimos cargar más artículos." y se vuelve a habilitar.
  - `PostList` se monta con `key` igual a `categoria|etiqueta`, así que cambiar un filtro reinicia lo cargado.
  - Si el resultado está vacío, se muestra el estado "sin resultados" que ya tiene `PostList`.
  - `app/(site)/blog/actions.ts` (nuevo): `loadMorePostsAction(cursor, filters)` es pública, sin sesión. Valida con Zod (cursor de 1 a 200 caracteres; `category` y `tag` opcionales con formato `[a-z0-9-]{1,60}`). Devuelve `{ status: "success", items, nextCursor }` o `{ status: "error", message }`, y no lanza con un cursor inválido.
- **`/blog/[slug]` (`app/(site)/blog/[slug]/page.tsx`):**
  - Se quita `generateStaticParams`. El cuerpo va dentro de `<Suspense>` con un skeleton de artículo. Adentro, `await connection()` y `cachedPostBySlug(slug)`, y `notFound()` si devuelve `null`.
  - `generateMetadata` usa `cachedPostBySlug`, con `publishedTime` como ISO del `Date`.
  - `ArticleHero`, `ArticleCta`, `ArticleToc` y `ArticleBody` reciben `PostDetail`. La categoría, su badge y el servicio del CTA salen de `post.category` (`BlogCategoryRow`).
  - `AuthorBox` recibe `post.author`: nombre, `jobTitle`, `bio` y avatar. El avatar muestra `image` si existe y, si no, las iniciales de `getInitials(name)` (dos letras, `lib/initials.ts`), con el mismo círculo de hoy. Si no hay `jobTitle` o `bio`, esa línea no se muestra.
  - `RelatedPosts` usa `cachedRelatedPosts(post.id)`, dentro de su propio `<Suspense>`.
- **Valoraciones y comentarios (`components/blog/reviews-section.tsx`):**
  - La sección y su entrada en el índice se muestran siempre.
  - El resumen (promedio, total y barras) sale de `cachedRatingSummary(post.id)`. Con `total = 0` muestra "Todavía no hay valoraciones" en lugar del promedio y las barras.
  - La lista muestra los 20 más recientes de `cachedApprovedComments(post.id)`. Sin comentarios muestra "Todavía no hay comentarios".
  - "Ver más comentarios" va debajo de la lista y llama a `loadMoreCommentsAction(postId, cursor)` en `app/(site)/blog/actions.ts`, con el mismo manejo de carga y error que "Cargar más" ("No pudimos cargar más comentarios."). No se muestra si `nextCursor` es `null`.
  - Se quita el selector "Recientes / Mejor valorados / Más útiles".
  - Cada comentario muestra el avatar (`authorImage` o iniciales), el nombre, las estrellas solo si `rating` no es `null`, el texto y la fecha con `formatPostDate(createdAt)`. La respuesta del autor muestra `formatPostDate(repliedAt)`.
  - "Útil · N" arranca en `usefulCount` y sigue sumando 1 solo en el cliente. "Responder", "Ingresar" y "Crear cuenta" quedan como hoy.
- **Home (`components/home/blog-preview.tsx`):** las 3 tarjetas salen de `cachedPublishedPosts({ limit: 3 })`, dentro de `<Suspense>` con un skeleton de 3 tarjetas y `await connection()`. El encabezado y el enlace "Ver todos los artículos" quedan fuera del `<Suspense>`. Si no hay posts, no se muestra la lista.
- **Componentes de tarjeta:** `PostCard`, `FeaturedPost`, `PostThumb` y `TagList` reciben `PostSummary` (o sus campos) en vez de `BlogPost`. Se ven igual que hoy.
- **`lib/blog-posts.ts`:**
  - Quedan los tipos `BlogCategoryTag`, `BlogTagSlug`, `BlogTag`, `BlogImage`, `BlogBlock`, `BlogRating`, y los formateadores `formatPostDate(date: Date)` y `formatAverage`.
  - Se van `blogCategories`, `blogTags`, `blogAuthor`, `blogPosts`, `getPost`, `getCategory`, `getTag`, `getUsedTags`, `getRatingSummary`, `getRecentPosts`, `getRelatedPosts`, `BlogPost`, `BlogReviews`, `BlogComment` y `BlogAuthor`.
- **Seed:** `db/seed/blog-data.ts` (nuevo) recibe los datos y tipos que solo usa el seed (categorías, etiquetas, autor, posts y reviews). `db/seed/blog.ts`, `__tests__/db/blog-seed.test.ts` y `__tests__/server/blog-body.test.ts` importan de ahí. Lo que carga el seed no cambia.
- **`lib/back-href.ts`:** `resolveBackHref` y `resolveAfterLogin` validan solo el formato `^/blog/[a-z0-9-]+$` y no importan nada del blog.
- **Diseño:** los skeletons y los dos botones nuevos ("Cargar más" y "Ver más comentarios") se revisan con `/frontend-design`. Usan los colores, radios y estilo de botón que ya tiene el blog.
- **Tests (casos en los criterios de aceptación):**
  - Vitest `db`: casos nuevos en `blog-queries.test.ts` para los filtros y para `getRelatedPosts`.
  - Vitest `server`: `back-href.test.ts` actualizado y `blog-posts.test.ts` reducido a los formateadores.
  - Vitest `client`: `post-list.test.tsx` reescrito con `PostSummary` y `loadMorePostsAction` mockeada, y `reviews-section.test.tsx` nuevo con `loadMoreCommentsAction` mockeada.
  - Playwright: `e2e/global-setup.ts` crea el usuario autor `autor-e2e@example.com` (si no existe) y corre `seedBlog`, con `MEDIA_DIR` igual al del servidor de E2E. Se actualizan `etiquetas.spec.ts` (filtros en la URL), `navegacion.spec.ts` y el caso `volver` de `auth.spec.ts`, y se suma `e2e/blog.spec.ts`.

**Fuera de alcance (para specs futuros):**

- Votar "Útil", comentar, responder y valorar de verdad, y la invalidación con `revalidateTag` que eso necesite.
- Ordenar comentarios en el servidor ("Mejor valorados", "Más útiles").
- El editor de posts y la moderación de comentarios.
- Un 404 real para slugs inexistentes (`proxy.ts`).
- Mover las imágenes del mock de `public/blog/` a otra carpeta.
- Navegación por número de página, scroll infinito o `?cursor=` en la URL.
- `sitemap.xml` y RSS.
- Cambios visuales en las tarjetas, el artículo o la home, más allá de los skeletons, los botones nuevos, los estados vacíos y el selector de orden quitado.

## Modelo de datos

No hay tablas, columnas, índices ni migraciones nuevas. Cambian firmas y tipos.

```ts
// db/blog.ts
export type PostFilters = { category?: string; tag?: string }; // slugs
export type PostListParams = PageParams & PostFilters;
export function getPublishedPosts(
  params?: PostListParams,
): Promise<Page<PostSummary>>; // 12 por defecto, como en SPEC 12
export function getRelatedPosts(
  postId: string,
  n?: number,
): Promise<PostSummary[]>; // 3 por defecto

// db/blog-cache.ts — misma firma que su función de db/blog.ts
export async function cachedPublishedPosts(params?: PostListParams) {
  "use cache";
  cacheLife("hours");
  cacheTag("blog");
  return getPublishedPosts(params);
}
// cachedCategories, cachedTags, cachedPostBySlug(slug), cachedRelatedPosts(postId),
// cachedRatingSummary(postId), cachedApprovedComments(postId, params)

// app/(site)/blog/actions.ts
export function loadMorePostsAction(
  cursor: string,
  filters: PostFilters,
): Promise<
  | { status: "success"; items: PostSummary[]; nextCursor: string | null }
  | { status: "error"; message: string }
>;
export function loadMoreCommentsAction(
  postId: string, // UUID
  cursor: string,
): Promise<
  | { status: "success"; items: PublicComment[]; nextCursor: string | null }
  | { status: "error"; message: string }
>;

// lib/initials.ts
export function getInitials(name: string): string; // "Matías Courroux" → "MC", "Ana" → "A"
```

Tags de caché:

| Tag                 | Lo llevan                                       |
| ------------------- | ----------------------------------------------- |
| `blog`              | todas las funciones de `db/blog-cache.ts`       |
| `post:<slug>`       | `cachedPostBySlug`                              |
| `comments:<postId>` | `cachedRatingSummary`, `cachedApprovedComments` |

Parámetros de URL de `/blog`:

| Parámetro   | Valor                   | Inválido o ausente |
| ----------- | ----------------------- | ------------------ |
| `categoria` | slug de `category`      | "Todos"            |
| `etiqueta`  | slug de `tag` con posts | "Todas"            |

Convenciones:

- El filtro de categoría se resuelve con `category.slug = $1` y el de etiqueta con `exists (select 1 from post_tag join tag … where tag.slug = $2)`. Los dos se combinan con `and`.
- `Date` cruza la caché y el límite servidor-cliente como `Date` (serialización de RSC). `formatPostDate` recibe `Date` y sigue usando `timeZone: "UTC"`.

## Plan de implementación

1. **Datos del seed fuera de `lib`.** Crear `db/seed/blog-data.ts`, mover los datos y tipos que solo usa el seed, y actualizar `db/seed/blog.ts`, `blog-seed.test.ts` y `blog-body.test.ts`. `lib/blog-posts.ts` todavía reexporta lo movido para que las páginas no se rompan. Prueba: `npm run test:db` y `npm run test:run` pasan.
2. **Filtros y relacionados en la base.** Sumar `category` y `tag` a `getPublishedPosts`, crear `getRelatedPosts` y sus casos en `blog-queries.test.ts`. Prueba: `npm run test:db` pasa.
3. **Lecturas cacheadas y acciones.** Crear `db/blog-cache.ts`, `app/(site)/blog/actions.ts` y `lib/initials.ts`. Prueba: `npx tsc --noEmit` pasa.
4. **Seed en E2E.** `e2e/global-setup.ts` crea el autor y corre `seedBlog`. Prueba: `npm run test:e2e` pasa sin cambios en las páginas.
5. **Home desde la base.** Cambiar `PostCard`, `PostThumb` y `TagList` a `PostSummary`, y `BlogPreview` a `cachedPublishedPosts` con `<Suspense>` y skeleton. Prueba: `npm run build` sin `DATABASE_URL` pasa, y en `npm run dev` la home muestra los 3 posts del seed.
6. **`/blog` desde la base.** Filtros en la URL, `PostList` con "Cargar más", `FeaturedPost` con `PostSummary`, y skeleton. Revisar con `/frontend-design`. Actualizar `post-list.test.tsx` y `etiquetas.spec.ts`. Prueba: `npm run test:run` y `npm run test:e2e` pasan.
7. **Artículo desde la base.** `/blog/[slug]` sin `generateStaticParams`, con `PostDetail`, `AuthorBox` con `post.author` y `RelatedPosts` con `cachedRelatedPosts`. Prueba: en `npm run dev`, los 8 artículos del seed se ven como antes.
8. **Valoraciones desde la base.** `ReviewsSection` con resumen, comentarios paginados, estados vacíos y sin selector de orden. `reviews-section.test.tsx`. Prueba: `npm run test:run` pasa.
9. **Fuera el mock.** Simplificar `lib/back-href.ts`, quitar de `lib/blog-posts.ts` todo lo que no son tipos y formateadores, y actualizar `back-href.test.ts`, `blog-posts.test.ts`, `auth.spec.ts` y `navegacion.spec.ts`. Crear `e2e/blog.spec.ts`. Prueba: `grep -rn "blogPosts\|blogAuthor\|getPost\b" app components lib` no devuelve nada, y pasan todos los tests.

## Criterios de aceptación

- [x] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [x] `npm run test:run` pasa con Docker apagado.
- [x] `npm run test:db` pasa con Docker levantado, incluidos los tests de SPEC 07 a 12.
- [x] `npm run test:e2e` pasa, incluidos `medios.spec.ts`, `etiquetas.spec.ts`, `navegacion.spec.ts` y `auth.spec.ts`.
- [ ] Los jobs `checks`, `db` y `e2e` del CI pasan en un PR a `main`.
- [x] No hay migraciones nuevas: `npm run db:generate` no crea archivos.
- [x] Ningún archivo de `app/`, `components/` o `lib/` importa `db/seed/blog-data.ts`.
- [x] `lib/blog-posts.ts` no exporta `blogPosts`, `blogAuthor`, `blogCategories`, `blogTags`, `getPost` ni `getRecentPosts`.
- [x] `npm run db:seed` carga los mismos posts, categorías, etiquetas, imágenes, valoraciones y comentarios que antes de este spec (`blog-seed.test.ts` pasa sin cambiar sus asserts).
- [x] `getPublishedPosts({ category: "sistemas" })` devuelve solo posts publicados de esa categoría.
- [x] `getPublishedPosts({ tag: "pymes" })` devuelve solo posts publicados con esa etiqueta, cada uno con todas sus etiquetas.
- [x] `getPublishedPosts({ category, tag })` combina los dos filtros con "y".
- [x] Recorrer `getPublishedPosts({ category, limit: 2 })` con cursor devuelve cada post de la categoría una sola vez.
- [x] `getPublishedPosts({ category: "no-existe" })` devuelve `{ items: [], nextCursor: null }`.
- [x] `getRelatedPosts(id)` no incluye el propio post ni borradores, y pone primero los de la misma categoría.
- [x] `getRelatedPosts(id)` con un único post publicado devuelve `[]`.
- [x] `/blog` sin parámetros muestra como destacado el post publicado más reciente de la base.
- [x] `/blog?categoria=ia` muestra solo posts de IA, y el destacado es el más reciente de IA.
- [x] `/blog?categoria=xyz&etiqueta=no-existe` se ve igual que `/blog`.
- [x] Hacer clic en una etiqueta con `?categoria=sistemas` activo lleva a `/blog?categoria=sistemas&etiqueta=<slug>`.
- [x] Con 14 posts publicados, `/blog` muestra el destacado y 11 tarjetas más el botón "Cargar más", y al hacer clic se suman 2 tarjetas y el botón desaparece.
- [x] `PostList`: si `loadMorePostsAction` devuelve error, se muestra "No pudimos cargar más artículos." y el botón vuelve a estar habilitado.
- [x] `loadMorePostsAction("basura", {})` devuelve `{ status: "error" }` y no lanza.
- [ ] Un post publicado nuevo en la base aparece en `/blog` dentro de la hora, sin redeploy.
- [x] `/blog/senales-sistema-a-medida` muestra título, cuerpo con las 2 imágenes, autor, CTA del servicio de la categoría, relacionados y valoraciones, todo de la base.
- [x] `AuthorBox` muestra el `jobTitle` y la `bio` de `author_profile` del autor del seed.
- [x] `/blog/no-existe` muestra la página de no encontrado con `<meta name="robots" content="noindex">`.
- [x] Un post en `borrador` no es accesible por su slug y no aparece en `/blog`, en la home ni en relacionados.
- [x] Un artículo sin valoraciones ni comentarios muestra "Todavía no hay valoraciones" y "Todavía no hay comentarios".
- [x] El promedio y la distribución de `senales-sistema-a-medida` coinciden con `getRatingSummary` de la base.
- [x] `ReviewsSection`: con 25 comentarios aprobados muestra 20 y "Ver más comentarios", y al hacer clic muestra 25 y el botón desaparece.
- [x] `ReviewsSection` no tiene el selector "Recientes / Mejor valorados / Más útiles".
- [x] Un comentario muestra la fecha en formato `formatPostDate` (por ejemplo "16 nov 2026"), no "Hace N días".
- [x] Un comentario cuyo autor no valoró el post no muestra estrellas.
- [x] La home muestra los 3 posts publicados más recientes de la base.
- [x] `resolveBackHref("/blog/cualquier-slug")` devuelve `"/blog/cualquier-slug"`, y `resolveBackHref("//otro.com")`, `resolveBackHref("/blog/../x")` y `resolveBackHref("/blog/Mayus")` devuelven `"/blog"`.
- [x] `resolveAfterLogin` acepta `/blog/<slug>` con formato válido, `/cuenta/perfil` y `/admin`, y cualquier otro valor va a `/cuenta/perfil`.

## Decisiones

- **Sí:** todo el blog público lee de la base: listado, artículo, relacionados, valoraciones, comentarios y la home. Elegido por el usuario.
- **No:** migrar solo los listados. Dejaría dos fuentes de datos para lo mismo.
- **Sí:** los datos mock pasan a `db/seed/blog-data.ts`. El seed sigue funcionando y la app ya no puede importarlos. Elegido por el usuario.
- **No:** borrar el contenido mock. Una base nueva quedaría vacía hasta que exista el editor.
- **Sí:** `"use cache"` con `cacheLife("hours")` y `cacheTag`. Menos consultas por visita, con los tags listos para el editor futuro. Elegido por el usuario.
- **No:** `cacheLife("minutes")` o `"max"`. `minutes` consulta más de lo necesario sin escrituras desde la app, y `max` no se refrescaría nunca sin editor.
- **Sí:** `await connection()` antes de cada lectura cacheada, dentro de `<Suspense>`. El build sigue sin necesitar la base, como en SPEC 07 a 12. Elegido por el usuario.
- **No:** prerender con la base en el build. Obligaría a tener `DATABASE_URL` y una base migrada en cada build.
- **Sí:** filtros en la URL y resueltos en la consulta, con "Cargar más". Funciona con cualquier volumen, se puede compartir y lo indexan los buscadores. Elegido por el usuario.
- **No:** traer 100 posts y filtrar en el cliente, ni filtrar solo lo cargado. El primero corta en 100 y el segundo muestra "sin resultados" cuando sí hay posts.
- **Sí:** un filtro inválido se ignora. Un enlace viejo no se rompe. Elegido por el usuario.
- **Sí:** el destacado es el primero del resultado filtrado. Elegido por el usuario.
- **Sí:** quitar `generateStaticParams` y aceptar 200 con `noindex` para slugs inexistentes. Es el comportamiento documentado de Next con streaming. Elegido por el usuario.
- **No:** 404 real con `proxy.ts`. Suma una consulta por request a `/blog/*` para un caso sin impacto en SEO.
- **Sí:** nueva `getRelatedPosts` en la base, con la misma regla que el mock. Elegido por el usuario.
- **Sí:** 20 comentarios con "Ver más comentarios" y sin selector de orden. Ordenar solo lo cargado sería engañoso. Elegido por el usuario.
- **Sí:** la sección de valoraciones siempre visible, con estados vacíos. Elegido por el usuario.
- **Sí:** fecha absoluta en comentarios. Un texto relativo quedaría viejo con la caché de una hora. Elegido por el usuario.
- **Sí:** "Útil" y "Responder" se quedan visuales. Elegido por el usuario.
- **Sí:** `back-href` valida solo el formato. `BackLink` es un componente cliente y no puede consultar la base, y un slug inexistente termina en una página de no encontrado inofensiva. Elegido por el usuario.
- **Sí:** el seed del blog corre en `e2e/global-setup.ts`. Los E2E existentes siguen usando los mismos slugs. Elegido por el usuario.
- **Sí:** avatar con foto si existe y, si no, dos iniciales en el mismo círculo de hoy. Conserva el diseño del mock.
- **No:** reusar `UserAvatar` (una sola letra). Cambiaría el diseño de comentarios y del autor.
- **No:** mover `public/blog/*.webp`. El seed los lee de ahí, y moverlos es limpieza sin impacto para el usuario.

## Riesgos

| Riesgo                                                                                             | Mitigación                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Una lectura cacheada fuera de `<Suspense>` o sin `connection()` intenta tocar la base en el build. | El criterio de `npm run build` sin `DATABASE_URL` lo detecta. Cada página tiene un único punto de entrada a `db/blog-cache.ts`. |
| `generateMetadata` con la base hace fallar el build si el resto de la página es prerenderizable.   | La página ya difiere al request por `connection()`. Revisar `generate-metadata.md` § "With Cache Components" al implementar.    |
| El cursor de una consulta filtrada se usa con otros filtros.                                       | `PostList` se reinicia con `key` al cambiar los filtros, y la acción recibe los filtros del mismo estado que el cursor.         |
| Con la caché en memoria, un cambio en la base tarda hasta una hora en verse.                       | Aceptado. Los tags quedan listos para `revalidateTag` en el spec del editor.                                                    |
| El seed en `global-setup` escribe imágenes en un `MEDIA_DIR` distinto al del servidor de E2E.      | `global-setup` usa el mismo `MEDIA_DIR` que `playwright.config.ts` le pasa al servidor.                                         |
| Pasar `Date` por la caché o a componentes cliente lo convierte en string.                          | La serialización de RSC conserva `Date`. El test de `PostList` usa `PostSummary` con `Date`, y `formatPostDate` recibe `Date`.  |
| Quitar exports de `lib/blog-posts.ts` rompe un import que no se vio.                               | `npx tsc --noEmit` los marca todos, y el paso 1 reexporta hasta el paso 9.                                                      |

## Qué **no** incluye este spec

- Votar, comentar, responder o valorar de verdad.
- Ordenar comentarios en el servidor.
- Editor de posts y moderación.
- 404 real para slugs inexistentes.
- Paginación numerada, scroll infinito o cursor en la URL.
- Sitemap y RSS.
- Mover las imágenes del mock de `public/blog/`.

Cada uno de estos, si llega, va en su propio spec.
