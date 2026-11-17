# SPEC 12 — Paginación de consultas

> **Estado:** Implementado
> **Depende de:** SPEC 09, SPEC 10, SPEC 11
> **Fecha:** 2026-11-16
> **Objetivo:** Paginar con cursor `listMedia`, `getPublishedPosts` y `getApprovedComments`, sacar el N+1 de `listMedia` y sumar "Cargar más" en `/admin/medios` sin cambiar su diseño.

## Por qué existe este spec

Las tres funciones de listado traen todas las filas de una vez.
`listMedia()` además hace 2 consultas por imagen para calcular su uso: el propio código lo marca como `shortcut` en `db/media.ts`.
`/admin/medios` es la única página que hoy lista desde la base, así que es la única que suma navegación.
`getPublishedPosts` y `getApprovedComments` todavía no tienen página que las llame: quedan paginadas para el spec que pase `/blog` a la base.

Tres decisiones marcan el diseño:

- Paginación por cursor (keyset) sobre `(fecha, id)`, no por `OFFSET`. No salta ni repite filas si se sube o publica algo mientras se navega.
- Las funciones existentes cambian de firma y devuelven `{ items, nextCursor }`. No quedan dos caminos para lo mismo.
- "Sin tocar diseño": la grilla, las tarjetas, el contador y el formulario se ven igual. Lo único visible nuevo es un botón "Cargar más" con el estilo de botón que ya usan las tarjetas.

**Referencias:**

- `node_modules/next/dist/docs/01-app/` — Server Actions llamadas desde un componente cliente y `revalidatePath`.
- La documentación de Drizzle: `sql` para comparar filas `(a, b) < (x, y)`, `inArray`, `count`.
- La documentación de Postgres: comparación de filas y `jsonb_array_elements`.

## Alcance

**Incluye:**

- `lib/pagination.ts` (sin `server-only`, para probarlo en el proyecto `server`):
  - Tipos `Page<T>` y `PageParams`.
  - `encodeCursor` y `decodeCursor`: cursor opaco en base64url de `{ t, id }`. `decodeCursor` valida con Zod y lanza `InvalidCursorError` si no cumple.
  - `resolveLimit(limit, defaultLimit)`: devuelve el default si `limit` es `undefined` y recorta a 1–100 en cualquier otro caso.
- `db/media.ts`:
  - `listMedia(params?: PageParams)` devuelve `Page<MediaItem>`, 24 por defecto, ordenado por `(created_at, id)` descendente.
  - El uso de todas las imágenes de una página se resuelve con 2 consultas en total, sin importar cuántas imágenes haya: una para portadas (`inArray(post.coverMediaId, ids)`) y una para cuerpos con `jsonb_array_elements`.
  - `getMediaUsage(id)` usa la misma resolución por lote con un solo id. Su resultado no cambia.
  - `countMedia()` nueva: total de filas de `media`.
- `db/blog.ts`:
  - `getPublishedPosts(params?: PageParams)` devuelve `Page<PostSummary>`, 12 por defecto, ordenado por `(published_at, id)` descendente. Las etiquetas siguen saliendo de una sola consulta adicional por página.
  - `getApprovedComments(postId, params?: PageParams)` devuelve `Page<PublicComment>`, 20 por defecto, ordenado por `(created_at, id)` descendente.
- `/admin/medios`:
  - `page.tsx` pide la primera página con `listMedia()` y el total con `countMedia()`, y se los pasa a `MediaGrid`.
  - `app/(site)/admin/medios/media-grid.tsx` (`"use client"`): nuevo. Tiene el contador, la `<ul>` y el botón. Mantiene en estado las imágenes cargadas, el `nextCursor` y el total.
  - El contador "1 imagen" / "N imágenes" muestra el total real, no las cargadas, con las mismas clases que hoy.
  - "Cargar más" va debajo de la grilla, centrado, con la clase `btn` que hoy está en `media-card.tsx` (se mueve a `app/(site)/admin/medios/styles.ts` y la importan los dos). No se muestra si `nextCursor` es `null`.
  - Mientras carga, el botón queda `disabled`, con `aria-busy` y el texto "Cargando…". Si falla, se muestra "No pudimos cargar más imágenes." con `FormMessage` y el botón vuelve a habilitarse.
  - `app/(site)/admin/medios/card-item.ts`: `toCardItem(item: MediaItem)` arma los datos de `MediaCard` (incluida la fecha formateada). Lo usan la página y la acción, para que las dos rendericen igual.
  - `loadMoreMediaAction(cursor: string)` en `actions.ts`: llama a `requireAdmin()`, valida el cursor con Zod (string de 1 a 200 caracteres) y devuelve `{ status: "success", items, nextCursor }` o `{ status: "error", message }`. No revalida.
- Comportamiento ante cambios en `/admin/medios`:
  - Subir una imagen sigue llamando a `revalidatePath`. `MediaGrid` se monta con `key` igual a los ids de la primera página unidos, así que una imagen nueva lo reinicia a la primera página.
  - Subir un duplicado no cambia la primera página y no reinicia nada.
  - Borrar deja de llamar a `revalidatePath`. `MediaCard` suma `onDeleted()`, y `MediaGrid` saca la tarjeta del estado y resta 1 al total. Las páginas cargadas se conservan.
  - Editar el alt deja de llamar a `revalidatePath`. `MediaCard` suma `onAltSaved(alt)`, y `MediaGrid` actualiza ese item en el estado.
- Tests (casos en los criterios de aceptación):
  - Vitest `server`: `__tests__/server/pagination.test.ts`.
  - Vitest `client`: `__tests__/client/media-grid.test.tsx`, con `loadMoreMediaAction` mockeada.
  - Vitest `db`: casos nuevos en `media.test.ts` y `blog-queries.test.ts`. Los usos actuales de `listMedia`, `getPublishedPosts` y `getApprovedComments` en `media.test.ts`, `blog-queries.test.ts` y `blog-seed.test.ts` pasan a leer `.items`.
  - Playwright: caso nuevo en `e2e/medios.spec.ts`. Usa un helper `seedMedia(n)` en `e2e/helpers.ts` que inserta `n` filas con `sql` (fechas separadas por un segundo) y copia `e2e/fixtures/imagen.webp` a `test-results/media/<id>.webp`.

**Fuera de alcance (para specs futuros):**

- Pasar `/blog`, `/blog/[slug]` y la home a leer de la base, y su UI de paginación.
- Paginar `getTags()` y `getCategories()`. Son listas cortas y el filtro las necesita completas.
- Búsqueda o filtros en `/admin/medios`.
- Navegación por número de página, "página X de N" o paginación en la URL.
- Scroll infinito.
- Migraciones o índices nuevos.
- Cualquier cambio visual en la grilla, las tarjetas, el contador o el formulario de subida.

## Modelo de datos

No hay tablas, columnas ni índices nuevos. Cambian tipos y firmas.

```ts
// lib/pagination.ts
export type Page<T> = { items: T[]; nextCursor: string | null };
export type PageParams = { limit?: number; cursor?: string | null };
export class InvalidCursorError extends Error {}

type CursorData = {
  t: string; // la fecha como texto de Postgres, con microsegundos: "2026-11-16 10:00:00.123456"
  id: string;
};
export function encodeCursor(data: CursorData): string; // base64url(JSON)
export function decodeCursor(cursor: string): CursorData; // lanza InvalidCursorError
export function resolveLimit(
  limit: number | undefined,
  defaultLimit: number,
): number; // 1..100

// db/media.ts
export function listMedia(params?: PageParams): Promise<Page<MediaItem>>; // 24 por defecto
export function countMedia(): Promise<number>;

// db/blog.ts
export function getPublishedPosts(
  params?: PageParams,
): Promise<Page<PostSummary>>; // 12
export function getApprovedComments(
  postId: string,
  params?: PageParams,
): Promise<Page<PublicComment>>; // 20

// app/(site)/admin/medios/actions.ts
export function loadMoreMediaAction(
  cursor: string,
): Promise<
  | { status: "success"; items: CardItem[]; nextCursor: string | null }
  | { status: "error"; message: string }
>;
```

Cómo se arma cada página:

1. Se pide `limit + 1` filas, ordenadas por `(fecha, id)` descendente.
2. Con cursor, se agrega `(fecha, id) < (${t}::timestamp, ${id})` al `where`, con comparación de filas de Postgres.
3. Si vuelven `limit + 1` filas, se descarta la última y `nextCursor` es el cursor de la fila `limit`. Si no, `nextCursor` es `null`.
4. La fecha del cursor sale de la misma consulta como `fecha::text`, no de un `Date` de JS.

| Función               | Fecha          | Filtro                                 | Default |
| --------------------- | -------------- | -------------------------------------- | ------- |
| `listMedia`           | `created_at`   | ninguno                                | 24      |
| `getPublishedPosts`   | `published_at` | `status = 'publicado'`                 | 12      |
| `getApprovedComments` | `created_at`   | `post_id = $1` y `status = 'aprobado'` | 20      |

Validación de `decodeCursor` (Zod sobre el JSON decodificado):

- `t`: string con formato `YYYY-MM-DD HH:MM:SS` y de 1 a 6 decimales opcionales.
- `id`: UUID.
- Cualquier otra cosa (base64 inválido, JSON inválido, campos de más o de menos) lanza `InvalidCursorError`.

Convenciones:

- Los cursores son opacos: nadie fuera de `lib/pagination.ts` los arma ni los lee.
- Un cursor vale para la función que lo generó. Pasarlo a otra función no está soportado.
- El id desempata filas con la misma fecha.

## Plan de implementación

1. **Utilidades de paginación.** Crear `lib/pagination.ts` y `__tests__/server/pagination.test.ts`. Prueba: `npm run test:run` pasa.
2. **`listMedia` paginada y sin N+1.** Cambiar `listMedia`, `getMediaUsage` y sumar `countMedia` en `db/media.ts`. `page.tsx` pasa a usar `.items`, todavía sin botón. Casos en `media.test.ts`. Prueba: `npm run test:db` pasa y `/admin/medios` se ve igual con hasta 24 imágenes.
3. **Blog paginado.** Cambiar `getPublishedPosts` y `getApprovedComments`, y actualizar `blog-queries.test.ts` y `blog-seed.test.ts`. Prueba: `npm run test:db` pasa, incluidos los tests de SPEC 07 a 11.
4. **Acción y datos de tarjeta.** Crear `card-item.ts` y `loadMoreMediaAction`, y mover `btn` a `styles.ts`. Prueba: `npx tsc --noEmit` pasa y `/admin/medios` se ve igual.
5. **`MediaGrid` con "Cargar más".** Crear `media-grid.tsx`, sumar `onDeleted` y `onAltSaved` a `MediaCard` y quitar `revalidatePath` de borrar y editar alt. Revisar con `/frontend-design` que la grilla no cambie y que el botón use el estilo existente. `__tests__/client/media-grid.test.tsx`. Prueba: `npm run test:run` pasa y en `npm run dev`, con 30 imágenes, "Cargar más" suma 6 y desaparece.
6. **E2E.** Fixture `e2e/fixtures/imagen.webp`, helper `seedMedia(n)` y el caso nuevo en `e2e/medios.spec.ts`. Prueba: `npm run test:e2e` pasa.

## Criterios de aceptación

- [x] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [x] `npm run test:run` pasa con Docker apagado.
- [x] `npm run test:db` pasa con Docker levantado, incluidos los tests de SPEC 07 a 11.
- [x] `npm run test:e2e` pasa, incluidos los casos de `medios.spec.ts` de SPEC 10.
- [ ] Los jobs `checks`, `db` y `e2e` del CI pasan en un PR a `main`.
- [x] No hay migraciones nuevas: `npm run db:generate` no crea archivos.
- [x] `decodeCursor(encodeCursor(x))` devuelve `x`.
- [x] `decodeCursor` lanza `InvalidCursorError` con `"abc"`, con un JSON sin `id`, con un `id` que no es UUID y con un `t` que no es fecha.
- [x] `resolveLimit(undefined, 24)` devuelve 24, `resolveLimit(0, 24)` devuelve 1 y `resolveLimit(500, 24)` devuelve 100.
- [x] Con 30 imágenes, `listMedia()` devuelve 24 y un `nextCursor`, y `listMedia({ cursor })` devuelve las 6 restantes y `nextCursor: null`.
- [x] Recorrer `listMedia` con `limit: 2` sobre 5 imágenes con el mismo `created_at` devuelve las 5 una sola vez cada una, en orden de `id` descendente.
- [x] Recorrer `listMedia` con `limit: 2` sobre imágenes cuyo `created_at` difiere en microsegundos no salta ni repite ninguna.
- [x] Subir una imagen después de pedir la primera página no hace que la segunda página repita una imagen.
- [x] `listMedia()` resuelve el uso de una página de 24 imágenes con un número fijo de consultas, el mismo que con 2 imágenes (test que cuenta las consultas, como el de etiquetas de SPEC 11).
- [x] `listMedia()` devuelve en cada imagen el mismo `usage` que `getMediaUsage(id)`, con portadas y cuerpos de posts `borrador` y `publicado`.
- [x] Los tests existentes de `getMediaUsage` y `deleteMedia` pasan sin cambios.
- [x] `countMedia()` devuelve el total de filas de `media`.
- [x] Con 14 posts publicados y 2 borradores, `getPublishedPosts()` devuelve 12 y la segunda página devuelve 2, sin borradores.
- [x] `getPublishedPosts` desempata por `id` dos posts con el mismo `published_at`.
- [x] `getPublishedPosts()` sigue resolviendo las etiquetas con una sola consulta adicional por página.
- [x] `getApprovedComments(postId, { limit: 2 })` recorre todos los comentarios aprobados del post sin pendientes ni ocultos, y trae rating, votos y respuesta como antes.
- [x] Cualquiera de las tres funciones con un cursor inválido lanza `InvalidCursorError`.
- [ ] `/admin/medios` con 3 imágenes se ve igual que antes de este spec y no muestra "Cargar más".
- [x] `/admin/medios` con 30 imágenes muestra 24 tarjetas, el texto "30 imágenes" y el botón "Cargar más".
- [x] `MediaGrid`: al hacer clic en "Cargar más" el botón queda `disabled` con "Cargando…", después se suman las tarjetas, y el botón desaparece si `nextCursor` es `null`.
- [x] `MediaGrid`: si la acción devuelve error, se muestra "No pudimos cargar más imágenes." y el botón vuelve a estar habilitado.
- [ ] Llamar a `loadMoreMediaAction` sin sesión de admin no devuelve imágenes.
- [ ] `loadMoreMediaAction("basura")` devuelve `{ status: "error" }` y no lanza.
- [x] E2E: con 30 imágenes, "Cargar más" deja 30 tarjetas y el botón desaparece.
- [x] E2E: después de cargar las 30, borrar una de la segunda tanda la saca de la grilla, el contador dice "29 imágenes" y siguen visibles las otras 29.
- [x] E2E: después de cargar las 30, subir una imagen nueva vuelve a 24 tarjetas con la nueva primera y el contador dice "31 imágenes".
- [x] E2E: editar el alt de una imagen de la segunda tanda lo muestra sin recargar, y después de recargar y cargar más sigue el alt nuevo.

## Decisiones

- **Sí:** paginar `listMedia`, `getPublishedPosts` y `getApprovedComments` en la capa de datos. Las del blog quedan listas para cuando las páginas lean de la base. Elegido por el usuario.
- **No:** paginar `getTags()` y `getCategories()`. Son listas cortas y el filtro de `/blog` las necesita completas.
- **Sí:** cursor (keyset) sobre `(fecha, id)`. Estable si cambian los datos entre páginas y no se degrada con muchas filas. Elegido por el usuario.
- **No:** `limit` y `offset` con total. Salta o repite filas cuando se sube o publica algo mientras se navega.
- **Sí:** la fecha del cursor como texto de Postgres. Las columnas guardan microsegundos y un `Date` de JS los corta a milisegundos, lo que haría saltar filas.
- **Sí:** cambiar la firma de las funciones existentes a `Page<T>`. No quedan dos versiones de la misma consulta. Elegido por el usuario.
- **No:** funciones nuevas `*Page` junto a las actuales. Duplica código y deja una versión sin límite a mano.
- **Sí:** "Cargar más" en `/admin/medios`, con el estilo de botón existente. Elegido por el usuario.
- **No:** enlaces Anterior/Siguiente en la URL o navegación por número de página.
- **Sí:** subir reinicia a la primera página; borrar y editar alt actualizan el estado local sin perder lo cargado. Elegido por el usuario.
- **Sí:** borrar y editar alt dejan de llamar a `revalidatePath`. Si revalidaran, la primera página cambiaría y `MediaGrid` se reiniciaría o mostraría duplicados.
- **Sí:** el contador muestra el total real con `countMedia()`. Mismo texto que hoy, sin cambio visual. Elegido por el usuario.
- **Sí:** tamaños por defecto de 24 imágenes, 12 posts y 20 comentarios, con máximo de 100. 24 llena filas de 2, 3 y 4 columnas. Elegido por el usuario.
- **No:** migración con índices compuestos que terminen en `id`. Los índices actuales por fecha alcanzan con el volumen actual; el `id` solo desempata. Elegido por el usuario.
- **Sí:** el uso de las imágenes por lote con 2 consultas por página. Saca el N+1 que el código marcaba como `shortcut`.
- **Sí:** cursor inválido lanza `InvalidCursorError` en la capa de datos, y la acción lo convierte en un mensaje. Un cursor roto es un error, no "volver a empezar" en silencio.
- **Sí:** el E2E carga las imágenes con SQL y un WebP de fixture. Subir 30 por la UI haría el test lento.

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                                 |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| La fecha con microsegundos se pierde en el cursor y se saltan o repiten filas.                | El cursor guarda `fecha::text` y compara con `::timestamp`. Un test con fechas que difieren en microsegundos lo cubre.     |
| `MediaGrid` muestra datos viejos si otro admin cambia la biblioteca a la vez.                 | Recargar la página trae todo fresco. La biblioteca la usa un solo admin a la vez; no se resuelve en este spec.             |
| La consulta con `jsonb_array_elements` no encuentra un `mediaId` que sí encuentra `@>`.       | `getMediaUsage` usa la misma consulta por lote, y sus tests de SPEC 10 tienen que pasar sin cambios.                       |
| Cambiar la firma rompe llamadas que no se vieron.                                             | `npx tsc --noEmit` las marca todas: el tipo de retorno pasa de array a objeto.                                             |
| Sin índices con `id`, el keyset ordena en memoria cuando muchas filas comparten fecha.        | No pasa con el volumen actual. Si crece, sumar los índices es una migración chica en otro spec.                            |
| El `key` de `MediaGrid` con los ids de la primera página no cambia y no se reinicia al subir. | Una imagen nueva siempre entra primera, así que cambia el primer id. El E2E de subir después de cargar las 30 lo verifica. |
| El E2E inserta filas sin archivo real y `next/image` loguea errores en consola.               | `seedMedia` copia `imagen.webp` a `test-results/media/<id>.webp` para cada fila.                                           |

## Qué **no** incluye este spec

- Páginas del blog leyendo de la base y su paginación visible.
- Paginación de etiquetas y categorías.
- Búsqueda o filtros de medios.
- Números de página, paginación en la URL o scroll infinito.
- Migraciones o índices nuevos.
- Cambios visuales en `/admin/medios` más allá del botón "Cargar más".

Cada uno de estos, si llega, va en su propio spec.
