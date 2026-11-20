# SPEC 24 — Moderación de comentarios

> **Estado:** Implementado
> **Depende de:** SPEC 09, SPEC 13, SPEC 14, SPEC 16, SPEC 23
> **Fecha:** 2026-11-20
> **Objetivo:** Que el admin revise en `/admin/comments` los comentarios del blog, filtrados por estado, artículo y texto, y pueda aprobarlos u ocultarlos (de a uno o en lote) y borrarlos.

## Por qué existe este spec

SPEC 14 hizo que los comentarios nazcan `pendiente` y dejó afuera "Moderación: aprobar u ocultar comentarios, y una página `/admin/comentarios`". Hoy ningún comentario nuevo llega al blog público: se quedan en "En revisión" para siempre.

Tres decisiones marcan el diseño:

- **Sin migración.** Se usa `comment.status` de SPEC 09 tal cual. No se guarda motivo, ni quién moderó, ni cuándo. Ocultar es inmediato y se corrige con "Deshacer".
- **Lista de tarjetas con el texto completo.** Para moderar hay que leer el comentario entero. Aprobar y ocultar están a la vista en cada tarjeta y también en lote.
- **Cada cambio invalida `comments:<postId>`.** Es el tag de `cachedRatingSummary` y `cachedApprovedComments` (SPEC 13), así que el blog público se actualiza en el request siguiente.

**Referencias:**

- `db/schema/blog.ts` (`comment`, `comment_vote`, `post`, `commentStatus`), `db/blog-cache.ts` (tags `comments:<postId>`), `db/blog-community.ts` (`UserComment`, `deleteOwnComment`).
- `app/(admin)/admin/users/` (`page.tsx`, `users-toolbar.tsx`, `users-footer.tsx`, `user-row-menu.tsx`), `lib/admin/user-params.ts`, `db/admin-users.ts` y `actions/admin/users/index.ts` como modelo de página, parámetros, consultas y actions.
- `app/(admin)/admin/articles/status-tabs.tsx` como modelo de pestañas de estado.
- `components/admin/nav-items.ts`, `admin-nav.tsx`, `admin-sidebar.tsx`, `admin-drawer.tsx`, `app/(admin)/layout.tsx`, `app/(admin)/admin/page.tsx` (accesos del Inicio).
- `components/admin/confirm-dialog.tsx`, `components/admin/toast.tsx` (`notify`), `components/auth/user-avatar.tsx`, `components/icons.tsx` (`Chat`).
- `node_modules/next/dist/docs/01-app/` sobre `searchParams` como promesa, Cache Components y `updateTag`.

## Alcance

**Incluye:**

- **Página (`app/(admin)/admin/comments/page.tsx`, nueva):**
  - `AdminPageHeader` "Comentarios" con la descripción "Aprobá, ocultá o borrá lo que comentan los lectores.".
  - Lee `searchParams` y la base dentro de un `<Suspense>` con esqueleto de 4 tarjetas, después de `requireAdmin()`.
  - Contador "{N} comentarios" / "1 comentario" con la pestaña, el artículo y la búsqueda aplicados.

- **Pestañas de estado (`comment-status-tabs.tsx`, como `status-tabs.tsx` de Artículos):**
  - "Pendientes", "Aprobados", "Ocultos" y "Todos", cada una con su cantidad entre paréntesis. Las cantidades respetan el artículo y la búsqueda, no la pestaña.
  - "Pendientes" es la pestaña por defecto y no va en la URL.

- **Barra de filtros (`comments-toolbar.tsx`, cliente):**
  - Input "Buscar en el texto, nombre o email" (`type="search"`, máx. 100) con 300 ms de espera. `ILIKE` escapado sobre `comment.text`, `user.name` y `user.email`, como `listAdminUsers`.
  - Select "Artículo": "Todos los artículos" y los artículos con al menos un comentario, por título, de cualquier estado.
  - Estado en la URL: `/admin/comments?estado=aprobados&articulo=<postId>&q=spam&page=2`. Cambiar pestaña, artículo o búsqueda vuelve a la página 1.
  - Parámetros inválidos se ignoran (`estado=otro` → Pendientes, `articulo` que no es UUID → todos). Una página fuera de rango se acota a la última.

- **Orden y paginación:**
  - "Pendientes": `created_at` ascendente y después `id` (se atiende en orden de llegada).
  - "Aprobados", "Ocultos" y "Todos": `created_at` descendente y después `id`.
  - 25 por página. Pie "Mostrando {desde}–{hasta} de {total}" con "Anterior" / "Siguiente" (`comments-footer.tsx`, como `users-footer.tsx`).

- **Tarjeta (`comment-card.tsx`):**
  - Checkbox "Seleccionar el comentario de {nombre}".
  - `UserAvatar`, nombre y email debajo.
  - Artículo: si está `publicado`, enlace "{título}" a `/blog/{slug}#valoraciones` (`target="_blank"`, `rel="noopener"`). Si no, el título como texto y la etiqueta "Artículo no publicado".
  - Fecha con `formatDate(createdAt)`.
  - Insignia de estado: "Pendiente", "Aprobado" u "Oculto".
  - El texto completo, como texto plano, respetando los saltos de línea.
  - "Útil · {N}" cuando N > 0.
  - Si tiene respuesta, una caja "Respuesta del autor" con el texto y `formatDate(repliedAt)`. Solo lectura.
  - Botones visibles según el estado:

    | Estado      | Botones              |
    | ----------- | -------------------- |
    | `pendiente` | "Aprobar", "Ocultar" |
    | `aprobado`  | "Ocultar"            |
    | `oculto`    | "Aprobar"            |

  - Menú "Más acciones" (`comment-row-menu.tsx`, como `user-row-menu.tsx`):
    - "Ver usuario": enlace a `/admin/users?q={email}`.
    - "Borrar": abre el `ConfirmDialog` de borrado.
  - Por debajo de `md` la tarjeta apila los datos y los botones ocupan el ancho.

- **Selección y lote (`comments-list.tsx`, cliente):**
  - Checkbox "Seleccionar todos los de esta página" arriba de la lista.
  - Con 1 o más seleccionados aparece la barra "{N} seleccionados" con "Aprobar", "Ocultar" y "Quitar selección".
  - La selección vale solo para la página actual. Se limpia al cambiar de página, pestaña, artículo o búsqueda, y después de una acción.
  - Borrar no tiene lote.

- **Aprobar y ocultar:**
  - Sin diálogo. Cambian el estado de los comentarios elegidos que no lo tenían ya.
  - Toast con el mensaje y el botón "Deshacer" (6 s, como el resto de los toasts). "Deshacer" devuelve cada comentario a su estado anterior, incluido `pendiente`, y muestra "Se deshizo el cambio.".
  - En "Pendientes", lo aprobado u ocultado sale de la lista al refrescar.

- **Borrar (`ConfirmDialog`, tono `danger`):**
  - "¿Borrar el comentario de {nombre}?" / "Se borran el comentario, su respuesta y sus {N} votos. No se puede deshacer." (sin votos: "Se borran el comentario y su respuesta…"; sin respuesta, sin "y su respuesta") / "Borrar".
  - Borra la fila de `comment`; los votos caen por cascada.

- **Aviso de pendientes:**
  - `nav-items.ts` suma "Comentarios" (`/admin/comments`, ícono `Chat`) en "Contenido del blog", después de "Medios".
  - `PendingCommentsBadge` (`components/admin/pending-comments-badge.tsx`, servidor): si el usuario de la sesión es admin, muestra una insignia con `countPendingComments()` junto a "Comentarios"; con 0, o sin admin, no muestra nada. Nombre accesible "{N} pendientes".
  - `app/(admin)/layout.tsx` la crea dentro de un `<Suspense fallback={null}>` y la pasa como prop `badges` a `AdminSidebar` y al cajón, que la pasan a `AdminNav`. El resto del shell sigue estático.
  - El Inicio (`/admin`) suma el acceso "Comentarios" con el texto "Aprobá u ocultá lo que comentan los lectores.".

- **Consultas (`db/admin-comments.ts`, nuevo, `server-only`, sin caché):** listado con filtros y cantidades por estado, artículos con comentarios, cantidad de pendientes, cambio de estado en lote, restauración y borrado. Firmas en el modelo de datos.

- **Server Actions (`actions/admin/comments/index.ts`, nuevo):**
  - `setCommentStatusAction(prev, data)` (`id` repetido de 1 a 25 veces, `status` `aprobado` | `oculto`).
  - `undoCommentStatusAction(items)` (`{ id, status }[]`, de 1 a 25).
  - `deleteCommentAsAdminAction(prev, data)` (`id`).
  - Todas llaman a `requireAdmin()` antes de tocar la base y validan con Zod (ids con `z.uuid()`).
  - Si cambiaron algo, llaman a `updateTag("comments:<postId>")` por cada artículo afectado y a `revalidatePath("/admin/comments")`.
  - Mensajes:

    | Caso                            | Mensaje                                                             |
    | ------------------------------- | ------------------------------------------------------------------- |
    | Aprobado (1)                    | "Comentario aprobado."                                              |
    | Aprobados (N)                   | "Se aprobaron {N} comentarios."                                     |
    | Ocultado (1)                    | "Comentario oculto."                                                |
    | Ocultados (N)                   | "Se ocultaron {N} comentarios."                                     |
    | Ninguno cambió                  | "Esos comentarios ya estaban aprobados." / "…ya estaban ocultos."   |
    | Deshecho                        | "Se deshizo el cambio."                                             |
    | Borrado                         | "Comentario borrado."                                               |
    | Ningún id existe                | "Ese comentario ya no existe."                                      |
    | Datos inválidos o error de base | "No pudimos completar la acción. Intentá de nuevo en unos minutos." |

- **Toast (`components/admin/toast.tsx`):** `notify` acepta también `CommentActionState`; suma `notifyWithUndo(message, onUndo)` con el botón "Deshacer".

- **Diseño:** pestañas, barra, tarjetas, insignias, barra de lote, menú, insignia de la barra lateral y estados vacíos se hacen con `/frontend-design`, siguiendo `/admin/users` y los tokens `cms-*`. Todos los controles miden 44 px o más y cumplen 4.5:1 de contraste. A 390 px no hay scroll horizontal.

- **Estados vacíos:**

  | Caso                    | Texto                                                                                           |
  | ----------------------- | ----------------------------------------------------------------------------------------------- |
  | Pendientes, sin filtros | "No hay comentarios pendientes."                                                                |
  | Aprobados, sin filtros  | "No hay comentarios aprobados."                                                                 |
  | Ocultos, sin filtros    | "No hay comentarios ocultos."                                                                   |
  | Todos, sin filtros      | "Todavía no hay comentarios."                                                                   |
  | Con artículo o búsqueda | "No hay comentarios que coincidan con estos filtros." + "Limpiar filtros" (mantiene la pestaña) |

- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `__tests__/server/comment-params.test.ts`, nuevo.
  - Vitest `db`: `__tests__/db/admin-comments.test.ts` y `__tests__/db/comments-actions.test.ts`, nuevos.
  - Vitest `client`: `__tests__/client/comments-list.test.tsx`, `__tests__/client/comment-card.test.tsx` y `__tests__/client/comments-toolbar.test.tsx`, nuevos; `admin-nav.test.tsx` suma el ítem y la insignia.
  - Playwright: `e2e/comentarios.spec.ts`, nuevo; `admin.spec.ts` ajusta el orden de la barra lateral; `comunidad.spec.ts` sigue pasando.

**Fuera de alcance (para specs futuros):**

- Responder, editar la respuesta o editar el texto de un comentario desde el panel.
- Motivo de ocultamiento, registro de quién y cuándo moderó, y auditoría.
- Borrar en lote, y seleccionar más allá de la página actual.
- Bloquear al autor desde esta pantalla (se hace en Usuarios, SPEC 23).
- Avisar por email al comentarista o al admin.
- Filtro automático de spam o palabras prohibidas, y aprobar automáticamente a lectores de confianza.
- Moderar valoraciones (`post_rating`).
- Hilos entre lectores.

## Modelo de datos

No hay tablas, columnas, índices ni migraciones nuevas. Se usan `comment`, `comment_vote`, `post` y `user` tal cual.

```ts
// lib/admin/comment-params.ts (nuevo, como user-params.ts)
export const COMMENT_STATUS_FILTERS = [
  "pendientes",
  "aprobados",
  "ocultos",
  "todos",
] as const;
export type CommentStatusFilter = (typeof COMMENT_STATUS_FILTERS)[number];
export type AdminCommentQuery = {
  estado: CommentStatusFilter; // "pendientes" por defecto, no va en la URL
  articulo: string | null; // post.id; null = todos
  q: string | null;
  page: number;
};
export const COMMENTS_PER_PAGE = 25;
export const COMMENT_QUERY_MAX = 100;
export function parseCommentParams(
  params: Record<string, string | string[] | undefined>,
): AdminCommentQuery;
export function commentQueryHref(query: AdminCommentQuery): string; // "/admin/comments?estado=…&articulo=…&q=…&page=…"

// db/admin-comments.ts (nuevo, "server-only", sin caché)
export type CommentStatus = "pendiente" | "aprobado" | "oculto";
export type AdminCommentRow = {
  id: string;
  text: string;
  status: CommentStatus;
  createdAt: Date;
  usefulCount: number;
  reply: { text: string; repliedAt: Date } | null;
  author: { id: string; name: string; email: string; image: string | null };
  post: { id: string; title: string; slug: string; published: boolean };
};
export type AdminCommentList = {
  items: AdminCommentRow[];
  total: number;
  page: number;
  pageCount: number;
  counts: Record<CommentStatus, number>; // con articulo y q, sin estado
};
export async function listAdminComments(
  query: AdminCommentQuery,
): Promise<AdminCommentList>;
export async function listCommentedPosts(): Promise<
  { id: string; title: string }[]
>;
export async function countPendingComments(): Promise<number>;

type Change = { id: string; postId: string; previous: CommentStatus };
export async function setCommentsStatus(
  ids: string[],
  status: "aprobado" | "oculto",
): Promise<
  { ok: true; changed: Change[] } | { ok: false; reason: "not-found" }
>;
// changed solo trae los que tenían otro estado; "not-found" si ningún id existe.
export async function restoreCommentsStatus(
  items: { id: string; status: CommentStatus }[],
): Promise<
  { ok: true; postIds: string[] } | { ok: false; reason: "not-found" }
>;
export async function deleteCommentAsAdmin(
  id: string,
): Promise<{ ok: true; postId: string } | { ok: false; reason: "not-found" }>;

// actions/admin/comments/index.ts (nuevo)
export type CommentActionState =
  | { status: "idle" }
  | {
      status: "success";
      message: string;
      undo?: { id: string; status: CommentStatus }[];
    }
  | { status: "error"; message?: string };
export async function setCommentStatusAction(
  prev: CommentActionState,
  data: FormData,
): Promise<CommentActionState>;
export async function undoCommentStatusAction(
  items: { id: string; status: CommentStatus }[],
): Promise<CommentActionState>;
export async function deleteCommentAsAdminAction(
  prev: CommentActionState,
  data: FormData,
): Promise<CommentActionState>;

// components/admin/nav-items.ts (cambia)
// href suma "/admin/comments"; AdminNav recibe badges?: Partial<Record<AdminNavItem["href"], ReactNode>>
```

Archivos nuevos:

- `app/(admin)/admin/comments/`: `page.tsx`, `comment-status-tabs.tsx`, `comments-toolbar.tsx`, `comments-list.tsx`, `comment-card.tsx`, `comment-row-menu.tsx` y `comments-footer.tsx`.
- `components/admin/pending-comments-badge.tsx`.
- `actions/admin/comments/index.ts`, `db/admin-comments.ts`, `lib/admin/comment-params.ts`.

Archivos que cambian: `components/admin/nav-items.ts`, `admin-nav.tsx`, `admin-sidebar.tsx`, `admin-drawer.tsx` (y quien lo renderiza), `toast.tsx`, `app/(admin)/layout.tsx` y `app/(admin)/admin/page.tsx`.

Convenciones:

- Desde el panel solo se pasa a `aprobado` u `oculto`. A `pendiente` se vuelve únicamente con "Deshacer".
- `undo` lleva el estado anterior de cada comentario que cambió. Uno que no cambió no entra.
- Toda escritura invalida `comments:<postId>` de cada artículo afectado, aunque el artículo no esté publicado.
- El texto del comentario se muestra siempre como texto plano.
- El panel opera por `id`. Las consultas del panel no usan caché.

## Plan de implementación

1. **Parámetros.** `lib/admin/comment-params.ts` con `comment-params.test.ts`. Prueba: `npm run test:run` pasa.
2. **Consultas.** `db/admin-comments.ts` con listado, filtros, orden por pestaña, cantidades, artículos con comentarios, pendientes y las tres escrituras, con `admin-comments.test.ts`. Prueba: `npm run test:db` pasa.
3. **Actions.** `actions/admin/comments/index.ts` con `comments-actions.test.ts`. Prueba: `npm run test:db` pasa.
4. **Navegación.** Ítem "Comentarios" en `nav-items.ts`, prop `badges` en `AdminNav`, `PendingCommentsBadge` en el layout dentro de `<Suspense>`, acceso en el Inicio y una `page.tsx` mínima con la cabecera. Casos en `admin-nav.test.tsx`; ajustar `admin.spec.ts`. Diseño con `/frontend-design`. Prueba: `npm run test:run` pasa y `npm run build` sin `DATABASE_URL` pasa.
5. **Lista y filtros.** `page.tsx` completa, `comment-status-tabs.tsx`, `comments-toolbar.tsx`, `comment-card.tsx` (sin acciones todavía), `comments-footer.tsx` y estados vacíos. Diseño con `/frontend-design`. `comments-toolbar.test.tsx`. Prueba: `npm run test:run` pasa y a mano se filtra y pagina con el seed.
6. **Aprobar, ocultar y deshacer.** Botones de la tarjeta, `notifyWithUndo` en `toast.tsx`, `comments-list.tsx` con selección y barra de lote. Diseño con `/frontend-design`. `comment-card.test.tsx` y `comments-list.test.tsx`. Prueba: `npm run test:run` pasa y a mano se aprueba un pendiente y se ve en el blog.
7. **Menú y borrar.** `comment-row-menu.tsx` con "Ver usuario" y "Borrar" con `ConfirmDialog`. Casos en `comment-card.test.tsx`. Prueba: `npm run test:run` pasa y a mano se borra un comentario.
8. **E2E.** `e2e/comentarios.spec.ts`. Prueba: `npm run test:e2e` pasa completo.

## Criterios de aceptación

**General**

- [x] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [x] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa completo, con `comunidad.spec.ts` sin cambios en sus casos.
- [x] No hay migraciones nuevas: `npm run db:generate` no crea archivos.
- [x] `package.json` no suma dependencias.

**Parámetros (`server`)**

- [x] `parseCommentParams({})` devuelve `{ estado: "pendientes", articulo: null, q: null, page: 1 }`.
- [x] `parseCommentParams({ estado: "ocultos", articulo: "<uuid>", q: "  spam ", page: "2" })` devuelve esos valores con `q: "spam"`; `estado: "otro"` cae a `"pendientes"`, `articulo: "abc"` a `null`, `page: "0"` a `1`, y una `q` de 101 caracteres se recorta a 100.
- [x] `commentQueryHref` con los valores por defecto devuelve `/admin/comments`; con todo, `/admin/comments?estado=ocultos&articulo=<uuid>&q=spam&page=2`.

**Consultas (`admin-comments.test.ts`)**

- [ ] `listAdminComments` en "pendientes" ordena por alta ascendente y en "aprobados", "ocultos" y "todos" por alta descendente, de a 25.
- [ ] Los filtros `pendientes`, `aprobados` y `ocultos` devuelven conjuntos disjuntos que suman lo que devuelve `todos`.
- [ ] `q` busca en el texto, el nombre y el email; `q: "50%"` no devuelve todos.
- [ ] `articulo` combinado con `estado` y `q` aplica los tres filtros a la vez, y `counts` respeta `articulo` y `q` pero no `estado`.
- [ ] Cada fila trae `usefulCount`, `reply` (o `null`), `author` y `post.published` correctos; un comentario de un artículo `borrador` sale con `published: false`.
- [ ] `listCommentedPosts` devuelve solo artículos con al menos un comentario, por título, incluidos los `borrador`.
- [ ] `countPendingComments` cuenta solo los `pendiente`.
- [ ] `setCommentsStatus` sobre 2 pendientes y 1 aprobado con `aprobado` cambia los 2 pendientes y devuelve solo esos 2 en `changed` con `previous: "pendiente"`.
- [ ] `setCommentsStatus` con ids que no existen devuelve `not-found` y no cambia nada.
- [ ] `restoreCommentsStatus` devuelve cada comentario a su estado anterior, incluido `pendiente`.
- [ ] `deleteCommentAsAdmin` borra el comentario y sus votos; con un id inexistente devuelve `not-found`.

**Actions (`comments-actions.test.ts`)**

- [ ] Cada action llama a `requireAdmin()` antes de tocar la base.
- [ ] Aprobar comentarios de dos artículos llama a `updateTag` con el `comments:<postId>` de cada uno y a `revalidatePath("/admin/comments")`.
- [ ] Si ningún comentario cambió, no llama a `updateTag` y devuelve "Esos comentarios ya estaban aprobados.".
- [ ] `setCommentStatusAction` con 26 ids, con un id que no es UUID o con `status: "pendiente"` devuelve el error genérico y no cambia nada.
- [ ] `setCommentStatusAction` devuelve `undo` con el estado anterior de cada comentario que cambió.
- [ ] Las actions devuelven los mensajes de la tabla de mensajes para cada caso de éxito y de error.
- [ ] Aprobar un pendiente de `senales-sistema-a-medida` hace que `getApprovedComments` de ese artículo lo incluya; ocultarlo hace que deje de incluirlo.

**Componentes (`client`)**

- [x] `CommentsToolbar`: escribir llama a `router.replace` una sola vez 300 ms después de la última tecla, con `?q=…` y sin `page`; elegir un artículo lo hace con `?articulo=<id>`; elegir "Todos los artículos" lo quita y mantiene `estado`.
- [x] `CommentCard` muestra "Aprobar" y "Ocultar" en un pendiente, solo "Ocultar" en un aprobado y solo "Aprobar" en un oculto.
- [x] `CommentCard` de un artículo no publicado muestra "Artículo no publicado" y el título sin enlace; de uno publicado, enlace a `/blog/{slug}#valoraciones`.
- [x] `CommentCard` muestra "Respuesta del autor" solo si hay respuesta, y "Útil · N" solo si N > 0.
- [x] "Borrar" abre la confirmación con la cantidad de votos y no llama a la action hasta confirmar.
- [x] `CommentsList`: tildar 2 tarjetas muestra "2 seleccionados" con "Aprobar" y "Ocultar"; "Seleccionar todos los de esta página" tilda todas; "Quitar selección" oculta la barra.
- [x] Al aprobar, se muestra el toast con "Deshacer", y "Deshacer" llama a `undoCommentStatusAction` con el `undo` recibido.
- [x] `AdminNav` con `badges` muestra la insignia junto a "Comentarios" con el nombre accesible "{N} pendientes"; sin `badges` no muestra nada.

**Comentarios (E2E, `comentarios.spec.ts`)**

- [ ] "Comentarios" en la barra lateral, después de "Medios", lleva a `/admin/comments` en la pestaña "Pendientes", con la insignia de pendientes.
- [ ] Un lector comenta un artículo; en `/admin/comments` su comentario aparece en "Pendientes", "Aprobar" muestra el toast, el comentario sale de la lista, la insignia baja en 1 y el comentario se ve en el artículo público sin "En revisión".
- [ ] "Ocultar" un aprobado lo saca del artículo público y el lector lo ve "Oculto" en `/cuenta/perfil`.
- [ ] "Deshacer" después de aprobar devuelve el comentario a "Pendientes".
- [ ] Seleccionar 2 pendientes y "Aprobar" en lote muestra "Se aprobaron 2 comentarios.".
- [ ] Buscar parte del email del lector deja solo sus comentarios, la URL queda con `?q=` y recargar mantiene la búsqueda; "Limpiar filtros" vuelve a la pestaña sin `q`.
- [ ] Filtrar por artículo deja solo los comentarios de ese artículo.
- [ ] "Borrar" con confirmación quita el comentario de la lista y del artículo público.
- [ ] "Ver usuario" lleva a `/admin/users?q={email}` con ese usuario en la tabla.
- [ ] Sin sesión, `/admin/comments` redirige a `/cuenta/login`; con un lector, da 404.
- [ ] A 390 px las tarjetas apilan sus datos y no hay scroll horizontal; el cajón muestra "Comentarios" con la insignia.
- [ ] Las pestañas, la barra, las tarjetas, la barra de lote y el menú cumplen 4.5:1 de contraste y todos sus controles miden 44 px o más (revisado con `/frontend-design`).

## Decisiones

- **Sí:** aprobar, ocultar y borrar, pasando entre cualquier estado. Elegido por el usuario.
- **No:** responder desde el panel. SPEC 14 decidió que solo responde el autor del post porque el esquema no guarda quién respondió.
- **Sí:** aprobar y ocultar en lote, solo dentro de la página actual. Elegido por el usuario. Moderar de a uno una cola de pendientes es tedioso.
- **No:** borrar en lote. Elegido por el usuario. Es la única acción sin "Deshacer".
- **Sí:** pestañas Pendientes / Aprobados / Ocultos / Todos con cantidades, select de artículo y búsqueda en texto, nombre y email, con estado en la URL y 25 por página. Elegido por el usuario. Mismo modelo que `/admin/users`.
- **Sí:** "Pendientes" es la pestaña por defecto. Es la cola de trabajo.
- **Sí:** insignia con los pendientes en la barra lateral y acceso en el Inicio. Elegido por el usuario.
- **Sí:** la insignia se lee en su propio `<Suspense>` dentro del layout. El resto del shell sigue estático, como definió SPEC 16.
- **Sí:** lista de tarjetas con el texto completo y botones a la vista. Elegido por el usuario. Para moderar hay que leer el comentario entero.
- **No:** tabla con texto recortado y modal de detalle. Obliga a abrir cada comentario para decidir.
- **Sí:** pendientes del más viejo al más nuevo; el resto del más nuevo al más viejo. Elegido por el usuario.
- **Sí:** "Ver usuario" enlaza a `/admin/users?q={email}`. Elegido por el usuario. Bloquear ya existe ahí (SPEC 23).
- **No:** bloquear desde el menú del comentario. Duplica `BanDialog` en dos pantallas.
- **Sí:** ocultar sin motivo y con "Deshacer" en el toast. Elegido por el usuario. No pide migración y corrige un clic equivocado.
- **No:** registrar quién y cuándo moderó. Elegido por el usuario. La auditoría quedó fuera en SPEC 23.
- **Sí:** se listan comentarios de artículos de cualquier estado, con la etiqueta "Artículo no publicado". Elegido por el usuario. Si el artículo vuelve a publicarse, ya están moderados.
- **Sí:** cada escritura invalida `comments:<postId>` de cada artículo afectado. Es el tag de las lecturas públicas de comentarios y del resumen.
- **No:** invalidar `blog` entero. `comments:<postId>` alcanza y no vacía la caché de todo el blog.
- **Sí:** el panel solo pasa a `aprobado` u `oculto`; `pendiente` vuelve solo con "Deshacer". "Devolver a pendiente" a mano no tiene un uso claro.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                            |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| La insignia de la barra lateral hace dinámico el shell y rompe el prerender o el build.  | Va en su propio `<Suspense fallback={null}>` y lee la sesión antes de la base; el build sin `DATABASE_URL` lo prueba. |
| La insignia muestra cantidades a quien no es admin.                                      | `PendingCommentsBadge` chequea el rol antes de contar y devuelve `null` si no es admin.                               |
| "Deshacer" llega después de que otro admin cambió el mismo comentario.                   | Se acepta: "Deshacer" pisa ese cambio con el estado anterior. Con un solo admin activo es un caso raro.               |
| Un lote toca comentarios de varios artículos y alguno queda con caché vieja.             | `setCommentsStatus` devuelve el `postId` de cada cambio y la action invalida cada uno; test `db` con dos artículos.   |
| La búsqueda con `ILIKE` sobre `comment.text` es lenta con muchos comentarios.            | Los comentarios son pocos. Un índice de texto iría en otro spec si hiciera falta.                                     |
| Leer `searchParams` o la base fuera de `<Suspense>` rompe el build con Cache Components. | Toda lectura va dentro del `<Suspense>` de la página; el build sin `DATABASE_URL` lo prueba.                          |
| Un texto con HTML o saltos de línea rompe la tarjeta.                                    | Se muestra como texto plano con `white-space: pre-line`, como en el blog; test `client`.                              |

## Qué **no** incluye este spec

- Responder o editar comentarios desde el panel.
- Motivo de ocultamiento, registro de moderación y auditoría.
- Borrar en lote y seleccionar más allá de la página.
- Bloquear al autor desde esta pantalla.
- Emails de aviso.
- Antispam automático y lectores de confianza.
- Moderar valoraciones.
- Hilos entre lectores.

Cada uno de estos, si llega, va en su propio spec.
