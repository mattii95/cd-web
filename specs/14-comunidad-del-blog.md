# SPEC 14 — Comunidad del blog: valorar, comentar, votar y responder

> **Estado:** Implementado
> **Depende de:** SPEC 07, SPEC 09, SPEC 12, SPEC 13
> **Fecha:** 2026-11-17
> **Objetivo:** Que un lector con sesión pueda valorar, comentar, votar "Útil" y revisar o borrar sus comentarios desde su perfil, y que el autor del post pueda responder, todo guardado en la base.

## Por qué existe este spec

SPEC 09 dejó las tablas `post_rating`, `comment` y `comment_vote`, y SPEC 13 hizo que la sección de valoraciones lea de la base con caché.
Hoy "Útil" solo suma en el cliente, "Responder" no hace nada y nadie puede valorar ni comentar.
Este spec agrega las escrituras, sin migraciones nuevas.

Cuatro decisiones marcan el diseño:

- Los comentarios nacen `pendiente`, como define SPEC 09. Solo su autor los ve, con el badge "En revisión". Aprobarlos va en el spec de moderación.
- Los datos públicos siguen cacheados (`comments:<postId>`). Lo propio de cada lector (su valoración, sus votos, sus comentarios y sus pendientes) se lee sin caché en cada request.
- Valorar, borrar un comentario y responder llaman a `updateTag("comments:<postId>")`. "Útil" no invalida: el cliente ajusta el contador.
- "Responder" es solo del autor del post, un nivel, en `comment.reply_text`. No hay hilos entre lectores.

Además, `/cuenta/perfil` suma la sección "Mis comentarios": el lector ve todos sus comentarios, con su estado, y puede borrarlos.

**Referencias:**

- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md`: solo se llama desde Server Actions y expira el tag para que el próximo request lea datos frescos.
- `node_modules/next/dist/docs/01-app/02-guides/` sobre mutaciones con Server Actions (cómo se refresca la ruta después de `updateTag`).
- `lib/auth/dal.ts` (`getCurrentUser`) y `lib/auth/rate-limit.ts` (`hit`).

## Alcance

**Incluye:**

- **Escrituras y lectura del lector (`db/blog-community.ts`, nuevo, `server-only`):**
  - `getViewerState(postId, userId)`: lectura sin caché de lo propio del lector en ese post.
  - `upsertRating(postId, userId, rating)`: crea o cambia la valoración.
  - `createComment(postId, userId, text)`: inserta un comentario `pendiente` y lo devuelve como `PublicComment`.
  - `deleteOwnComment(commentId, userId)`: borra un comentario propio en cualquier estado (`pendiente`, `aprobado` u `oculto`). Los votos caen por cascade.
  - `getUserComments(userId, params?)`: lectura sin caché de los comentarios del usuario en todos los posts y en todos los estados, paginada con el cursor de SPEC 12 (20 por defecto, `createdAt` y `id` descendentes).
  - `toggleVote(commentId, userId)`: agrega o quita el voto y devuelve `{ voted, usefulCount }` con el conteo real.
  - `saveReply(commentId, userId, text)` y `deleteReply(commentId, userId)`: escriben o limpian `reply_text` y `replied_at`.
  - Todas validan que el post esté `publicado`. Las de voto y respuesta exigen comentario `aprobado`.
  - Un permiso que no se cumple devuelve `null` o `false`, no lanza.
- **Server Actions (`app/(site)/blog/community-actions.ts`, nuevo, `"use server"`):**
  - `rateAction`, `createCommentAction`, `deleteCommentAction`, `toggleVoteAction`, `saveReplyAction`, `deleteReplyAction` y `loadMoreUserCommentsAction`.
  - `loadMoreUserCommentsAction(cursor)` devuelve la página siguiente de `getUserComments` del usuario de la sesión. Nunca recibe un `userId`.
  - Cada una llama a `getCurrentUser()`. Sin sesión devuelve `{ status: "error", message: "Iniciá sesión para continuar." }`.
  - Validan con Zod: ids con `z.uuid()`, valoración entera de 1 a 5, texto con `trim` de 2 a 2000 caracteres.
  - Nunca lanzan: cualquier fallo devuelve `{ status: "error", message }` con los mensajes de la tabla del modelo de datos.
  - `rateAction`, `deleteCommentAction`, `saveReplyAction` y `deleteReplyAction` llaman a `updateTag("comments:<postId>")` después de escribir.
  - `createCommentAction` y `toggleVoteAction` no invalidan.
- **Límite de comentarios (`lib/auth/rate-limit.ts`):** regla nueva `comment` con 5 por 600 segundos, y función nueva `isUserRateLimited(rule, userId)` con clave `actions|user:<userId>|<rule>`. Solo la usa `createCommentAction`.
- **Artículo (`app/(site)/blog/[slug]/page.tsx`):** en el mismo `Promise.all` que el resumen y los comentarios, lee `getCurrentUser()` y, si hay usuario, `getViewerState(post.id, user.id)`. Le pasa a `ReviewsSection` `viewer: ViewerState | null`.
- **`ReviewsSection` (`components/blog/reviews-section.tsx`):**
  - El resumen se lee de las props, no de un estado, para que se actualice cuando la ruta se refresca después de `updateTag`.
  - **Sin sesión:** el bloque oscuro "Iniciá sesión para comentar y puntuar" queda como hoy. "Útil" es un enlace a `/cuenta/login?volver=/blog/<slug>`. "Responder" no se muestra.
  - **Con sesión, bloque "Tu opinión":** reemplaza al bloque oscuro, con el mismo fondo.
    - "Tu valoración": 5 estrellas como `radiogroup` (cada una es un `radio` con nombre "N estrellas"). Arranca en `viewer.rating` y guarda al elegir. Si falla, vuelve al valor anterior y muestra el error.
    - Debajo, un `textarea` "Escribí un comentario" con contador `N/2000` y botón "Publicar". El botón está `disabled` con menos de 2 caracteres (con `trim`) o mientras envía.
    - Al publicar, el comentario aparece arriba de la lista con el badge "En revisión" y el mensaje "Tu comentario quedó en revisión.". El `textarea` se vacía.
  - **Pendientes:** `viewer.pending` se muestran arriba de los aprobados, con "En revisión" y sin "Útil" ni "Responder".
  - **Borrar:** los comentarios propios (pendientes y los de `viewer.ownCommentIds`) muestran "Borrar". Al hacer clic aparece inline "¿Borrar comentario?" con "Sí, borrar" y "Cancelar". Al confirmar, el comentario sale de la lista.
  - **"Útil":** con sesión es un toggle con `aria-pressed`, que arranca según `viewer.votedCommentIds`. Al hacer clic cambia al instante y después toma el `usefulCount` que devuelve la acción. Si falla, vuelve atrás y muestra el error. En comentarios propios se muestra "Útil · N" como texto, no como botón.
  - **"Responder":** solo si `viewer.isPostAuthor`, en comentarios aprobados sin respuesta. Abre un `textarea` inline con "Publicar respuesta" y "Cancelar".
  - **Respuesta existente:** si `viewer.isPostAuthor`, la caja de respuesta muestra "Editar" (mismo `textarea` con el texto actual) y "Borrar" (con la misma confirmación inline, "¿Borrar respuesta?").
  - Los comentarios cargados con "Ver más comentarios" usan el mismo `viewer`.
  - Los mensajes de error y de éxito van en un `role="status"` junto al control que los produjo.
- **"Mis comentarios" en el perfil (`app/(site)/cuenta/perfil/page.tsx` y `components/account/my-comments.tsx`, nuevo, cliente):**
  - Es una sección debajo de los datos del perfil, con título "Mis comentarios", en su propio `<Suspense>` con un skeleton de 3 filas.
  - Un componente servidor llama a `requireUser("/cuenta/perfil")` y a `getUserComments(user.id)`, y le pasa la primera página a `MyComments`.
  - Cada comentario muestra:
    - El título del post. Si el post está `publicado`, es un enlace a `/blog/<slug>#valoraciones`. Si no, es texto sin enlace.
    - La fecha con `formatPostDate(createdAt)`.
    - El badge de estado: "En revisión" (`pendiente`), "Publicado" (`aprobado`) u "Oculto" (`oculto`).
    - El texto completo.
    - Si tiene respuesta, una caja "Respuesta del autor" con el texto y `formatPostDate(repliedAt)`.
    - "Borrar", con la misma confirmación inline del artículo ("¿Borrar comentario?", "Sí, borrar", "Cancelar") y `deleteCommentAction`. Al confirmar, sale de la lista.
  - "Ver más comentarios" va debajo y usa `LoadMore` con `loadMoreUserCommentsAction`, con el mismo manejo de carga y error de SPEC 13 ("No pudimos cargar más comentarios."). No se muestra si `nextCursor` es `null`.
  - Sin comentarios muestra "Todavía no comentaste ningún artículo." y un enlace "Ir al blog" a `/blog`.
  - No hay filtro por estado.
- **Diseño:** el bloque "Tu opinión", las estrellas, el badge "En revisión", las confirmaciones inline, el editor de respuesta y la sección "Mis comentarios" se revisan con `/frontend-design`. En el artículo se usan los colores, radios y botones que ya tiene la sección de valoraciones. En el perfil se usan los del perfil.
- **Tests (casos en los criterios de aceptación):**
  - Vitest `db`: `__tests__/db/blog-community.test.ts` para `db/blog-community.ts` y `__tests__/db/community-actions.test.ts` para las acciones, con `getCurrentUser` y `next/cache` mockeados.
  - Vitest `client`: `reviews-section.test.tsx` suma casos con sesión y sin sesión, y `my-comments.test.tsx` es nuevo. Los dos usan las acciones mockeadas.
  - Playwright: `e2e/comunidad.spec.ts`.

**Fuera de alcance (para specs futuros):**

- Moderación: aprobar u ocultar comentarios, y una página `/admin/comentarios`.
- Hilos de respuestas entre lectores (`parent_id`).
- Editar un comentario propio.
- Quitar la valoración propia.
- Que un admin que no es el autor del post responda.
- Notificaciones por email de comentarios nuevos o respuestas.
- Antispam más allá del límite de 5 comentarios cada 10 minutos.
- Ordenar comentarios en el servidor ("Mejor valorados", "Más útiles").
- Rate limit para valorar y para "Útil".
- Invalidar la caché al votar "Útil".
- Una ruta aparte `/cuenta/comentarios` y un enlace en el menú de usuario.
- Filtrar "Mis comentarios" por estado.
- Mostrar en el perfil las valoraciones y los votos "Útil" del usuario.

## Modelo de datos

No hay tablas, columnas, índices ni migraciones nuevas. Se usan `post_rating`, `comment` y `comment_vote` de SPEC 09.

```ts
// db/blog-community.ts (server-only)
export type ViewerState = {
  rating: BlogRating | null; // su post_rating en este post
  votedCommentIds: string[]; // comentarios de este post que votó
  ownCommentIds: string[]; // sus comentarios aprobados en este post
  pending: PublicComment[]; // sus comentarios pendientes, createdAt descendente, máximo 20
  isPostAuthor: boolean; // post.author_id = userId
};

export type UserComment = {
  id: string;
  text: string;
  status: "pendiente" | "aprobado" | "oculto";
  createdAt: Date;
  post: { slug: string; title: string; published: boolean };
  reply: { text: string; repliedAt: Date } | null;
};

export function getViewerState(
  postId: string,
  userId: string,
): Promise<ViewerState>;
export function getUserComments(
  userId: string,
  params?: PageParams,
): Promise<Page<UserComment>>; // 20 por defecto
export function upsertRating(
  postId: string,
  userId: string,
  rating: BlogRating,
): Promise<boolean>; // false si el post no está publicado
export function createComment(
  postId: string,
  userId: string,
  text: string,
): Promise<PublicComment | null>;
export function deleteOwnComment(
  commentId: string,
  userId: string,
): Promise<{ postId: string } | null>;
export function toggleVote(
  commentId: string,
  userId: string,
): Promise<{ voted: boolean; usefulCount: number } | null>; // null si es propio o no está aprobado
export function saveReply(
  commentId: string,
  userId: string,
  text: string,
): Promise<{ postId: string; repliedAt: Date } | null>;
export function deleteReply(
  commentId: string,
  userId: string,
): Promise<{ postId: string } | null>;

// app/(site)/blog/community-actions.ts
type Fail = { status: "error"; message: string };
export function rateAction(
  postId: string,
  rating: number,
): Promise<{ status: "success" } | Fail>;
export function createCommentAction(
  postId: string,
  text: string,
): Promise<{ status: "success"; comment: PublicComment } | Fail>;
export function deleteCommentAction(
  commentId: string,
): Promise<{ status: "success" } | Fail>;
export function toggleVoteAction(
  commentId: string,
): Promise<{ status: "success"; voted: boolean; usefulCount: number } | Fail>;
export function saveReplyAction(
  commentId: string,
  text: string,
): Promise<
  { status: "success"; reply: { text: string; repliedAt: Date } } | Fail
>;
export function deleteReplyAction(
  commentId: string,
): Promise<{ status: "success" } | Fail>;
export function loadMoreUserCommentsAction(
  cursor: string,
): Promise<
  { status: "success"; items: UserComment[]; nextCursor: string | null } | Fail
>;

// lib/auth/rate-limit.ts
// RULES suma: comment: { max: 5, window: 600 }
export function isUserRateLimited(
  rule: RateLimitRule,
  userId: string,
): Promise<boolean>;
```

Permisos:

| Acción                | Quién                     | Sobre qué                                    |
| --------------------- | ------------------------- | -------------------------------------------- |
| Valorar               | cualquier usuario         | post `publicado`                             |
| Comentar              | cualquier usuario         | post `publicado`                             |
| Borrar comentario     | quien lo escribió         | su comentario, en cualquier estado           |
| Ver "Mis comentarios" | el usuario de la sesión   | sus comentarios, en cualquier estado y post  |
| Votar "Útil"          | cualquiera menos su autor | comentario `aprobado` de un post `publicado` |
| Responder / editar    | `post.author_id`          | comentario `aprobado` de su post             |
| Borrar respuesta      | `post.author_id`          | comentario con respuesta de su post          |

Mensajes:

| Caso                                     | Mensaje                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Sin sesión                               | "Iniciá sesión para continuar."                                           |
| Texto fuera de 2–2000 caracteres         | "El texto tiene que tener entre 2 y 2000 caracteres."                     |
| Límite de comentarios                    | "Publicaste varios comentarios seguidos. Probá de nuevo en unos minutos." |
| Comentario publicado                     | "Tu comentario quedó en revisión."                                        |
| Falla al valorar                         | "No pudimos guardar tu valoración."                                       |
| Falla al comentar                        | "No pudimos publicar tu comentario."                                      |
| Falla al borrar                          | "No pudimos borrar el comentario."                                        |
| Falla al votar                           | "No pudimos registrar tu voto."                                           |
| Falla al responder o borrar la respuesta | "No pudimos guardar la respuesta."                                        |

Un permiso que no se cumple o un id que no existe devuelve el mensaje de falla de esa acción, sin decir por qué.

Estados en "Mis comentarios":

| `comment.status` | Badge         |
| ---------------- | ------------- |
| `pendiente`      | "En revisión" |
| `aprobado`       | "Publicado"   |
| `oculto`         | "Oculto"      |

Convenciones:

- El texto se guarda con `trim`. No se acepta HTML: se muestra como texto plano, como hoy.
- `updateTag` recibe `comments:<postId>`, el tag que SPEC 13 puso en `cachedRatingSummary` y `cachedApprovedComments`.
- `getViewerState`, `getUserComments` y las escrituras no pasan por `db/blog-cache.ts`.
- `PublicComment` sigue sin `userId` ni email. Lo propio se identifica con `ownCommentIds`.

## Plan de implementación

1. **Escrituras en la base.** Crear `db/blog-community.ts` sin `getViewerState` y `__tests__/db/blog-community.test.ts`. Prueba: `npm run test:db` pasa.
2. **Estado del lector.** Sumar `getViewerState` y sus casos. Prueba: `npm run test:db` pasa.
3. **Límite por usuario.** Regla `comment` e `isUserRateLimited` en `lib/auth/rate-limit.ts`. Prueba: `npm run test:db` pasa, incluido `rate-limit.test.ts`.
4. **Acciones.** Crear `app/(site)/blog/community-actions.ts` y `__tests__/db/community-actions.test.ts`. Prueba: `npm run test:db` y `npx tsc --noEmit` pasan.
5. **Artículo con `viewer`.** El artículo lee la sesión y `getViewerState`, y `ReviewsSection` recibe `viewer` sin usarlo todavía. Prueba: `npm run build` sin `DATABASE_URL` pasa y el artículo se ve igual.
6. **Valorar y comentar.** Bloque "Tu opinión" con estrellas y formulario, pendientes con "En revisión" y "Borrar" con confirmación. Revisar con `/frontend-design`. Casos en `reviews-section.test.tsx`. Prueba: `npm run test:run` pasa.
7. **"Útil" real.** Toggle con `toggleVoteAction`, enlace a login sin sesión y texto en comentarios propios. Casos en `reviews-section.test.tsx`. Prueba: `npm run test:run` pasa.
8. **Responder.** Editor inline, editar y borrar respuesta para el autor del post. Casos en `reviews-section.test.tsx`. Prueba: `npm run test:run` pasa.
9. **Comentarios del usuario en la base.** Sumar `getUserComments` y `loadMoreUserCommentsAction`, con sus casos en `blog-community.test.ts` y `community-actions.test.ts`. Prueba: `npm run test:db` pasa.
10. **"Mis comentarios" en el perfil.** Crear `components/account/my-comments.tsx` y la sección en `/cuenta/perfil` con su `<Suspense>`. Revisar con `/frontend-design`. Crear `my-comments.test.tsx`. Prueba: `npm run test:run` pasa y `npm run build` sin `DATABASE_URL` pasa.
11. **E2E.** Crear `e2e/comunidad.spec.ts`. Prueba: `npm run test:e2e` pasa.

## Criterios de aceptación

- [x] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [x] `npm run test:run` pasa con Docker apagado.
- [x] `npm run test:db` pasa con Docker levantado, incluidos los tests de SPEC 07 a 13.
- [x] `npm run test:e2e` pasa, incluidos `blog.spec.ts` y `auth.spec.ts`.
- [ ] Los jobs `checks`, `db` y `e2e` del CI pasan en un PR a `main`.
- [x] No hay migraciones nuevas: `npm run db:generate` no crea archivos.
- [x] `upsertRating` dos veces con el mismo usuario y post deja una sola fila con el último valor.
- [x] `upsertRating` sobre un post `borrador` devuelve `false` y no inserta.
- [x] `createComment` guarda el comentario `pendiente`, con el texto sin espacios al principio ni al final.
- [x] `deleteOwnComment` de un comentario ajeno devuelve `null` y no borra.
- [x] `deleteOwnComment` borra también los votos de ese comentario.
- [x] `toggleVote` dos veces deja el comentario sin el voto y devuelve `usefulCount` igual al inicial.
- [x] `toggleVote` sobre un comentario propio o `pendiente` devuelve `null`.
- [x] `saveReply` de un usuario que no es el autor del post devuelve `null` y no escribe.
- [x] `saveReply` sobre un comentario con respuesta la reemplaza y actualiza `replied_at`.
- [x] `deleteReply` deja `reply_text` y `replied_at` en `null`.
- [x] `getViewerState` devuelve la valoración, los votos, los aprobados propios y los pendientes propios del usuario, y nada de otros usuarios ni de otros posts.
- [x] `getViewerState` devuelve `isPostAuthor: true` solo para el autor del post.
- [x] Toda acción sin sesión devuelve `{ status: "error", message: "Iniciá sesión para continuar." }` y no escribe.
- [x] `createCommentAction` con `" a "` o con 2001 caracteres devuelve el error de largo.
- [x] El sexto `createCommentAction` del mismo usuario en 10 minutos devuelve el error de límite y no inserta.
- [x] `rateAction(postId, 6)` y `rateAction("basura", 5)` devuelven error y no lanzan.
- [x] `rateAction`, `deleteCommentAction`, `saveReplyAction` y `deleteReplyAction` llaman a `updateTag("comments:<postId>")`.
- [x] `createCommentAction` y `toggleVoteAction` no llaman a `updateTag`.
- [x] Sin sesión, el artículo muestra "Iniciá sesión para comentar y puntuar", "Útil" lleva a `/cuenta/login?volver=/blog/<slug>` y no hay "Responder".
- [x] Con sesión, el artículo muestra "Tu valoración" con la valoración guardada marcada.
- [x] Elegir 4 estrellas en `senales-sistema-a-medida` con un usuario nuevo cambia el total a 25 al recargar.
- [x] "Publicar" está deshabilitado con el `textarea` vacío o con un solo carácter.
- [x] Publicar un comentario lo muestra arriba con "En revisión", y sigue ahí al recargar.
- [x] Otro usuario, o alguien sin sesión, no ve ese comentario pendiente.
- [x] "Borrar" pide confirmación inline, y "Sí, borrar" quita el comentario, que no vuelve al recargar.
- [x] Votar "Útil" en el comentario de Lucía cambia "Útil · 12" a "Útil · 13" con `aria-pressed="true"`, y al recargar sigue marcado.
- [x] En sus propios comentarios aprobados, el lector ve "Útil · N" como texto y no como botón.
- [x] El autor del post ve "Responder" en los aprobados sin respuesta, y publicar una respuesta la muestra con el badge "Autor".
- [x] Un lector que no es el autor del post no ve "Responder", "Editar" ni "Borrar" en las respuestas.
- [x] `ReviewsSection`: si una acción devuelve error, se muestra su mensaje en un `role="status"` y el control vuelve a su estado anterior.
- [x] `deleteOwnComment` borra un comentario propio `oculto`.
- [x] `getUserComments` devuelve los comentarios del usuario en los tres estados y en varios posts, ordenados por `createdAt` descendente, y ninguno de otro usuario.
- [x] Recorrer `getUserComments(userId, { limit: 2 })` con cursor devuelve cada comentario una sola vez.
- [x] `getUserComments` marca `post.published: false` en un comentario de un post `borrador`.
- [x] `loadMoreUserCommentsAction` sin sesión devuelve "Iniciá sesión para continuar.", y con un cursor inválido devuelve error y no lanza.
- [x] `/cuenta/perfil` muestra "Mis comentarios" con los badges "En revisión", "Publicado" y "Oculto" según el estado de cada comentario.
- [x] En "Mis comentarios", el título de un post publicado enlaza a `/blog/<slug>#valoraciones`, y el de un post `borrador` no es un enlace.
- [x] Un comentario con respuesta muestra "Respuesta del autor" con el texto y la fecha de la respuesta.
- [x] Con 25 comentarios, "Mis comentarios" muestra 20 y "Ver más comentarios", y al hacer clic muestra 25 y el botón desaparece.
- [x] Borrar desde "Mis comentarios" pide confirmación inline, quita el comentario de la lista y, si estaba publicado, deja de verse en el artículo al recargar.
- [x] Un usuario sin comentarios ve "Todavía no comentaste ningún artículo." y el enlace "Ir al blog".
- [x] `e2e/comunidad.spec.ts`: un usuario verificado valora, comenta, ve "En revisión", vota "Útil" y borra su comentario.
- [x] `e2e/comunidad.spec.ts`: un usuario verificado comenta, ve el comentario "En revisión" en `/cuenta/perfil` y lo borra desde ahí.
- [x] `e2e/comunidad.spec.ts`: un usuario verificado, autor de un post publicado y de un comentario aprobado creados por SQL en el test, responde, edita y borra la respuesta.

## Decisiones

- **Sí:** los comentarios nacen `pendiente` y solo su autor los ve, con "En revisión". Respeta SPEC 09: nada se publica sin aprobación. Elegido por el usuario.
- **No:** aprobar al instante. Sin moderación no habría forma de ocultar spam.
- **No:** `/admin/comentarios` en este spec. La moderación va en su propio spec. Mientras tanto, los comentarios nuevos no se ven públicamente. Elegido por el usuario.
- **Sí:** responde solo el autor del post (`post.author_id`), un nivel, con crear, editar y borrar. Es el modelo de SPEC 09 y la firma de la respuesta es la del autor del post. Elegido por el usuario.
- **No:** hilos entre lectores. Necesitan `parent_id`, migración y decisiones de profundidad y moderación.
- **No:** que cualquier admin responda. El esquema no guarda quién respondió y la firma sería falsa.
- **Sí:** valorar y comentar por separado. Una valoración por usuario con upsert, varios comentarios. Elegido por el usuario.
- **No:** un solo formulario con estrellas y texto. Es confuso al comentar por segunda vez.
- **Sí:** "Útil" como toggle con sesión, sin votar el propio comentario. Elegido por el usuario.
- **Sí:** cambiar la valoración y borrar comentarios propios, sin editar comentarios ni quitar la valoración. Editar un aprobado saltearía la moderación. Elegido por el usuario.
- **Sí:** `updateTag("comments:<postId>")` al valorar, borrar y responder, porque cambian datos públicos cacheados. Elegido por el usuario.
- **Sí:** "Útil" no invalida la caché. El contador lo ajusta el cliente con el conteo real que devuelve la acción. Evita vaciar la caché en cada clic. Elegido por el usuario.
- **Sí:** `createCommentAction` tampoco invalida. El comentario nace `pendiente` y no está en ninguna lectura cacheada. Refina la regla anterior: invalidar no cambiaría nada.
- **No:** sacar la sección de la caché. Desharía parte de SPEC 13.
- **Sí:** lo propio del lector se lee sin caché con `getViewerState`, separado de lo público. La caché pública no depende de quién mira.
- **Sí:** texto de 2 a 2000 caracteres y 5 comentarios cada 10 minutos por usuario. Valorar y "Útil" no se limitan porque son idempotentes por PK. Elegido por el usuario.
- **Sí:** límite por usuario, no por IP. Sin proxy configurado todos comparten el bucket `local` de `isRateLimited`.
- **Sí:** bloque "Tu opinión" en lugar del bloque de login, con estrellas que guardan al elegir y el formulario debajo. Elegido por el usuario.
- **Sí:** pendientes arriba con "En revisión" y borrar con confirmación inline. Elegido por el usuario.
- **No:** `window.confirm`. Rompe el estilo del sitio y bloquea las pruebas automatizadas.
- **Sí:** acciones en `community-actions.ts`, separadas de `actions.ts`. Las de `actions.ts` son públicas y sin sesión, y conviene que no se mezclen.
- **Sí:** las acciones no dicen por qué falló un permiso. No revelan si un comentario existe o de quién es.
- **Sí:** "Mis comentarios" como sección de `/cuenta/perfil`, con su propio `<Suspense>`. Es donde el usuario ya mira su cuenta y no suma una ruta. Elegido por el usuario.
- **No:** ruta aparte `/cuenta/comentarios`. Suma una ruta y un enlace en el menú para una sola lista.
- **Sí:** mostrar también los comentarios `oculto`, con su badge. Es transparente con el usuario y le deja borrarlos. Elegido por el usuario.
- **Sí:** cada comentario muestra el post, la fecha, el estado, el texto completo y la respuesta del autor. Elegido por el usuario.
- **Sí:** 20 por página con "Ver más comentarios", sin filtro por estado. Reusa el cursor de SPEC 12 y `LoadMore`. Elegido por el usuario.
- **Sí:** `loadMoreUserCommentsAction` toma el usuario de la sesión, nunca de un parámetro. Nadie puede pedir los comentarios de otro.
- **Sí:** los comentarios de un post que volvió a `borrador` siguen en la lista, sin enlace. El usuario puede verlos y borrarlos.
- **Sí:** tests `db`, `client` y E2E. Elegido por el usuario.
- **Sí:** el E2E del autor crea su propio post por SQL. El autor del seed (`autor-e2e`) no tiene contraseña y no puede iniciar sesión.

## Riesgos

| Riesgo                                                                                                          | Mitigación                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Después de votar "Útil" y recargar, el contador cacheado puede no incluir el voto aunque el botón esté marcado. | Aceptado: dura hasta que expire la caché (1 h) o hasta la próxima escritura que la invalide. El clic siempre muestra el conteo real.  |
| El resumen no se actualiza después de valorar si `ReviewsSection` lo guarda en un estado.                       | El resumen se lee de las props. Un criterio de aceptación verifica el total después de valorar.                                       |
| Leer la sesión en el artículo rompe el build o el prerender.                                                    | La lectura va dentro del `<Suspense>` que ya hace `await connection()`. El criterio de `npm run build` sin `DATABASE_URL` lo detecta. |
| Un comentario cargado con "Ver más" no sabe si es propio o si fue votado.                                       | `viewer` trae todos los ids votados y propios del post, no solo los de la primera página.                                             |
| Un lector con muchos comentarios votados hace grande a `viewer`.                                                | Aceptado: son ids de un solo post. El límite de comentarios acota los pendientes.                                                     |
| Los tests E2E de comentarios chocan con el límite de 5 cada 10 minutos.                                         | Cada test usa un usuario nuevo y `clearRateLimit()` ya corre en `global-setup`.                                                       |
| Un comentario pendiente nunca se aprueba hasta el spec de moderación.                                           | Aceptado por el usuario. El autor lo ve con "En revisión" y puede borrarlo.                                                           |

## Qué **no** incluye este spec

- Moderación de comentarios y `/admin/comentarios`.
- Hilos entre lectores.
- Editar comentarios o quitar la valoración.
- Respuestas de admins que no son el autor del post.
- Notificaciones por email.
- Antispam más allá del límite de comentarios.
- Ordenar comentarios en el servidor.
- Rate limit e invalidación de caché para "Útil".
- Ruta `/cuenta/comentarios`, filtro por estado, y valoraciones o votos en el perfil.

Cada uno de estos, si llega, va en su propio spec.
