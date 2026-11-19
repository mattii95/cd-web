# SPEC 21 — Categorías y etiquetas

> **Estado:** Aprobado
> **Depende de:** SPEC 09, SPEC 11, SPEC 13, SPEC 16, SPEC 17, SPEC 19
> **Fecha:** 2026-11-19
> **Objetivo:** Que el admin cree, edite, reordene y borre categorías en `/admin/categories` y cree, renombre, fusione y borre etiquetas en `/admin/tags`, sin romper el blog público ni el editor de artículos.

## Por qué existe este spec

SPEC 16 dejó "Categorías" fuera de la barra lateral y SPEC 19 dejó afuera "Administrar etiquetas (renombrar, borrar, fusionar) y categorías". Hoy las 4 categorías solo cambian con el seed y las etiquetas solo se crean desde el editor.

El código asume que las dos listas son fijas, y eso marca el diseño:

- **Tipos cerrados.** `BlogCategoryTag` y `BlogTagSlug` (`lib/blog-posts.ts`) son uniones de los slugs del seed. Pasan a ser `string`.
- **Ícono por slug.** `PostThumb` elige el ícono de la miniatura con el slug de la categoría. Pasa a leer una columna nueva `category.icon`.
- **Etiquetas por nombre.** El editor identifica cada etiqueta con `slugify(nombre)`. Si el admin renombra "SEO" a "Posicionamiento" y el slug sigue siendo `seo`, guardar un artículo crearía una etiqueta nueva. El editor pasa a mandar el slug de las etiquetas que ya existen.
- **Filtros vacíos.** `/blog` muestra un filtro por cada categoría de la tabla. Una categoría recién creada aparecería vacía. El blog pasa a mostrar solo las que tienen algún artículo publicado, como ya hace con las etiquetas.

**Referencias:**

- `db/schema/blog.ts` (`category`, `tag`, `post_tag`), `db/blog.ts` (`getCategories`, `getTags`, `BlogCategoryRow`), `db/blog-cache.ts` (`cachedCategories`), `db/admin-posts.ts` (`replaceTags`, `listEditorCategories`, `createPost`, `updatePost`), `db/seed/blog.ts`, `db/seed/blog-data.ts`.
- `lib/blog-posts.ts`, `lib/services.ts` (`services`, `ServiceSlug`), `lib/slug.ts` (`slugify`, `isSlug`), `lib/admin/article-form.ts`, `lib/admin/article-params.ts`.
- `components/blog/post-thumb.tsx`, `components/blog/post-list.tsx`, `components/icons.tsx`.
- `components/admin/nav-items.ts`, `components/admin/page-header.tsx`, `components/admin/confirm-dialog.tsx`, `components/admin/toast.tsx` (`notify`), `components/admin/article-editor/tag-input.tsx`.
- `app/(admin)/admin/articles/` (`page.tsx`, `articles-table.tsx`, `articles-footer.tsx`, `row-menu.tsx`) como modelo de tabla, paginación y menú de fila.
- `node_modules/next/dist/docs/01-app/` sobre `searchParams` como promesa, Cache Components y `updateTag`.

## Alcance

**Incluye:**

- **Rutas nuevas:**

  | Ruta                | Carpeta                         | Qué hace                                      |
  | ------------------- | ------------------------------- | --------------------------------------------- |
  | `/admin/categories` | `app/(admin)/admin/categories/` | Tabla de categorías con orden, modal y borrar |
  | `/admin/tags`       | `app/(admin)/admin/tags/`       | Tabla de etiquetas con búsqueda y paginación  |
  - Las dos páginas llaman a `requireAdmin()` y leen la base dentro de un `<Suspense>` con esqueleto de tabla.
  - Las rutas van en inglés; los textos, en español (SPEC 17).

- **Barra lateral (`nav-items.ts`):** el grupo "Contenido del blog" queda Artículos, Categorías, Etiquetas, Medios.
  - Íconos nuevos en `components/icons.tsx`: `Folder` (Categorías) y `Tag` (Etiquetas).

- **Categorías: tabla (`categories-table.tsx`):**
  - Ordenada por `position`. Columnas: Orden, Categoría (ícono y nombre), Slug, Servicio del CTA, Artículos (`{publicados} publicados · {total} en total`) y acciones.
  - Cabecera (`AdminPageHeader`) con el botón "Nueva categoría".
  - **Orden:** cada fila tiene "Subir" y "Bajar" (`aria-label="Subir {nombre}"` / `"Bajar {nombre}"`). La primera no tiene "Subir" activo y la última no tiene "Bajar" activo.
    - Cada clic guarda al instante e intercambia `position` con la vecina en una transacción.
    - Una región `aria-live` anuncia "{nombre} quedó en la posición {N}." y el foco se queda en el mismo botón (o pasa al otro si ese quedó deshabilitado).
  - **Acciones por fila:** "Editar" (abre el modal) y "Borrar".
    - Con artículos (borradores o publicados), "Borrar" queda deshabilitado y debajo se lee "Tiene {N} artículos. Movelos a otra categoría para borrarla.".
    - Sin artículos, abre `ConfirmDialog`: "¿Borrar la categoría «{nombre}»?" / "No se puede deshacer." / "Borrar".
  - Sin categorías: "Todavía no hay categorías.".

- **Categorías: modal (`category-dialog.tsx`, `<dialog>` nativo como `ConfirmDialog`):**
  - Título "Nueva categoría" o "Editar categoría"; botones "Cancelar" y "Crear categoría" / "Guardar cambios".
  - Campos:

    | Campo              | Columna        | Regla                                                                                                           |
    | ------------------ | -------------- | --------------------------------------------------------------------------------------------------------------- |
    | "Nombre"           | `label`        | Obligatorio, `trim`, máx. 40. Se ve en el badge de la tarjeta y del artículo.                                   |
    | "Texto del filtro" | `filter_label` | Obligatorio, `trim`, máx. 40. Sigue al nombre hasta que se edita a mano; borrarlo entero lo vuelve a enganchar. |
    | "URL"              | `slug`         | Prefijo `/blog?categoria=`. Sigue al nombre con `slugify` hasta que se edita a mano. `isSlug`.                  |
    | "Servicio del CTA" | `service_slug` | `select` obligatorio con los 4 `services` (por `title`). Sin valor por defecto al crear.                        |
    | "Ícono"            | `icon`         | `radiogroup` con los 6 íconos de `CATEGORY_ICONS` y su nombre. Obligatorio, sin valor por defecto al crear.     |

  - **Slug bloqueado:** si la categoría tiene algún artículo publicado, el input "URL" es de solo lectura con la nota "La URL no cambia porque la categoría tiene artículos publicados." y el servidor ignora el slug enviado.
  - Una categoría nueva queda última (`position = max + 1`).
  - Errores debajo de cada campo (`aria-invalid`, `aria-describedby`) y foco al primero con error. La misma validación corre en el cliente y en el servidor.
  - `Escape` o "Cancelar" cierran sin guardar. Al guardar, el modal se cierra, sale el toast y la tabla se actualiza.

- **Etiquetas: tabla (`tags-table.tsx`):**
  - Columnas: Etiqueta, Slug, Artículos (`{publicados} publicados · {total} en total`) y "Más acciones".
  - Orden alfabético por `lower(name)` y después `id`. 25 por página.
  - Búsqueda "Buscar etiquetas" (`type="search"`, máx. 100) sobre `name` y `slug` con `ILIKE` escapado, como `listAdminPosts`.
  - Estado en la URL: `/admin/tags?q=seo&page=2`. Parámetros inválidos se ignoran; una página fuera de rango se acota a la última. Pie con "Mostrando {desde}–{hasta} de {total}" y "Anterior" / "Siguiente", como `articles-footer.tsx`.
  - Cabecera con el botón "Nueva etiqueta".
  - "Más acciones" (`tag-row-menu.tsx`, como `row-menu.tsx`): "Editar", "Fusionar con…" y "Borrar".
  - Estados vacíos: "Todavía no hay etiquetas." y "No hay etiquetas que coincidan con «{q}».".

- **Etiquetas: modal de crear y editar (`tag-dialog.tsx`):**
  - Campos "Nombre" (obligatorio, `trim`, máx. 40) y "URL" (prefijo `/blog?etiqueta=`, sigue al nombre con `slugify` hasta que se edita a mano, `isSlug`).
  - Con algún artículo publicado, "URL" es de solo lectura con "La URL no cambia porque la etiqueta tiene artículos publicados." y el servidor ignora el slug enviado.
  - **Nombre único:** no puede haber dos etiquetas cuyo `slugify(name)` coincida. Si coincide con otra: "Ya hay una etiqueta con ese nombre. Usá «Fusionar con…» para unirlas.".
  - Mismo manejo de errores, foco y cierre que el modal de categorías.

- **Etiquetas: fusionar (`merge-tag-dialog.tsx`):**
  - "Fusionar con…" abre un modal "Fusionar «{origen}»" con un combobox "Etiqueta que queda" que busca en el servidor (máx. 10 resultados, sin la etiqueta de origen).
  - Texto: "Los {N} artículos de «{origen}» pasan a «{destino}» y «{origen}» se borra. No se puede deshacer." Botón "Fusionar", deshabilitado hasta elegir destino.
  - En una transacción: inserta `post_tag (post, destino)` para cada artículo del origen con `onConflictDoNothing` y borra el origen (sus `post_tag` caen en cascada). Ningún artículo supera las 5 etiquetas porque cada uno pierde una y gana como mucho una.

- **Etiquetas: borrar:** `ConfirmDialog` "¿Borrar la etiqueta «{nombre}»?" / "Se quita de {N} artículos. No se puede deshacer." (con 0: "No está en ningún artículo.") / "Borrar". Los `post_tag` caen en cascada.

- **Editor de artículos (cambia, SPEC 19):** las etiquetas existentes viajan por slug.
  - `TagInput` pasa a manejar `ArticleTag[]` (`{ slug: string | null; name: string }`, `slug: null` = nueva).
  - Escribir un nombre que coincide sin mayúsculas ni tildes con el **nombre** de una etiqueta existente usa esa etiqueta (con su slug), no crea otra.
  - `FormData` manda `tagSlugs` (repetido, una por etiqueta existente) y `newTags` (repetido, una por nombre nuevo). Desaparece el campo `tags`.
  - `parseArticleForm`: `tagSlugs` deben pasar `isSlug`; `newTags` siguen las reglas de SPEC 19 (máx. 40, `slugify` no vacío). Entre las dos listas, máx. 5 y sin repetidos.
  - `replaceTags`: si algún slug de `tagSlugs` ya no existe en `tag` (se borró o fusionó en otra pestaña), devuelve `reason: "missing-tag"` y no cambia nada. `saveArticleAction` responde el toast "Una de las etiquetas ya no existe. Recargá la página." Un nombre nuevo cuyo `slugify` coincide con el slug o el nombre de una existente reutiliza esa etiqueta.

- **Blog público (cambia):**
  - `PostThumb` recibe `icon: CategoryIcon` en lugar de `category`. `BlogCategoryRow` suma `icon`.
  - `getPublicCategories()` nueva en `db/blog.ts`: categorías con al menos un artículo publicado, por `position`. `cachedCategories` pasa a usarla.
  - `/blog?categoria={slug sin publicados}` se trata como filtro inválido (muestra "Todos"), igual que un slug inexistente hoy.
  - `getCategories()` sigue devolviendo todas y la usan el panel y el filtro de `/admin/articles`.
  - `lib/blog-posts.ts`: `BlogCategoryTag` y `BlogTagSlug` se borran y sus usos pasan a `string`.

- **Seed (`db/seed/blog.ts`, `db/seed/blog-data.ts`):** categorías y etiquetas se insertan con `onConflictDoNothing` por `slug`. Correr el seed no pisa lo que editó el admin. `blogCategories` suma `icon`.

- **Server Actions:**
  - `actions/admin/categories/index.ts`: `saveCategoryAction(prev, data)` (crea sin `id`, edita con `id`), `moveCategoryAction(prev, data)` (`id`, `direction`) y `deleteCategoryAction(prev, data)`.
  - `actions/admin/tags/index.ts`: `saveTagAction(prev, data)`, `deleteTagAction(prev, data)`, `mergeTagsAction(prev, data)` (`sourceId`, `targetId`) y `searchTagOptionsAction({ query, excludeId })`.
  - Todas llaman a `requireAdmin()` antes de tocar la base y validan con Zod.
  - Si cambian algo: `updateTag("blog")`, `revalidatePath("/admin/articles")` y `revalidatePath` de su página.
  - Mensajes:

    | Caso                                  | Mensaje                                                                  |
    | ------------------------------------- | ------------------------------------------------------------------------ |
    | Categoría creada / guardada / borrada | "Categoría creada." / "Categoría actualizada." / "Categoría borrada."    |
    | Etiqueta creada / guardada / borrada  | "Etiqueta creada." / "Etiqueta actualizada." / "Etiqueta borrada."       |
    | Fusión                                | "Listo: {N} artículos pasaron a «{destino}»."                            |
    | Slug repetido (campo `slug`)          | "Ya hay una categoría con esa URL." / "Ya hay una etiqueta con esa URL." |
    | Nombre de etiqueta repetido (campo)   | "Ya hay una etiqueta con ese nombre. Usá «Fusionar con…» para unirlas."  |
    | Categoría con artículos al borrar     | "No se puede borrar: tiene {N} artículos."                               |
    | Id inexistente                        | "Esa categoría ya no existe." / "Esa etiqueta ya no existe."             |
    | Fusionar consigo misma                | "Elegí otra etiqueta."                                                   |
    | Error de base                         | "No pudimos guardar el cambio. Intentá de nuevo en unos minutos."        |

- **Diseño:** tablas, botones de orden, modales, selector de íconos, combobox de fusión y estados vacíos se hacen con `/frontend-design`, siguiendo `/admin/articles` y los tokens `cms-*`. Todos los controles miden 44 px o más y cumplen 4.5:1 de contraste. Por debajo de `md` las tablas pasan a tarjetas con `data-label`, como la de artículos. A 390 px no hay scroll horizontal y los modales ocupan la pantalla entera.

- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `__tests__/server/taxonomy-form.test.ts` y `__tests__/server/tag-params.test.ts`, nuevos; `article-form.test.ts` y `blog-posts.test.ts` ajustan casos.
  - Vitest `db`: `__tests__/db/admin-categories.test.ts`, `__tests__/db/admin-tags.test.ts` y `__tests__/db/taxonomy-actions.test.ts`, nuevos; `admin-posts.test.ts`, `admin-articles-actions.test.ts`, `blog-queries.test.ts` y `blog-seed.test.ts` suman casos.
  - Vitest `client`: `__tests__/client/category-dialog.test.tsx`, `__tests__/client/tag-dialog.test.tsx` y `__tests__/client/merge-tag-dialog.test.tsx`, nuevos; `tag-input.test.tsx`, `article-editor.test.tsx`, `admin-nav.test.tsx` y `post-thumb.test.tsx` ajustan casos.
  - Playwright: `e2e/categories.spec.ts` y `e2e/tags.spec.ts`, nuevos; `article-editor.spec.ts` sigue pasando.

**Fuera de alcance (para specs futuros):**

- Mover todos los artículos de una categoría a otra desde `/admin/categories` (por ahora se cambian uno por uno en el editor).
- Descripción, imagen o color de categoría, y páginas propias por categoría o etiqueta (`/blog/categoria/{slug}`).
- Redirects de slugs viejos y cambiar el slug de una categoría o etiqueta con artículos publicados.
- Íconos nuevos para categorías más allá de los 6 de la lista.
- Subcategorías o jerarquía de etiquetas.
- Selección múltiple en la tabla de etiquetas (borrar o fusionar varias a la vez).
- Arrastrar y soltar para ordenar categorías.
- Ordenar o filtrar la tabla de etiquetas por cantidad de artículos.
- Detección de ediciones concurrentes por `updatedAt` en categorías y etiquetas.
- SEO por categoría o etiqueta.

## Modelo de datos

Una migración nueva, `db/migrations/0006_categorias_y_etiquetas.sql` (generada con drizzle-kit y completada a mano con el relleno):

- Enum `category_icon`: `code`, `layers`, `cloud`, `sparkles`, `bolt`, `chat`.
- Columna `category.icon category_icon NOT NULL`. Relleno: `desarrollo-web` → `code`, `sistemas` → `layers`, `saas` → `cloud`, `ia` → `sparkles`, cualquier otra → `code`. Se agrega con default, se rellena y se quita el default.
- `CHECK category_slug_check`: `slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'` (las 4 actuales cumplen).
- `CHECK category_label_check` y `category_filter_label_check`: `length(trim(...)) > 0`.

`tag`, `post_tag` y `post` no cambian.

```ts
// db/schema/blog.ts (cambia)
export const categoryIcon = pgEnum("category_icon", [
  "code",
  "layers",
  "cloud",
  "sparkles",
  "bolt",
  "chat",
]);
// category suma: icon: categoryIcon().notNull()

// lib/blog-posts.ts (cambia)
export const CATEGORY_ICONS = [
  "code",
  "layers",
  "cloud",
  "sparkles",
  "bolt",
  "chat",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
export type BlogTag = { slug: string; name: string };
// BlogCategoryTag y BlogTagSlug se borran.

// components/icons.tsx (suma)
export const Folder: Icon; // barra lateral
export const Tag: Icon; // barra lateral
export const categoryIcons: Record<CategoryIcon, { Icon: Icon; label: string }>;
// code "Código", layers "Capas", cloud "Nube", sparkles "Destellos", bolt "Rayo", chat "Chat"

// db/blog.ts (cambia)
export type BlogCategoryRow = {
  slug: string;
  label: string;
  filterLabel: string;
  serviceSlug: ServiceSlug;
  icon: CategoryIcon;
};
export async function getPublicCategories(): Promise<BlogCategoryRow[]>; // con ≥ 1 publicado

// lib/admin/taxonomy-form.ts (nuevo, sin dependencias de servidor)
export const TAXONOMY_LIMITS = {
  categoryLabel: 40,
  tagName: 40,
  slug: 80,
} as const;
export type CategoryInput = {
  label: string;
  filterLabel: string;
  slug: string;
  serviceSlug: ServiceSlug;
  icon: CategoryIcon;
};
export type TagInput = { name: string; slug: string };
export type ParsedForm<T> =
  | { ok: true; id: string | null; input: T }
  | { ok: false; fieldErrors: Partial<Record<keyof T, string>> };
export function parseCategoryForm(data: FormData): ParsedForm<CategoryInput>;
export function parseTagForm(data: FormData): ParsedForm<TagInput>;

// lib/admin/tag-params.ts (nuevo, como article-params.ts)
export type AdminTagQuery = { q: string | null; page: number };
export const TAGS_PER_PAGE = 25;
export function parseTagParams(
  params: Record<string, string | string[] | undefined>,
): AdminTagQuery;
export function tagQueryHref(query: AdminTagQuery): string;

// db/admin-categories.ts (nuevo, "server-only", sin caché)
export type AdminCategoryRow = CategoryInput & {
  id: string;
  position: number;
  published: number;
  total: number;
};
export async function listAdminCategories(): Promise<AdminCategoryRow[]>; // por position
export type CategoryResult =
  | { ok: true; id: string; slug: string; previousSlug: string | null }
  | { ok: false; reason: "slug-taken" | "not-found" };
export async function createCategory(
  input: CategoryInput,
): Promise<CategoryResult>;
export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<CategoryResult>; // ignora input.slug con publicados
export async function moveCategory(
  id: string,
  direction: "up" | "down",
): Promise<
  { ok: true; position: number } | { ok: false; reason: "not-found" | "edge" }
>; // position 1-based en la lista
export async function deleteCategory(
  id: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "in-use"; total: number }
>;

// db/admin-tags.ts (nuevo, "server-only", sin caché)
export type AdminTagRow = {
  id: string;
  slug: string;
  name: string;
  published: number;
  total: number;
};
export type AdminTagList = {
  items: AdminTagRow[];
  total: number;
  page: number;
  pageCount: number;
};
export async function listAdminTags(
  query: AdminTagQuery,
): Promise<AdminTagList>;
export type TagResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; reason: "slug-taken" | "name-taken" | "not-found" };
export async function createTag(input: TagInput): Promise<TagResult>;
export async function updateTagRow(
  id: string,
  input: TagInput,
): Promise<TagResult>; // ignora input.slug con publicados
export async function deleteTag(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: "not-found" }>;
export async function mergeTags(
  sourceId: string,
  targetId: string,
): Promise<
  | { ok: true; moved: number; target: string }
  | { ok: false; reason: "not-found" | "same" }
>;
export async function searchTagOptions(
  query: string,
  excludeId: string,
): Promise<{ id: string; name: string; total: number }[]>; // máx. 10

// lib/admin/article-form.ts (cambia, SPEC 19)
export type ArticleTag = { slug: string | null; name: string }; // slug null = nueva
export type ArticleInput = {
  /* … SPEC 19 y 20, sin `tags` */
  tagSlugs: string[]; // existentes
  newTags: string[]; // nombres nuevos; tagSlugs + newTags ≤ 5
};

// db/admin-posts.ts (cambia)
// SavePostResult suma reason "missing-tag".
```

La función que edita una etiqueta se llama `updateTagRow` porque `updateTag` ya es la función de `next/cache` que usan las actions.

Archivos nuevos:

- `app/(admin)/admin/categories/`: `page.tsx`, `categories-table.tsx`, `category-dialog.tsx` y `category-order-buttons.tsx`.
- `app/(admin)/admin/tags/`: `page.tsx`, `tags-table.tsx`, `tags-search.tsx`, `tags-footer.tsx`, `tag-row-menu.tsx`, `tag-dialog.tsx` y `merge-tag-dialog.tsx`.
- `actions/admin/categories/index.ts`, `actions/admin/tags/index.ts`.
- `db/admin-categories.ts`, `db/admin-tags.ts`.
- `lib/admin/taxonomy-form.ts`, `lib/admin/tag-params.ts`.
- `db/migrations/0006_categorias_y_etiquetas.sql` y su snapshot.

Archivos que cambian: `db/schema/blog.ts`, `db/blog.ts`, `db/blog-cache.ts`, `db/admin-posts.ts`, `db/seed/blog.ts`, `db/seed/blog-data.ts`, `lib/blog-posts.ts`, `lib/admin/article-form.ts`, `actions/admin/articles/index.ts`, `components/icons.tsx`, `components/blog/post-thumb.tsx` y sus usos (`post-card.tsx`, `featured-post.tsx`, `article-hero.tsx`), `components/admin/nav-items.ts`, `components/admin/article-editor/tag-input.tsx` y `article-editor.tsx`.

Convenciones:

- El slug es la identidad pública (URL de los filtros) y el `id` la interna. El panel siempre opera por `id`.
- Nombre y slug de una etiqueta son independientes después de crearla. El slug nace de `slugify(nombre)`.
- Un slug con artículos publicados no cambia. El servidor ignora el slug enviado, igual que `updatePost` con un post ya publicado.
- Las consultas del panel no usan caché. Toda escritura invalida `blog` con `updateTag`, porque categorías y etiquetas salen en todas las páginas del blog.

## Plan de implementación

1. **Migración, tipos e íconos.** `category_icon`, `category.icon`, los `CHECK`, `CATEGORY_ICONS`, `categoryIcons`, `BlogCategoryRow.icon`, `PostThumb` por `icon`, borrar `BlogCategoryTag`/`BlogTagSlug` y seed con `onConflictDoNothing` e `icon`. Ajustar `post-thumb.test.tsx` y `blog-seed.test.ts`. Prueba: `npm run test:run` y `npm run test:db` pasan, `npm run build` termina y `/blog` se ve igual.
2. **Filtros públicos.** `getPublicCategories` y `cachedCategories`, con casos en `blog-queries.test.ts`. Prueba: `npm run test:db` pasa y `/blog` muestra los mismos 4 filtros con el seed.
3. **Etiquetas por slug en el editor.** `ArticleTag`, `tagSlugs`/`newTags` en `parseArticleForm`, `TagInput`, `article-editor.tsx`, `replaceTags` con `missing-tag` y el toast. Ajustar `article-form.test.ts`, `tag-input.test.tsx`, `article-editor.test.tsx`, `admin-posts.test.ts` y `admin-articles-actions.test.ts`. Prueba: `npm run test:run`, `npm run test:db` y `e2e/article-editor.spec.ts` pasan.
4. **Utilidades.** `lib/admin/taxonomy-form.ts` y `lib/admin/tag-params.ts`, con `taxonomy-form.test.ts` y `tag-params.test.ts`. Prueba: `npm run test:run` pasa.
5. **Categorías en la base.** `db/admin-categories.ts` y `actions/admin/categories/index.ts`, con `admin-categories.test.ts` y los casos de categorías de `taxonomy-actions.test.ts`. Prueba: `npm run test:db` pasa.
6. **Página de categorías.** Ícono `Folder`, ítems nuevos de la barra lateral (Categorías y Etiquetas, esta última con la página todavía vacía detrás de `requireAdmin()`), `/admin/categories`, tabla, botones de orden, modal y borrar. Diseño con `/frontend-design`. `category-dialog.test.tsx` y `admin-nav.test.tsx`. Prueba: `npm run test:run` pasa y con el seed se crea, edita, reordena y borra una categoría a mano.
7. **Etiquetas en la base.** `db/admin-tags.ts` y `actions/admin/tags/index.ts`, con `admin-tags.test.ts` y los casos de etiquetas de `taxonomy-actions.test.ts`. Prueba: `npm run test:db` pasa.
8. **Página de etiquetas.** Ícono `Tag`, `/admin/tags` con búsqueda, paginación, menú de fila, modal, fusionar y borrar. Diseño con `/frontend-design`. `tag-dialog.test.tsx` y `merge-tag-dialog.test.tsx`. Prueba: `npm run test:run` pasa y con el seed se renombra, fusiona y borra una etiqueta a mano.
9. **E2E.** `e2e/categories.spec.ts` y `e2e/tags.spec.ts`. Prueba: `npm run test:e2e` pasa completo.

## Criterios de aceptación

**General**

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa completo, con `blog.spec.ts` y `article-editor.spec.ts` sin cambios de comportamiento.
- [ ] `grep -rn "BlogCategoryTag\|BlogTagSlug" app components db lib __tests__ e2e` no devuelve nada.
- [ ] La barra lateral tiene, en "Contenido del blog", Artículos, Categorías, Etiquetas y Medios, en ese orden; "Categorías" está activa en `/admin/categories` y "Etiquetas" en `/admin/tags`.

**Migración y seed (`db`)**

- [ ] Después de migrar, `desarrollo-web`, `sistemas`, `saas` e `ia` tienen `icon` `code`, `layers`, `cloud` y `sparkles`.
- [ ] Insertar una categoría con slug `Mal Slug`, `label` vacío o un `icon` fuera del enum falla por la base.
- [ ] Cambiar el `label` de `sistemas` y las `position` y correr el seed otra vez deja el `label` y las `position` cambiados.
- [ ] Renombrar la etiqueta `seo` y correr el seed otra vez deja el nombre cambiado.

**Blog público**

- [ ] Con el seed, `/blog` muestra los mismos 4 filtros de categoría en el mismo orden y las miniaturas sin portada con el mismo ícono que antes.
- [ ] Una categoría sin artículos publicados no sale en los filtros de `/blog`; `/blog?categoria={su slug}` muestra "Todos".
- [ ] Un artículo publicado en una categoría nueva con ícono `bolt` muestra el ícono Rayo en su tarjeta sin portada, y la categoría sale como filtro con su "Texto del filtro".
- [ ] Reordenar categorías en el panel cambia el orden de los filtros de `/blog` sin reiniciar el servidor.
- [ ] Renombrar una etiqueta en el panel cambia el nombre en las tarjetas, en el artículo y en el filtro de `/blog`.

**Utilidades (`server`)**

- [ ] `parseCategoryForm` sin nombre, con un nombre de 41 caracteres, slug `Mal Slug`, servicio `otro` o ícono `star` devuelve el error en el campo correspondiente.
- [ ] `parseCategoryForm` con "Texto del filtro" vacío lo rechaza (el cliente lo autocompleta; el servidor no).
- [ ] `parseTagForm` sin nombre, con 41 caracteres o con un nombre que da `slugify` vacío (`"¡¿?!"`) devuelve error en `name`.
- [ ] `parseTagParams({ q: "  seo ", page: "2" })` devuelve `{ q: "seo", page: 2 }`; `page: "0"`, `page: "abc"` y una `q` de 101 caracteres caen a los valores por defecto o se recortan como en `article-params`.
- [ ] `parseArticleForm` con `tagSlugs=["seo"]` y `newTags=["Nueva"]` devuelve las dos listas; con 3 slugs y 3 nombres, error "Podés usar hasta 5 etiquetas."; con `tagSlugs=["Mal Slug"]`, error en `tags`.

**Categorías (`admin-categories.test.ts`, `taxonomy-actions.test.ts`)**

- [ ] `createCategory` guarda la categoría con `position` = la última + 1.
- [ ] `createCategory` y `updateCategory` con un slug que ya usa otra categoría devuelven `slug-taken` y no cambian nada.
- [ ] `updateCategory` sobre una categoría con artículos publicados ignora un slug distinto y devuelve `previousSlug: null`; sin publicados cambia el slug y devuelve el anterior.
- [ ] `moveCategory("down")` sobre la primera la intercambia con la segunda; `"up"` sobre la primera devuelve `edge` y no cambia nada.
- [ ] `deleteCategory` sobre una categoría con un borrador devuelve `in-use` con `total: 1`; sin artículos la borra.
- [ ] `listAdminCategories` devuelve `published` y `total` correctos con borradores y publicados mezclados.
- [ ] Cada action llama a `requireAdmin()` antes de tocar la base y, si cambió algo, a `updateTag("blog")`, `revalidatePath("/admin/categories")` y `revalidatePath("/admin/articles")`.
- [ ] Las actions devuelven los mensajes de la tabla de mensajes para crear, guardar, borrar, slug repetido, categoría con artículos e id inexistente.

**Etiquetas (`admin-tags.test.ts`, `taxonomy-actions.test.ts`)**

- [ ] `listAdminTags` ordena por nombre sin distinguir mayúsculas, pagina de a 25, busca por nombre o slug, y `q: "50%"` no devuelve todas.
- [ ] `createTag` con un nombre cuyo `slugify` coincide con el de otra (`"Seo"` con `SEO` existente) devuelve `name-taken`; con un slug ocupado, `slug-taken`.
- [ ] `updateTagRow` cambia el nombre de `seo` a "Posicionamiento" y el slug sigue siendo `seo` (tiene publicados).
- [ ] `updateTagRow` sobre una etiqueta sin publicados cambia el slug.
- [ ] `mergeTags(A, B)` con un artículo que tiene A y B y otro que tiene solo A deja los dos con B una sola vez, borra A y devuelve `moved: 2`.
- [ ] `mergeTags(A, A)` devuelve `same`; con un id inexistente, `not-found`; en los dos casos no cambia nada.
- [ ] `deleteTag` borra la etiqueta y sus `post_tag`; los artículos siguen existiendo.
- [ ] `searchTagOptions("se", idDeSeo)` no devuelve `seo` y devuelve como mucho 10.
- [ ] Las actions llaman a `requireAdmin()` primero, invalidan `blog`, `/admin/tags` y `/admin/articles`, y devuelven los mensajes de la tabla.

**Editor (`admin-posts.test.ts`, `admin-articles-actions.test.ts`)**

- [ ] Renombrar la etiqueta `seo` a "Posicionamiento" y guardar un artículo con `tagSlugs=["seo"]` no crea ninguna etiqueta nueva y el artículo sigue con `seo`.
- [ ] Guardar con `tagSlugs=["borrada"]` (inexistente) devuelve `missing-tag`, no cambia nada y la action responde "Una de las etiquetas ya no existe. Recargá la página.".
- [ ] Guardar con `newTags=["seo"]` cuando ya existe la etiqueta `seo` reutiliza esa, no crea otra.

**Componentes (`client`)**

- [ ] `CategoryDialog` al crear: escribir "Marketing digital" llena "Texto del filtro" con lo mismo y "URL" con `marketing-digital`; editar el slug a mano corta el seguimiento.
- [ ] `CategoryDialog` con una categoría con publicados muestra "URL" de solo lectura con su nota.
- [ ] `CategoryDialog` sin servicio ni ícono muestra los dos errores y pone el foco en "Servicio del CTA".
- [ ] El selector de ícono es un `radiogroup` que se recorre con flechas y cada opción tiene su nombre accesible ("Código", "Rayo"…).
- [ ] `TagDialog` con una etiqueta con publicados muestra "URL" de solo lectura con su nota.
- [ ] `MergeTagDialog` deshabilita "Fusionar" hasta elegir destino y muestra "Los {N} artículos de «{origen}» pasan a «{destino}»…".
- [ ] `TagInput` con la opción `{ slug: "seo", name: "Posicionamiento" }`: escribir "posicionamiento" y `Enter` agrega el chip con `slug: "seo"` y no muestra "Crear «posicionamiento»".

**Categorías (E2E, `categories.spec.ts`)**

- [ ] "Categorías" en la barra lateral lleva a `/admin/categories` con las 4 del seed en orden.
- [ ] "Nueva categoría" con nombre, servicio e ícono muestra "Categoría creada." y la categoría queda última en la tabla.
- [ ] La categoría nueva aparece en el select "Categoría" del editor de artículos; un artículo publicado con ella hace aparecer el filtro en `/blog`.
- [ ] Con ese artículo publicado, "Editar" muestra la URL de solo lectura.
- [ ] "Bajar" sobre la primera la deja segunda después de recargar, y el orden de los filtros de `/blog` cambia igual.
- [ ] "Borrar" está deshabilitado en una categoría con artículos y muestra "Tiene {N} artículos…"; en una sin artículos pide confirmación y la borra.
- [ ] Sin sesión, `/admin/categories` redirige a `/cuenta/login`.
- [ ] A 390 px no hay scroll horizontal y el modal ocupa la pantalla.

**Etiquetas (E2E, `tags.spec.ts`)**

- [ ] "Etiquetas" en la barra lateral lleva a `/admin/tags` con las etiquetas del seed en orden alfabético y su conteo de artículos.
- [ ] Buscar "seo" deja solo las que coinciden y la URL queda en `/admin/tags?q=seo`; una búsqueda sin resultados muestra el estado vacío.
- [ ] "Nueva etiqueta" crea una etiqueta con 0 artículos que aparece en el autocompletado del editor.
- [ ] Renombrar `seo` a "Posicionamiento" cambia el nombre en el artículo publicado sin cambiar `/blog?etiqueta=seo`; después, editar y guardar ese artículo no crea otra etiqueta.
- [ ] "Fusionar con…" de una etiqueta hacia otra muestra "Listo: {N} artículos pasaron a «{destino}».", la origen desaparece de la tabla y de `/blog`, y sus artículos muestran la destino.
- [ ] "Borrar" pide confirmación con la cantidad de artículos y la etiqueta deja de salir en los artículos y en `/blog`.
- [ ] Sin sesión, `/admin/tags` redirige a `/cuenta/login`.
- [ ] A 390 px no hay scroll horizontal.
- [ ] El texto, los botones, los errores y los modales de las dos páginas cumplen 4.5:1 de contraste y todos los controles miden 44 px o más (revisado con `/frontend-design`).

## Decisiones

- **Sí:** CRUD completo de categorías (crear, editar, reordenar, borrar). Elegido por el usuario.
- **No:** solo editar textos de las 4 fijas. Deja al blog atado al seed.
- **Sí:** etiquetas con crear, renombrar, fusionar y borrar. Elegido por el usuario.
- **Sí:** dos páginas, `/admin/categories` y `/admin/tags`, con dos ítems en la barra lateral. Elegido por el usuario.
- **No:** una página con pestañas. Mezcla dos tablas con reglas distintas.
- **Sí:** editar en un modal sobre la tabla. Elegido por el usuario.
- **No:** página propia por categoría o edición en línea. Los formularios son cortos; en línea es más difícil de hacer accesible.
- **Sí:** el ícono de la miniatura se elige de una lista fija de 6 íconos que ya existen, en una columna `category.icon` con enum. Elegido por el usuario.
- **No:** un ícono genérico para las categorías nuevas. Todas las nuevas se verían iguales.
- **Sí:** el slug de categorías y etiquetas se puede cambiar solo mientras no tengan artículos publicados. Elegido por el usuario. Es la misma regla que el slug de los artículos (SPEC 19).
- **No:** slug siempre editable. Rompe enlaces compartidos a filtros y no hay redirects.
- **Sí:** una categoría se borra solo si no tiene artículos, ni borradores. Elegido por el usuario. `post.category_id` ya es `RESTRICT`.
- **No:** mover los artículos a otra categoría al borrar. Queda para otro spec si hace falta.
- **Sí:** reordenar con botones "Subir" y "Bajar" que guardan al instante. Elegido por el usuario.
- **No:** arrastrar y soltar. Suma una librería y necesita una alternativa de teclado igual.
- **Sí:** se mantienen `label` y `filter_label`; el segundo sigue al primero en el modal hasta que se edita. Elegido por el usuario.
- **No:** unificar en una columna. Toca el blog público sin necesidad.
- **Sí:** tabla de etiquetas con búsqueda y paginación por número de página, 25 por página, estado en la URL. Elegido por el usuario (búsqueda y paginación) y con el modelo de `/admin/articles` (número de página).
- **No:** el cursor de SPEC 12. Codifica fecha e id y la tabla se ordena por nombre.
- **Sí:** fusionar desde la fila de la etiqueta origen, eligiendo el destino en un combobox. Elegido por el usuario.
- **No:** selección múltiple. Más estado en la tabla para un caso poco frecuente.
- **Sí:** el editor manda el slug de las etiquetas existentes y el nombre de las nuevas. Elegido por el usuario. Sin esto, renombrar una etiqueta haría que el próximo guardado de un artículo creara otra.
- **No:** slug siempre igual a `slugify(nombre)`. Con artículos publicados solo se podría cambiar mayúsculas o tildes.
- **Sí:** nombre de etiqueta único a nivel aplicación (por `slugify(name)`), con mensaje que sugiere fusionar. Con nombre y slug independientes, el autocompletado del editor necesita que no haya dos "SEO".
- **No:** `UNIQUE` en la base sobre el nombre normalizado. La normalización vive en `slugify` (TypeScript) y un índice por expresión no la replica exacta.
- **Sí:** el seed inserta categorías y etiquetas solo si faltan. Elegido por el usuario. Correrlo no pisa lo editado en el panel.
- **Sí:** el blog público solo muestra categorías con algún artículo publicado. Elegido por el usuario. Es lo mismo que ya pasa con las etiquetas.
- **Sí:** el servicio del CTA se elige entre los 4 `services` de código. Los servicios no viven en la base.
- **Sí:** toda escritura invalida `blog` con `updateTag`. Categorías y etiquetas salen en el listado, en cada artículo y en los filtros.
- **No:** detectar ediciones concurrentes por `updatedAt` en categorías y etiquetas. Los formularios son cortos y hay un solo admin; el artículo sí lo necesita por el texto largo.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.

## Riesgos

| Riesgo                                                                                                   | Mitigación                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Abrir `BlogCategoryTag` y `BlogTagSlug` a `string` deja algún `Record` por slug sin entrada.             | `PostThumb` pasa a leer `icon`; el `grep` de los criterios verifica que no quede ningún uso y `tsc` marca los accesos.                  |
| La migración deja una categoría sin ícono o con uno equivocado.                                          | Relleno explícito por slug con `code` para cualquier otra, y la columna termina `NOT NULL`; test `db` de los 4 íconos.                  |
| Renombrar una etiqueta hace que el editor cree una duplicada.                                            | El editor manda slugs para las existentes (paso 3, antes de las páginas nuevas) y un test `db` guarda un artículo después de renombrar. |
| Una etiqueta se borra o fusiona mientras el editor está abierto en otra pestaña.                         | `replaceTags` devuelve `missing-tag` y la action pide recargar sin guardar nada.                                                        |
| Fusionar deja un artículo con la etiqueta destino dos veces.                                             | `onConflictDoNothing` sobre la clave primaria de `post_tag`; test `db` con un artículo que tiene las dos.                               |
| Reordenar a la vez en dos pestañas deja dos categorías con la misma `position`.                          | El intercambio va en una transacción; con posiciones repetidas el orden desempata por `id` y el próximo "Subir"/"Bajar" lo corrige.     |
| Ocultar categorías sin publicados cambia una URL compartida de `/blog?categoria=…` a "Todos".            | Solo pasa con categorías sin artículos publicados, que hoy no existen; la URL no da error.                                              |
| El seed con `onConflictDoNothing` no actualiza datos de desarrollo que antes se corregían al re-sembrar. | Es el comportamiento elegido; para restablecer, se borra la base de desarrollo y se vuelve a migrar.                                    |
| Leer `searchParams` o la base fuera de `<Suspense>` rompe el build con Cache Components.                 | Toda lectura va dentro del `<Suspense>` de la página; el build sin `DATABASE_URL` lo prueba.                                            |

## Qué **no** incluye este spec

- Mover en bloque los artículos de una categoría a otra.
- Descripción, imagen, color o página propia de categorías y etiquetas.
- Cambiar slugs con artículos publicados y redirects.
- Íconos de categoría más allá de los 6 de la lista.
- Jerarquías, selección múltiple y arrastrar y soltar.
- Control de ediciones concurrentes en categorías y etiquetas.
- SEO por categoría o etiqueta.

Cada uno de estos, si llega, va en su propio spec.
