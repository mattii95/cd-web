# SPEC 17 — Módulo de artículos del panel

> **Estado:** Implementado
> **Depende de:** SPEC 09, SPEC 13, SPEC 16
> **Fecha:** 2026-11-17
> **Objetivo:** Que el admin vea todos los artículos en `/admin/articles` en una tabla con pestañas por estado, búsqueda, filtros, orden y paginación numerada, y pueda publicarlos, pasarlos a borrador o eliminarlos, siempre con un modal de confirmación, con todas las rutas del panel en inglés.

## Por qué existe este spec

SPEC 16 dejó `/admin/articulos` con un estado vacío. El artboard "Artículos" del canvas [CMS Courroux Digital](https://claude.ai/artifact/QnCCtdB9JaPEQ7nf84dVgA) (`Main.dc.html`) define la tabla: pestañas con contador, búsqueda, filtros, columnas, menú "Más acciones" y paginación con "Filas por página".

El canvas también muestra cosas que la base no tiene (estado "Programado", "Destacado") o que dependen del editor ("Nuevo artículo", "Editar"). Este spec toma solo lo que funciona con el esquema de SPEC 09.

Además, las URLs del CMS pasan a inglés (rutas y query params). Como este spec suma la primera página con parámetros de URL, aprovecha para renombrar las tres rutas existentes y que el panel tenga una sola convención. Los textos de la interfaz siguen en español.

**Referencias:**

- Canvas, artboard "Artículos" (`Main.dc.html`): barra de pestañas, barra de filtros `bg-cms-panel-alt`, tabla, badges de estado, pie con "Mostrando…", "Filas por página" y paginación.
- `node_modules/next/dist/docs/01-app/` sobre `searchParams` en páginas, `useRouter`/`useSearchParams` y Cache Components (lectura dinámica dentro de `<Suspense>`), y sobre `updateTag` y `revalidatePath`.
- `db/blog.ts` y `db/blog-cache.ts` (tags `blog` y `post:{slug}`), `db/media.ts`, `actions/admin/medios/index.ts`, `components/admin/toast.tsx` (`notify`), `lib/format-date.ts`, `app/(admin)/admin/usuarios/page.tsx` (tabla apilada en móvil con `data-label`).

## Alcance

**Incluye:**

- **Rutas del panel en inglés.** Se renombran carpetas, enlaces, `revalidatePath` y tests. Las rutas viejas desaparecen (404), sin redirects:

  | Antes              | Después           | Carpeta nueva                 |
  | ------------------ | ----------------- | ----------------------------- |
  | `/admin`           | `/admin`          | `app/(admin)/admin/`          |
  | `/admin/articulos` | `/admin/articles` | `app/(admin)/admin/articles/` |
  | `/admin/medios`    | `/admin/media`    | `app/(admin)/admin/media/`    |
  | `/admin/usuarios`  | `/admin/users`    | `app/(admin)/admin/users/`    |
  - Las actions siguen la convención de SPEC 16 (la carpeta replica la URL): `actions/admin/medios/index.ts` pasa a `actions/admin/media/index.ts` (`@/actions/admin/media`), sin cambiar su código salvo `revalidatePath("/admin/media")` y el import de `card-item`.
  - Se actualizan `components/admin/nav-items.ts` (tipo `href` y valores), las tarjetas de `app/(admin)/admin/page.tsx`, y los tests que nombran rutas o importan de `@/app/(admin)/admin/medios/…` o `@/actions/admin/medios`.
  - `proxy.ts` (`/admin/:path*`), `lib/back-href.ts` (`/admin`) y el enlace "Administración" del menú del sitio (`/admin`) no cambian.
  - Las etiquetas visibles ("Artículos", "Medios", "Usuarios") siguen en español.

- **Query params de `/admin/articles`** (todos opcionales; un valor inválido cae al default sin error):

  | Param      | Valores                               | Default   | Qué hace                                           |
  | ---------- | ------------------------------------- | --------- | -------------------------------------------------- |
  | `status`   | `published` \| `draft`                | (todos)   | Pestaña activa                                     |
  | `q`        | texto, se recorta a 100 caracteres    | —         | Busca en título y slug, sin distinguir mayúsculas  |
  | `category` | slug de categoría                     | (todas)   | Filtra por categoría                               |
  | `updated`  | `7d` \| `30d` \| `year`               | (todas)   | `updated_at` en los últimos 7 / 30 días o este año |
  | `sort`     | `title` \| `readingTime` \| `updated` | `updated` | Columna de orden                                   |
  | `dir`      | `asc` \| `desc`                       | `desc`    | Dirección                                          |
  | `page`     | entero ≥ 1                            | `1`       | Página; si supera la última, se muestra la última  |
  | `perPage`  | `10` \| `25` \| `50`                  | `25`      | Filas por página                                   |
  - `published`/`draft` se traducen a los valores de la base `publicado`/`borrador` solo en `lib/admin/article-params.ts`.
  - Cambiar pestaña, búsqueda, filtro, orden o `perPage` vuelve a `page=1`. Los params con su valor default no se escriben en la URL.

- **Página `/admin/articles` (`app/(admin)/admin/articles/page.tsx`):**
  - `AdminPageHeader` con título "Artículos" y bajada "Creá, editá y publicá las notas del blog.". Sin "Exportar" ni "Nuevo artículo".
  - Dentro de un `<Suspense>` (con esqueleto de tabla): `requireAdmin()`, lectura de `searchParams`, `parseArticleParams`, `listAdminPosts` y `getCategories()`.
  - Un panel blanco (`bg-cms-panel`, borde `cms-line`) con, de arriba abajo: pestañas, barra de filtros, tabla y pie.
- **Pestañas (`status-tabs.tsx`, servidor):** "Todos N", "Publicados N", "Borradores N". Cada una es un `<Link>` que conserva los demás filtros. La activa lleva `aria-current="page"` y el estilo del canvas. Los contadores son totales de la base, sin aplicar búsqueda ni filtros.
- **Barra de filtros (`article-filters.tsx`, cliente):**
  - Input de búsqueda con `<label>` "Buscar" (visible u oculto como el canvas) e ícono; actualiza `q` con `router.replace` 300 ms después de dejar de escribir, sin recargar el scroll.
  - Select "Categoría": "Todas" + las categorías de la base por `position`, con su `label`.
  - Select "Actualizado": "Cualquier fecha", "Últimos 7 días", "Últimos 30 días", "Este año".
  - Los selects aplican el cambio al elegir.
  - "Limpiar filtros" aparece solo si hay `q`, `category` o `updated`, y los quita (conserva `status`, `sort`, `dir` y `perPage`).
- **Tabla (`articles-table.tsx`, servidor):**
  - `<table>` con `aria-label="Listado de artículos"` y cabecera `bg-cms-head` como Usuarios.
  - Columnas: **Título** (título y debajo `/blog/{slug}` en `text-cms-muted`), **Categoría** (chip `bg-cms-chip`), **Estado** (badge "Publicado" o "Borrador"), **Lectura** ("6 min"), **Actualizado** (`formatDate(updatedAt)`), **Acciones**.
  - Título, Lectura y Actualizado son ordenables: la cabecera es un `<Link>` con flecha y el `<th>` lleva `aria-sort` (`ascending`/`descending` en la activa, `none` en las otras dos). Clic en la columna activa invierte `dir`; en otra columna la activa con `asc` para Título y `desc` para Lectura y Actualizado.
  - Sin checkboxes ni botón "Editar".
  - En móvil cada fila se apila con `data-label`, como Usuarios.
  - Estados vacíos dentro del panel: sin artículos en la base, "Todavía no hay artículos."; con filtros sin resultados, "Ningún artículo coincide con los filtros." y un enlace "Limpiar filtros".
- **Pie (`articles-footer.tsx`):** "Mostrando 1–25 de 37 artículos" (singular "1 artículo"), select "Filas por página" (10/25/50, cliente) y `<nav aria-label="Paginación">` con "Anterior", números de página y "Siguiente" como `<Link>`. La página actual con `aria-current="page"`. Con más de 7 páginas se muestran primera, última, la actual ±1 y "…". "Anterior"/"Siguiente" se deshabilitan (sin `href`, `aria-disabled="true"`) en los extremos. Con una sola página no hay `<nav>`.
- **Menú de fila (`row-menu.tsx`, cliente):** botón de ícono "Más acciones" (`aria-label="Más acciones: {título}"`, `aria-haspopup="menu"`, `aria-expanded`), 44 × 44 px. Se cierra con `Escape`, clic afuera o al elegir. Opciones:

  | Opción           | Visible en  | Hace                                                                  |
  | ---------------- | ----------- | --------------------------------------------------------------------- |
  | Ver en el blog   | `publicado` | Enlace a `/blog/{slug}` en otra pestaña (`rel="noopener"`), sin modal |
  | Publicar         | `borrador`  | Abre el modal de publicar                                             |
  | Pasar a borrador | `publicado` | Abre el modal de pasar a borrador                                     |
  | Eliminar         | siempre     | Abre el modal de eliminar (tono peligro)                              |

- **Modal de confirmación (`components/admin/confirm-dialog.tsx`, cliente, reusable):**
  - `<dialog>` nativo abierto con `showModal()`, con título (`aria-labelledby`), descripción (`aria-describedby`), "Cancelar" y el botón de confirmar.
  - Al abrir, el foco va a "Cancelar". `Escape`, "Cancelar" o clic en el fondo lo cierran. Al cerrar, el foco vuelve al botón que lo abrió.
  - Mientras la acción corre, el botón de confirmar muestra spinner y su texto de espera, y los dos botones quedan deshabilitados; `Escape` no cierra.
  - Tono `danger`: botón de confirmar rojo con contraste 4.5:1.
  - Textos:

    | Acción           | Título                   | Descripción                                                                         | Botón              | Espera        |
    | ---------------- | ------------------------ | ----------------------------------------------------------------------------------- | ------------------ | ------------- |
    | Publicar         | "¿Publicar el artículo?" | "«{título}» va a aparecer en el blog."                                              | "Publicar"         | "Publicando…" |
    | Pasar a borrador | "¿Pasar a borrador?"     | "«{título}» deja de verse en el blog. Sus comentarios y valoraciones se conservan." | "Pasar a borrador" | "Guardando…"  |
    | Eliminar         | "¿Eliminar el artículo?" | "Se borra «{título}» con sus valoraciones y comentarios. No se puede deshacer."     | "Eliminar"         | "Eliminando…" |
    | Borrar imagen    | "¿Borrar la imagen?"     | "Se borra el archivo y no se puede deshacer."                                       | "Borrar"           | "Borrando…"   |

  - Al terminar, el modal se cierra y el resultado sale como toast (`notify`).

- **Medios adopta el modal:** en `media-card.tsx`, `DeleteControl` reemplaza el "¿Borrar? Sí / No" en línea por el botón de ícono "Borrar", que abre `ConfirmDialog` con tono `danger`. La lógica de "En uso" (botón deshabilitado) y el toast no cambian. Editar el texto alternativo no lleva modal.
- **Server Actions (`actions/admin/articles/index.ts`):** `publishPostAction`, `unpublishPostAction` y `deletePostAction`, con firma `(prev: FormState, data: FormData) => Promise<FormState>` y el `id` en `data`.
  - Cada una llama a `requireAdmin()`, valida `id` con zod (`z.uuid()`) y llama a la función de `db/admin-posts.ts`.
  - Si cambió algo: `updateTag("blog")`, `updateTag(\`post:${slug}\`)`y`revalidatePath("/admin/articles")`.
  - Mensajes: "Artículo publicado.", "Artículo pasado a borrador.", "Artículo eliminado.". Si el id no existe: "Ese artículo ya no existe.". Error de base: "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.".
  - Publicar un artículo ya publicado (o pasar a borrador uno en borrador) no falla: devuelve el mismo mensaje de éxito sin escribir.
- **Consultas (`db/admin-posts.ts`, `server-only`, sin caché):** `listAdminPosts`, `setPostStatus` y `deletePost` (firmas en el modelo de datos).
  - Búsqueda: `ILIKE` sobre `title` y `slug` con `%`, `_` y `\` escapados.
  - Orden: `title` por `lower(title)`, `readingTime` por `reading_minutes`, `updated` por `updated_at`; siempre con `id` como desempate en la misma dirección.
  - `year`: `updated_at >= date_trunc('year', now())`.
  - Paginación por `limit`/`offset`, con el `total` de la misma consulta filtrada.
  - `setPostStatus(id, "publicado")` fija `published_at = now()` solo si está vacío; `"borrador"` no toca `published_at`. `updated_at` se actualiza por `$onUpdate`.
  - `deletePost` borra la fila; `post_tag`, `post_rating`, `comment` y `comment_vote` se van por cascade.
- **Parseo de params (`lib/admin/article-params.ts`):** `parseArticleParams` (de `searchParams` a `AdminPostQuery`) y `articlesHref` (de un `AdminPostQuery` parcial a la URL, omitiendo defaults). Sin dependencias de servidor, para testearlo en `server`.
- **Navegación:** `nav-items.ts` con las rutas nuevas; "Artículos" sigue activo en `/admin/articles` con cualquier query.
- **Diseño:** pestañas, filtros, tabla, badges, pie, menú de fila, modal y el nuevo control de borrado de Medios se hacen con `/frontend-design`, siguiendo el canvas y los tokens `cms-*`. Todos los controles miden 44 px o más. A 390 px no hay scroll horizontal de página.
- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `__tests__/server/article-params.test.ts`, nuevo.
  - Vitest `db`: `__tests__/db/admin-posts.test.ts` (consultas) y `__tests__/db/admin-articles-actions.test.ts` (actions, con `next/cache` y `requireAdmin` mockeados), nuevos.
  - Vitest `client`: `__tests__/client/confirm-dialog.test.tsx` y `__tests__/client/row-menu.test.tsx`, nuevos. `media-grid.test.tsx` cambia imports y mocks a `media` y prueba el borrado con el modal. `admin-nav.test.tsx` usa las rutas nuevas.
  - Playwright: `e2e/articles.spec.ts`, nuevo. `admin.spec.ts`, `auth.spec.ts` y `medios.spec.ts` se ajustan a las rutas nuevas y al modal de Medios.

**Fuera de alcance (para specs futuros):**

- El editor de artículos, "Nuevo artículo" y el botón "Editar".
- Estado "Programado" (publicación futura) y la marca "Destacado", con su filtro y badge: necesitan migración y cambios en el blog público.
- Selección múltiple y acciones en lote.
- "Exportar".
- Ordenar por Categoría o Estado.
- Contadores de pestañas que respeten la búsqueda y los filtros.
- Redirects de las rutas viejas en español.
- Modal de confirmación al guardar el texto alternativo en Medios.
- Categorías, SEO y Ajustes del canvas.

## Modelo de datos

No hay tablas, columnas ni migraciones nuevas. Se usa el esquema de SPEC 09 (`post`, `category`, `post_tag`, `post_rating`, `comment`, `comment_vote`).

```ts
// lib/admin/article-params.ts
export type ArticleStatusParam = "published" | "draft";
export type ArticleSort = "title" | "readingTime" | "updated";
export type SortDir = "asc" | "desc";
export type UpdatedRange = "7d" | "30d" | "year";
export const PER_PAGE_OPTIONS = [10, 25, 50] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];

export type AdminPostQuery = {
  status: ArticleStatusParam | null;
  q: string | null; // recortado, máx. 100, null si queda vacío
  category: string | null; // slug
  updated: UpdatedRange | null;
  sort: ArticleSort; // default "updated"
  dir: SortDir; // default "desc"
  page: number; // ≥ 1
  perPage: PerPage; // default 25
};

export function parseArticleParams(
  sp: Record<string, string | string[] | undefined>,
): AdminPostQuery;
// Mezcla `patch` sobre `base`, vuelve a page 1 si cambió algo distinto de `page`,
// y omite de la URL los valores default.
export function articlesHref(
  base: AdminPostQuery,
  patch: Partial<AdminPostQuery>,
): string; // "/admin/articles?status=draft&sort=title&dir=asc"

// db/admin-posts.ts ("server-only")
export type AdminPostRow = {
  id: string;
  slug: string;
  title: string;
  category: { slug: string; label: string };
  status: "borrador" | "publicado";
  readingMinutes: number;
  updatedAt: Date;
  publishedAt: Date | null;
};
export type AdminPostList = {
  items: AdminPostRow[];
  total: number; // con filtros
  page: number; // ya acotada a [1, pageCount]
  pageCount: number; // ≥ 1
  counts: { all: number; publicado: number; borrador: number }; // sin filtros
};
export async function listAdminPosts(
  query: AdminPostQuery,
): Promise<AdminPostList>;
// null si el id no existe; `changed` false si ya tenía ese estado.
export async function setPostStatus(
  id: string,
  status: "borrador" | "publicado",
): Promise<{ slug: string; changed: boolean } | null>;
export async function deletePost(id: string): Promise<{ slug: string } | null>;

// actions/admin/articles/index.ts ("use server")
export async function publishPostAction(
  prev: FormState,
  data: FormData,
): Promise<FormState>;
export async function unpublishPostAction(
  prev: FormState,
  data: FormData,
): Promise<FormState>;
export async function deletePostAction(
  prev: FormState,
  data: FormData,
): Promise<FormState>;

// components/admin/confirm-dialog.tsx ("use client")
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  tone?: "default" | "danger";
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): React.ReactNode;

// components/admin/nav-items.ts
href: "/admin" | "/admin/articles" | "/admin/media" | "/admin/users";
```

Archivos de `app/(admin)/admin/articles/`: `page.tsx`, `status-tabs.tsx`, `article-filters.tsx`, `articles-table.tsx`, `articles-footer.tsx`, `per-page-select.tsx` (cliente) y `row-menu.tsx` (cliente).

Convenciones:

- Las rutas y los query params del panel van en inglés; los textos visibles, en español.
- Los valores de la base (`publicado`, `borrador`) no aparecen en la URL: `lib/admin/article-params.ts` los traduce.
- Las consultas del panel no se cachean: el admin ve siempre la base actual. Las actions invalidan las cachés públicas (`blog`, `post:{slug}`).
- Toda acción del panel que cambia o borra datos desde un menú o un ícono pasa por `ConfirmDialog`.

## Plan de implementación

1. **Rutas en inglés.** Mover `articulos`, `medios` y `usuarios` a `articles`, `media` y `users`; `actions/admin/medios` a `actions/admin/media`; actualizar `nav-items.ts`, las tarjetas del Inicio, `revalidatePath`, imports, `vi.mock` y E2E (`admin.spec.ts`, `auth.spec.ts`, `medios.spec.ts`). Prueba: `npx tsc --noEmit`, `npm run test:run` y `npm run test:e2e` pasan, y `grep -rn "admin/articulos\|admin/medios\|admin/usuarios" app actions components lib __tests__ e2e` no devuelve nada.
2. **Params.** `lib/admin/article-params.ts` y `article-params.test.ts`. Prueba: `npm run test:run` pasa.
3. **Consultas.** `db/admin-posts.ts` y `admin-posts.test.ts`. Prueba: `npm run test:db` pasa.
4. **Tabla de solo lectura.** `page.tsx`, pestañas, filtros, tabla con orden, pie y paginación, reemplazando el estado vacío de SPEC 16. Revisar con `/frontend-design`. Prueba: `npm run build` sin `DATABASE_URL` pasa y con el seed la tabla filtra, ordena y pagina por URL.
5. **Modal.** `ConfirmDialog` y `confirm-dialog.test.tsx`. Medios lo adopta y se ajusta `media-grid.test.tsx`. Revisar con `/frontend-design`. Prueba: `npm run test:run` pasa.
6. **Acciones.** `actions/admin/articles/index.ts`, `admin-articles-actions.test.ts`, `row-menu.tsx` y `row-menu.test.tsx`. Prueba: `npm run test:run` y `npm run test:db` pasan.
7. **E2E.** `e2e/articles.spec.ts` y ajuste del borrado en `medios.spec.ts`. Prueba: `npm run test:e2e` pasa completo, incluido `blog.spec.ts`.

## Criterios de aceptación

**General**

- [x] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [x] `npm run test:db` pasa con Docker levantado.
- [x] `npm run test:e2e` pasa completo.

**Rutas**

- [x] Existen `/admin/articles`, `/admin/media` y `/admin/users`, y la barra lateral y las tarjetas del Inicio llevan a ellas.
- [x] `/admin/articulos`, `/admin/medios` y `/admin/usuarios` responden 404 a un admin.
- [x] No existen `app/(admin)/admin/articulos/`, `medios/`, `usuarios/` ni `actions/admin/medios/`.
- [x] `grep -rn "admin/articulos\|admin/medios\|admin/usuarios" app actions components lib __tests__ e2e` no devuelve nada.
- [x] Sin sesión, `/admin/articles`, `/admin/media` y `/admin/users` redirigen a `/cuenta/login` con `volver` igual a la ruta pedida; con un lector, responden 404.
- [x] `/admin/media` sube, edita el alt y borra imágenes (`medios.spec.ts`).
- [x] `AdminNav` en `/admin/articles?status=draft` marca "Artículos" con `aria-current="page"`.

**Params (`article-params.test.ts`)**

- [x] `parseArticleParams({})` devuelve `status`, `q`, `category` y `updated` en `null`, `sort: "updated"`, `dir: "desc"`, `page: 1` y `perPage: 25`.
- [x] `status=archived`, `sort=author`, `dir=up`, `perPage=30`, `updated=1d`, `page=0` y `page=abc` caen a sus defaults sin lanzar.
- [x] `q` con espacios alrededor se recorta, uno de solo espacios da `null` y uno de 150 caracteres queda en 100.
- [x] Un param repetido (`?status=draft&status=published`) toma el primero.
- [x] `articlesHref(defaults, {})` devuelve `/admin/articles` sin `?`.
- [x] `articlesHref` con `page: 3` en la base y un `patch` de `category` devuelve una URL sin `page`.

**Consultas (`admin-posts.test.ts`)**

- [x] Sin filtros devuelve publicados y borradores, ordenados por `updated_at` desc.
- [x] `status: "draft"` devuelve solo borradores; `counts` no cambia con el filtro.
- [x] `q: "seo"` encuentra por título y por slug sin distinguir mayúsculas; `q: "%"` no devuelve todo.
- [x] `category` filtra por slug; uno inexistente devuelve `items: []` y `total: 0`.
- [x] `updated: "7d"` excluye un post con `updated_at` de hace 10 días.
- [x] `sort: "title", dir: "asc"` ordena alfabético sin importar mayúsculas; dos posts con la misma `reading_minutes` salen en orden estable entre páginas.
- [x] Con 30 posts y `perPage: 10`, `page: 2` devuelve los posts 11–20, `total: 30` y `pageCount: 3`; `page: 9` devuelve la página 3.
- [x] Sin posts, `pageCount` es 1 y `items` vacío.
- [x] `setPostStatus(id, "publicado")` sobre un borrador sin fecha fija `published_at`; sobre uno que ya tenía fecha, la conserva.
- [x] `setPostStatus(id, "borrador")` conserva `published_at`.
- [x] `setPostStatus` con el mismo estado devuelve `changed: false`; con un id inexistente, `null`.
- [x] `deletePost` borra el post, sus etiquetas puente, valoraciones, comentarios y votos; con un id inexistente devuelve `null`.

**Actions (`admin-articles-actions.test.ts`)**

- [x] Las tres llaman a `requireAdmin()` antes de tocar la base.
- [x] Con un `id` que no es UUID devuelven error y no tocan la base.
- [x] `publishPostAction` sobre un borrador lo publica, devuelve "Artículo publicado." y llama a `updateTag("blog")`, `updateTag("post:{slug}")` y `revalidatePath("/admin/articles")`.
- [x] `unpublishPostAction` devuelve "Artículo pasado a borrador." y el post deja de salir en `getPublishedPosts`.
- [x] `deletePostAction` devuelve "Artículo eliminado." y el post ya no existe.
- [x] Con un id inexistente, las tres devuelven "Ese artículo ya no existe.".

**Componentes (`client`)**

- [x] `ConfirmDialog` abierto tiene el foco en "Cancelar"; `Escape` y "Cancelar" llaman a `onCancel`.
- [x] Con `pending`, los dos botones están deshabilitados y el de confirmar muestra el texto de espera.
- [x] `RowMenu` de un borrador muestra "Publicar" y "Eliminar", sin "Ver en el blog" ni "Pasar a borrador".
- [x] `RowMenu` de un publicado muestra "Ver en el blog" (con `target="_blank"` y `href="/blog/{slug}"`), "Pasar a borrador" y "Eliminar".
- [x] Elegir "Eliminar" abre el modal con el título del artículo y no llama a la action hasta confirmar.
- [x] `MediaGrid`: el ícono "Borrar" abre el modal; "Cancelar" no llama a `deleteMediaAction` y "Borrar" sí.

**Página (E2E, `articles.spec.ts`)**

- [x] `/admin/articles` muestra "Artículos", las pestañas "Todos", "Publicados" y "Borradores" con sus contadores, y no tiene "Nuevo artículo", "Exportar", "Editar" ni checkboxes.
- [x] La tabla tiene las columnas Título, Categoría, Estado, Lectura, Actualizado y Acciones.
- [x] "Borradores" deja la URL en `?status=draft`, marca la pestaña con `aria-current="page"` y solo muestra filas "Borrador".
- [x] Escribir en "Buscar" agrega `q` a la URL y filtra la tabla; "Limpiar filtros" lo quita.
- [x] Elegir una categoría agrega `category` y filtra; "Actualizado: Últimos 7 días" agrega `updated=7d`.
- [x] Clic en "Título" ordena ascendente (`aria-sort="ascending"`) y un segundo clic, descendente.
- [x] Con más artículos que filas, "Siguiente" lleva a `page=2`, "Mostrando 11–20 de N artículos" es correcto con `perPage=10`, y la página actual tiene `aria-current="page"`.
- [x] Cambiar "Filas por página" vuelve a la página 1.
- [x] Con filtros sin resultados se ve "Ningún artículo coincide con los filtros.".
- [x] Recargar con `?status=draft&sort=title&dir=asc&perPage=10` conserva pestaña, orden y filas.
- [x] Publicar un borrador desde "Más acciones" pide confirmación, muestra el toast "Artículo publicado." y el artículo se ve en `/blog`.
- [x] Pasar a borrador un publicado pide confirmación y el artículo deja de verse en `/blog` y su URL da 404.
- [x] Eliminar pide confirmación; "Cancelar" no cambia nada y "Eliminar" saca la fila y baja el contador.
- [x] El modal se cierra con `Escape` y el foco vuelve al botón "Más acciones".
- [x] A 390 px `/admin/articles` no tiene scroll horizontal de página y las filas se apilan.
- [x] El texto de la tabla, los badges, el modal y el botón rojo cumplen 4.5:1 de contraste (revisado con `/frontend-design`).

## Decisiones

- **Sí:** este spec es la tabla más las acciones de fila. El editor, "Nuevo artículo" y "Editar" van en su propio spec. Elegido por el usuario.
- **No:** listado de solo lectura. Obligaría a esperar al editor para algo tan simple como despublicar.
- **Sí:** "Programado" y "Destacado" quedan fuera. Las pestañas son Todos, Publicados y Borradores. Elegido por el usuario.
- **No:** migrar ahora para sumarlos. Programar cambia también las consultas públicas y merece su spec.
- **Sí:** paginación numerada por URL con `offset`, como el canvas. Elegido por el usuario.
- **No:** cursor y "Cargar más" como Medios. No da total ni salto a una página, y la tabla del canvas los muestra.
- **Sí:** todas las URLs del CMS en inglés, rutas y query params. Elegido por el usuario.
- **Sí:** se renombran también Medios y Usuarios, con su carpeta de actions. Una sola convención en el panel. Elegido por el usuario.
- **No:** solo los params o solo Artículos en inglés. Mezcla dos idiomas en la misma URL o en el mismo panel.
- **Sí:** las rutas viejas dan 404, sin redirects. El panel es privado y `noindex`. Elegido por el usuario.
- **Sí:** los textos de la interfaz siguen en español. Solo cambian las URLs.
- **Sí:** filtros por pestaña de estado con contador, búsqueda por título, categoría y "Actualizado". Elegido por el usuario.
- **Sí:** columnas ordenables Título, Lectura y Actualizado; 10/25/50 filas, default 25. Elegido por el usuario.
- **No:** ordenar por Categoría y Estado. El estado ya tiene pestañas y la categoría, filtro.
- **Sí:** la búsqueda también mira el slug, que se ve debajo del título en la tabla.
- **Sí:** los contadores de las pestañas son totales sin filtros, como en WordPress. Una sola consulta de conteo y números estables mientras se busca.
- **Sí:** menú "Más acciones" con Ver en el blog, Publicar / Pasar a borrador y Eliminar. Elegido por el usuario.
- **Sí:** toda acción que cambia o borra datos pasa por un modal de confirmación. Elegido por el usuario.
- **Sí:** "Ver en el blog" abre directo, sin modal: no cambia datos. Elegido por el usuario.
- **Sí:** un `ConfirmDialog` reusable con `<dialog>` nativo, y Medios lo adopta para borrar. Un solo patrón en el panel. Elegido por el usuario.
- **No:** `window.confirm`. No se puede estilar y bloquea los tests de navegador.
- **Sí:** publicar conserva el `published_at` original si ya tenía uno. El artículo vuelve a su lugar en el blog. Elegido por el usuario.
- **Sí:** sin selección múltiple ni acciones en lote. Elegido por el usuario.
- **No:** "Exportar". No hay pedido concreto de formato ni de uso.
- **Sí:** las consultas del panel no se cachean y las actions invalidan `blog` y `post:{slug}` con `updateTag`, como la comunidad del blog.
- **Sí:** publicar o despublicar un post que ya está en ese estado devuelve éxito sin escribir. Dos pestañas abiertas no generan un error confuso.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.

## Riesgos

| Riesgo                                                                                                         | Mitigación                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| El renombre de rutas deja enlaces, `revalidatePath` o `vi.mock` apuntando a rutas viejas, y tsc no lo detecta. | El paso 1 incluye un `grep` sobre todo el código y los tests, y un criterio lo repite.                                            |
| Publicar o borrar no se refleja en el blog público por la caché de `"use cache"`.                              | Las actions llaman a `updateTag("blog")` y `updateTag("post:{slug}")`; un E2E verifica `/blog` después de publicar y despublicar. |
| La búsqueda con `%` o `_` devuelve todo.                                                                       | Se escapan antes del `ILIKE`; un test con `q: "%"` lo cubre.                                                                      |
| El orden por una columna con valores repetidos mezcla filas entre páginas.                                     | `id` como desempate en todos los órdenes; un test lo verifica.                                                                    |
| Un `page` fuera de rango deja la tabla vacía después de borrar el último de la página.                         | `listAdminPosts` acota `page` a `pageCount`.                                                                                      |
| Leer `searchParams` fuera de `<Suspense>` rompe el build con Cache Components.                                 | Toda lectura de `searchParams` y de la base va dentro del `<Suspense>` de la página; el build sin `DATABASE_URL` lo prueba.       |
| El debounce de la búsqueda y la navegación pisan lo que el admin sigue escribiendo.                            | `router.replace` sin scroll y el input no controlado por la URL mientras tiene el foco.                                           |
| Borrar un artículo por error se lleva comentarios y valoraciones.                                              | Modal con tono peligro que lo dice explícitamente.                                                                                |

## Qué **no** incluye este spec

- Editor, "Nuevo artículo" y "Editar".
- "Programado" y "Destacado".
- Acciones en lote y "Exportar".
- Orden por Categoría o Estado y contadores filtrados.
- Redirects de las rutas viejas.
- Categorías, SEO y Ajustes.

Cada uno de estos, si llega, va en su propio spec.
