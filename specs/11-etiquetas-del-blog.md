# SPEC 11 — Etiquetas del blog

> **Estado:** Aprobado
> **Depende de:** SPEC 03, SPEC 09, SPEC 10
> **Fecha:** 2026-11-16
> **Objetivo:** Sumar etiquetas a los posts del blog (tablas, migración, seed, lectura y un filtro por etiqueta en `/blog` sobre el mock), sin UI para asignarlas.

## Por qué existe este spec

SPEC 09 dejó una sola categoría por post (badge, filtro y CTA salen de ella) y dejó las etiquetas fuera de alcance.
SPEC 10 las separó a propósito para no mezclar áreas.
Las categorías son pocas y estructurales; las etiquetas son temas libres y transversales ("pymes", "automatización") que un post combina de a varias.

Este spec sigue el patrón de SPEC 09 y SPEC 10:

- La estructura de datos, el seed y las funciones de lectura van a la base.
- Las páginas siguen leyendo `lib/blog-posts.ts`: el mock suma etiquetas, y los componentes públicos las muestran y filtran.
- No hay escrituras desde la app. Sin editor de posts no hay dónde asignarlas, así que el seed es la única vía de carga hasta el spec del editor.

Tres decisiones marcan el modelo:

- Muchos a muchos con `tag` y `post_tag`. Una etiqueta es `slug` único más `name` visible, sin color ni descripción.
- Borrar una etiqueta la quita de los posts sin bloquear. A diferencia de una imagen, una etiqueta que desaparece no deja un post roto.
- El público solo ve etiquetas con al menos un post `publicado`.

**Referencias:**

- `node_modules/next/dist/docs/01-app/` no aplica: este spec no suma rutas ni datos dinámicos. El filtro es estado de cliente, como el de categorías.
- La documentación de Drizzle: `primaryKey`, `check`, `inArray`, `onConflictDoUpdate`, `onConflictDoNothing`.

## Alcance

**Incluye:**

- `db/schema/blog.ts` suma las tablas `tag` y `post_tag` (detalle en el modelo de datos).
- Migración `db/migrations/0004_etiquetas.sql`, generada con `npm run db:generate -- --name etiquetas`.
- `lib/blog-posts.ts`:
  - Tipo `BlogTagSlug` y tipo `BlogTag` (`slug`, `name`).
  - Lista `blogTags` con las 11 etiquetas de demo.
  - `BlogPost` suma `tags: BlogTagSlug[]`, ordenado por `slug` ascendente.
  - `getTag(slug)` y `getUsedTags(posts)`, que devuelve `BlogTag & { count: number }` de las etiquetas usadas, por cantidad descendente y `slug` ascendente.
  - Los 8 posts mock llevan de 2 a 3 etiquetas (tabla en el modelo de datos).
- `db/blog.ts` (`import "server-only"`):
  - `getTags()`: etiquetas con al menos un post `publicado`, con su cantidad, en el mismo orden que `getUsedTags`.
  - `PostSummary` suma `tags: BlogTag[]`, ordenado por `slug` ascendente. Los trae con una sola consulta adicional para todos los posts, sin una por post.
- Seed (`db/seed/blog.ts`):
  - Toma `blogTags` y las etiquetas de cada post de `lib/blog-posts.ts`, sin duplicar textos.
  - Crea o actualiza cada `tag` por `slug` (el `name` se actualiza) y crea las filas `post_tag` con `onConflictDoNothing`.
  - Sigue siendo idempotente.
  - No borra filas `post_tag` que no estén en el mock, para no pisar datos cargados a mano.
- Componentes públicos, diseñados con `/frontend-design` sobre los tokens de `app/globals.css`:
  - `components/blog/tag-list.tsx`: lista de chips de solo texto, no enlazados, con `aria-label="Etiquetas"`. No renderiza nada si no hay etiquetas.
  - `post-card.tsx` y `article-hero.tsx` muestran `TagList` con las etiquetas del post. `featured-post.tsx` no las muestra.
  - `components/blog/post-list.tsx`: segunda fila de chips "Etiquetas" debajo del filtro de categorías.
    - Botones con `aria-pressed`, "Todas" activo por defecto, una sola etiqueta activa a la vez.
    - Muestra solo las de `getUsedTags(posts)`, con la cantidad en cada chip.
    - Se combina con el filtro de categoría con AND.
    - Si la combinación no deja posts, muestra "No hay artículos con esa combinación." en lugar de la lista.
- Tests (casos en los criterios de aceptación):
  - Vitest `server`: casos nuevos en `__tests__/server/blog-posts.test.ts`.
  - Vitest `client`: `__tests__/client/tag-list.test.tsx` y `__tests__/client/post-list.test.tsx`.
  - Vitest `db`: casos nuevos en `blog-schema.test.ts`, `blog-queries.test.ts` y `blog-seed.test.ts`. `resetBlog()` también borra `tag`.
  - Playwright `e2e/etiquetas.spec.ts`.
- `README.md`: una línea en la sección del blog que explica que las etiquetas se cargan solo por seed hasta que exista el editor de posts.

**Fuera de alcance (para specs futuros):**

- Cargar o editar etiquetas desde la app: CRUD de etiquetas, asignarlas a posts y editor de posts.
- Rutas por etiqueta (`/blog/etiqueta/[slug]`) y filtro en la URL.
- Chips enlazados a `/blog` con la etiqueta preseleccionada.
- Filtro con varias etiquetas activas (OR).
- Límite de etiquetas por post (no hay escritura que lo valide).
- Color, descripción o icono de la etiqueta.
- Pasar `/blog`, `/blog/[slug]` y la home a leer de la base.
- Sugerencias de posts relacionados por etiquetas. `getRelatedPosts` sigue usando la categoría.
- Metadatos SEO por etiqueta y página de etiqueta en el sitemap.
- Etiquetas en el feed o en los resultados de búsqueda (no existen).

## Modelo de datos

```ts
// db/schema/blog.ts — tablas nuevas, casing de SPEC 06
export const tag = pgTable("tag", {
  id: text().primaryKey(), // crypto.randomUUID() con $defaultFn
  slug: text().notNull().unique(), // check: slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  name: text().notNull(), // "Atención al cliente"; check: length(trim(name)) > 0
  createdAt,
  updatedAt,
});

export const postTag = pgTable("post_tag", {
  postId: text()
    .notNull()
    .references(() => post.id, { onDelete: "cascade" }),
  tagId: text()
    .notNull()
    .references(() => tag.id, { onDelete: "cascade" }),
  createdAt,
}); // PK (post_id, tag_id); índice: (tag_id)
```

```ts
// lib/blog-posts.ts
export type BlogTagSlug =
  | "atencion-al-cliente"
  | "automatizacion"
  | "chatbots"
  | "gestion"
  | "landing-page"
  | "mvp"
  | "pymes"
  | "rendimiento"
  | "seo"
  | "validacion"
  | "ventas";
export type BlogTag = { slug: BlogTagSlug; name: string };
export const blogTags: BlogTag[]; // las 11 de la tabla de abajo
// BlogPost suma: tags: BlogTagSlug[]; // ordenado por slug ascendente
export const getTag: (slug: BlogTagSlug) => BlogTag | undefined;
export function getUsedTags(
  posts: Pick<BlogPost, "tags">[],
): (BlogTag & { count: number })[]; // count descendente, slug ascendente

// db/blog.ts — cambios
export type TagRow = BlogTag & { count: number }; // count de posts publicados
// PostSummary suma: tags: BlogTag[]; // slug ascendente
export function getTags(): Promise<TagRow[]>;
```

Etiquetas del mock:

| Slug                  | Nombre              |
| --------------------- | ------------------- |
| `atencion-al-cliente` | Atención al cliente |
| `automatizacion`      | Automatización      |
| `chatbots`            | Chatbots            |
| `gestion`             | Gestión             |
| `landing-page`        | Landing page        |
| `mvp`                 | MVP                 |
| `pymes`               | Pymes               |
| `rendimiento`         | Rendimiento         |
| `seo`                 | SEO                 |
| `validacion`          | Validación          |
| `ventas`              | Ventas              |

Asignación del mock (cada lista ordenada por `slug`):

| Post                                | Etiquetas                                           |
| ----------------------------------- | --------------------------------------------------- |
| `senales-sistema-a-medida`          | `automatizacion`, `gestion`, `pymes`                |
| `chatbots-ia-atencion-al-cliente`   | `atencion-al-cliente`, `automatizacion`, `chatbots` |
| `landing-page-o-sitio-web-completo` | `landing-page`, `ventas`                            |
| `validar-idea-saas`                 | `mvp`, `validacion`                                 |
| `velocidad-web-ventas`              | `rendimiento`, `seo`, `ventas`                      |
| `automatizaciones-ia-pymes`         | `automatizacion`, `pymes`                           |
| `excel-o-sistema-de-gestion`        | `gestion`, `pymes`                                  |
| `mvp-primera-version`               | `mvp`, `validacion`                                 |

Resultado: 11 etiquetas y 19 filas `post_tag`. Conteos: `automatizacion` 3, `pymes` 3, `gestion` 2, `mvp` 2, `validacion` 2, `ventas` 2, y 1 para `atencion-al-cliente`, `chatbots`, `landing-page`, `rendimiento` y `seo`.
Orden de los chips del filtro: `automatizacion`, `pymes`, `gestion`, `mvp`, `validacion`, `ventas`, `atencion-al-cliente`, `chatbots`, `landing-page`, `rendimiento`, `seo`.

Comportamiento al borrar:

| Se borra                       | Efecto                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| Una etiqueta                   | Borra sus filas `post_tag`. Los posts quedan.                |
| Un post                        | Borra sus filas `post_tag`. Las etiquetas quedan.            |
| La última fila de una etiqueta | La etiqueta queda en la base y deja de verse en `getTags()`. |

Convenciones:

- Ids `text` con `crypto.randomUUID()` por `$defaultFn`, tablas en singular y PK compuesta en la tabla puente, igual que SPEC 09.
- La clave natural del seed para `tag` es `slug`. Las filas puente se insertan con `onConflictDoNothing`.
- El orden de las etiquetas dentro de un post es siempre `slug` ascendente, comparado como cadena y ordenado en código, no por la collation de la base.
- Solo `db/blog.ts` y el seed consultan `tag` y `post_tag`.

## Plan de implementación

1. **Tipos y datos del mock.** Sumar `BlogTagSlug`, `BlogTag`, `blogTags`, `tags` en los 8 posts, `getTag` y `getUsedTags` en `lib/blog-posts.ts`, con casos en `__tests__/server/blog-posts.test.ts`. Prueba: `npm run test:run` y `npx tsc --noEmit` pasan.
2. **Chips en los componentes.** Crear `components/blog/tag-list.tsx` y mostrarlo en `post-card.tsx` y `article-hero.tsx`, diseñado con `/frontend-design`, con `__tests__/client/tag-list.test.tsx`. Prueba: `npm run test:run` pasa y en `npm run dev` `/blog` y `/blog/senales-sistema-a-medida` muestran los chips.
3. **Filtro por etiqueta.** Sumar la segunda fila y el estado vacío en `post-list.tsx`, con `__tests__/client/post-list.test.tsx`. Prueba: `npm run test:run` pasa y en `npm run dev` el filtro combina categoría y etiqueta.
4. **Tablas y migración.** Sumar `tag` y `post_tag` a `db/schema/blog.ts` y generar `0004_etiquetas.sql`. Prueba: `npm run db:migrate` crea las dos tablas, y un segundo `db:generate` no crea migraciones.
5. **Tests del esquema.** Casos nuevos en `blog-schema.test.ts` y `tag` en `resetBlog()`. Prueba: `npm run test:db` pasa, incluidos los tests de SPEC 07 a 10.
6. **Lectura.** `getTags()` y `PostSummary.tags` en `db/blog.ts`, con casos en `blog-queries.test.ts`. Prueba: `npm run test:db` pasa.
7. **Seed.** Cargar etiquetas y `post_tag` en `seedBlog`, con casos en `blog-seed.test.ts`. Prueba: `npm run db:seed` dos veces deja 11 filas en `tag` y 19 en `post_tag`.
8. **E2E y README.** `e2e/etiquetas.spec.ts` y la línea del README. Prueba: `npm run test:e2e` pasa.

## Criterios de aceptación

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado, incluidos los tests de SPEC 07 a 10.
- [ ] `npm run test:e2e` pasa.
- [ ] Los jobs `checks`, `db` y `e2e` del CI pasan en un PR a `main`.
- [ ] `npm run db:migrate` crea las tablas `tag` y `post_tag`, y después `npm run db:generate` no crea migraciones nuevas.
- [ ] Cada post de `blogPosts` tiene 2 o 3 etiquetas, todas existen en `blogTags`, no se repiten y están ordenadas por `slug`.
- [ ] `getUsedTags(blogPosts)` devuelve las 11 etiquetas en el orden y con los conteos de este spec.
- [ ] `TagList` con etiquetas renderiza una lista con `aria-label="Etiquetas"` y un `<li>` por etiqueta con su `name`. Con una lista vacía no renderiza nada.
- [ ] Los chips de `TagList` no son enlaces ni botones.
- [ ] `/blog` muestra los chips de etiquetas en las tarjetas y no en el post destacado.
- [ ] `/blog/senales-sistema-a-medida` muestra en el hero "Automatización", "Gestión" y "Pymes".
- [ ] `/blog` muestra la fila "Etiquetas" con "Todas" activo y los 11 chips en el orden de este spec, cada uno con su cantidad.
- [ ] Activar "Pymes" deja los 3 posts con esa etiqueta y desactiva "Todas". Activar "Todas" muestra los 8.
- [ ] Activar la categoría "IA" y la etiqueta "Pymes" deja solo `automatizaciones-ia-pymes`.
- [ ] Activar la categoría "Desarrollo web" y la etiqueta "Chatbots" muestra "No hay artículos con esa combinación." y ninguna tarjeta.
- [ ] Cada chip de etiqueta del filtro es un `<button>` con `aria-pressed` y alto mínimo de 44 px.
- [ ] Insertar dos veces la misma pareja `(post_id, tag_id)` falla por la PK.
- [ ] Insertar una etiqueta con `slug` repetido, con mayúsculas o espacios, o con `name` vacío o solo espacios falla.
- [ ] Borrar una etiqueta borra sus filas `post_tag` y deja los posts.
- [ ] Borrar un post borra sus filas `post_tag` y deja las etiquetas.
- [ ] `getTags()` no cuenta posts `borrador` y no devuelve una etiqueta que solo tiene posts `borrador` o ninguno.
- [ ] `getTags()` devuelve los conteos de posts `publicado` por cantidad descendente y `slug` ascendente.
- [ ] `getPublishedPosts()` devuelve `tags` en cada post ordenadas por `slug`, y `[]` en un post sin etiquetas.
- [ ] `getPublishedPosts()` resuelve las etiquetas con una sola consulta adicional, sin importar cuántos posts haya.
- [ ] Después de `seedBlog`, `getTags()` devuelve las 11 etiquetas en el orden de este spec.
- [ ] Después de `seedBlog`, `getPublishedPostBySlug("senales-sistema-a-medida")` tiene las etiquetas `automatizacion`, `gestion` y `pymes`.
- [ ] Correr `seedBlog` dos veces deja 11 filas en `tag` y 19 en `post_tag`.
- [ ] `seedBlog` no borra una fila `post_tag` agregada a mano a un post del seed.
- [ ] E2E: en `/blog`, activar "Pymes" deja 3 tarjetas visibles (contando el destacado), y activar además la categoría "IA" deja 1.
- [ ] E2E: la combinación sin resultados muestra "No hay artículos con esa combinación.".
- [ ] `README.md` explica que las etiquetas se cargan solo por seed hasta el spec del editor.

## Decisiones

- **Sí:** etiquetas en su propio spec, separado de las imágenes. Son independientes y juntas tocaban más de tres áreas (decidido en SPEC 10).
- **Sí:** solo tabla, funciones de lectura y seed, sin UI de admin. Sigue el patrón de SPEC 09. Elegido por el usuario.
- **No:** `/admin/etiquetas` con CRUD y asignación a posts. Sin editor de posts la asignación queda a medias y el CRUD no se puede probar con datos reales. Va con el spec del editor.
- **Sí:** muchos a muchos con `tag` y `post_tag`, PK compuesta y sin límite por post. Elegido por el usuario.
- **No:** máximo de etiquetas por post. No hay escritura desde la app que lo valide.
- **No:** `tag` con color o descripción. Ningún diseño de SPEC 03 los usa.
- **Sí:** cascade en `post_tag` al borrar una etiqueta o un post. Una etiqueta que desaparece no rompe el post, a diferencia de una imagen en uso. Elegido por el usuario.
- **No:** bloquear el borrado de una etiqueta en uso. Sirve para recursos que el post necesita para verse bien, no para temas.
- **Sí:** `slug` único con check de formato en la base. Es la clave natural del seed y de los tests, y las rutas futuras la van a necesitar.
- **Sí:** filtro por etiqueta como segunda fila de chips combinada con AND, con una sola etiqueta activa. Elegido por el usuario.
- **No:** que la etiqueta reemplace a la categoría. Pierde información.
- **No:** varias etiquetas activas (OR). Suma UI y casos para un blog de 8 posts.
- **Sí:** filtro como estado de cliente, igual que el de categorías. Sin rutas nuevas ni URL, y las páginas siguen en el mock.
- **No:** `/blog/etiqueta/[slug]`. Con `cacheComponents` exige decidir prerender, 404 y caché, y va con el spec que pase las páginas a la base.
- **Sí:** chips de solo texto, sin enlace, en la tarjeta y en el hero del artículo. El filtro vive únicamente en `/blog`. Elegido por el usuario.
- **No:** chips enlazados a `/blog?etiqueta=…`. Exige leer la URL en el cliente y envolver `PostList` en `Suspense`.
- **No:** chips en el post destacado. Ya muestra categoría, fecha y extracto en poco espacio.
- **Sí:** el filtro solo muestra etiquetas con al menos un post publicado, y `getTags()` aplica la misma regla. Evita filtros que devuelven vacío. Elegido por el usuario.
- **Sí:** `getUsedTags` calcula las etiquetas del filtro a partir de los posts que recibe `PostList`. No suma props ni consulta aparte, y la misma regla sirve cuando las páginas lean de la base.
- **Sí:** estado vacío "No hay artículos con esa combinación." Con AND la combinación puede no tener resultados y hoy el filtro nunca queda vacío.
- **Sí:** orden por cantidad descendente y `slug` ascendente, ordenado en código. La collation de la base cambia el orden de las tildes entre entornos.
- **Sí:** el mock de 11 etiquetas y 2 a 3 por post lo propone este spec, para revisar en el archivo. Elegido por el usuario.
- **Sí:** el seed solo agrega filas `post_tag`, no las borra. No pisa asignaciones cargadas a mano, igual que SPEC 09.
- **Sí:** `getRelatedPosts` sigue por categoría. Cambiar el criterio es otra decisión de producto.

## Riesgos

| Riesgo                                                                                       | Mitigación                                                                                                                 |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Los tests de auth borran `user` y `resetBlog()` no limpia `tag`, y queda basura entre tests. | `resetBlog()` borra `tag` y `fileParallelism: false` evita cruces.                                                         |
| `getPublishedPosts()` hace una consulta de etiquetas por post.                               | Una sola consulta con `inArray` sobre los ids de los posts, y un test que cuenta las consultas.                            |
| El filtro con AND deja la lista vacía y parece roto.                                         | Estado vacío con mensaje y "Todas" siempre visible para volver.                                                            |
| El mock y la base se desalinean en slugs o nombres de etiquetas.                             | El seed toma `blogTags` y `tags` de `lib/blog-posts.ts`, y falla si un post nombra una etiqueta que no está en `blogTags`. |
| Un `slug` de etiqueta insertado a mano con formato raro rompe las rutas futuras.             | Check de formato en la base, probado en `blog-schema.test.ts`.                                                             |
| Drizzle no genera el `check` con regex como se espera.                                       | El paso 4 revisa `0004_etiquetas.sql` antes de migrar y el test de esquema prueba el check contra la base.                 |
| 11 chips más la fila de categorías ocupan mucho alto en pantallas chicas.                    | La fila hace `flex-wrap`, y la revisión con `/frontend-design` se hace a 375 px.                                           |

## Qué **no** incluye este spec

- Crear, editar o asignar etiquetas desde la app.
- Rutas por etiqueta y filtro en la URL.
- Chips enlazados o filtro con varias etiquetas.
- Límite de etiquetas por post.
- Color, descripción o icono de etiquetas.
- Páginas del blog leyendo de la base.
- Posts relacionados por etiquetas, SEO y sitemap por etiqueta.

Cada uno de estos, si llega, va en su propio spec.
