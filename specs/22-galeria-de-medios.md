# SPEC 22 — Galería de Medios

> **Estado:** Implementado
> **Depende de:** SPEC 10, SPEC 12, SPEC 16, SPEC 20, SPEC 21
> **Fecha:** 2026-11-19
> **Objetivo:** Que `/admin/media` sea una galería de miniaturas con búsqueda y filtro de uso, un modal de detalle para ver, editar, copiar y borrar cada imagen, y un modal para subir hasta 10 imágenes a la vez.

## Por qué existe este spec

`/admin/media` sigue como la dejó SPEC 10: un formulario fijo de un archivo arriba y tarjetas grandes con el alt editable en línea. Con muchas imágenes se recorre mal, no se puede buscar (SPEC 20 lo dejó afuera a propósito) y no hay forma de ver dónde se usa una imagen y abrir ese artículo.

Tres decisiones marcan el diseño:

- **La grilla solo muestra; el modal actúa.** Cada miniatura es un botón que abre el detalle. Todas las acciones (editar, copiar, abrir, borrar) viven en el modal.
- **El archivo no cambia nunca.** Se editan el `alt` y el nombre, pero no se reemplaza la imagen. Así `/media/<id>` sigue sirviéndose con `Cache-Control: immutable` (SPEC 10).
- **La subida múltiple es una cola de subidas individuales.** El modal llama a `uploadMediaAction` una vez por archivo. Un archivo que falla no frena a los demás y no hace falta un request más grande que el `bodySizeLimit` de 11 MB.

**Referencias:**

- `app/(admin)/admin/media/` (`page.tsx`, `media-grid.tsx`, `media-card.tsx`, `upload-form.tsx`, `card-item.ts`, `styles.ts`).
- `db/media.ts` (`listMedia`, `countMedia`, `getUsageByMedia`, `updateMediaAlt`, `deleteMedia`), `db/schema/media.ts`, `actions/admin/media/index.ts`, `lib/media/process.ts` (`MEDIA_LIMITS`).
- `components/admin/media-picker/media-library.tsx` (búsqueda con espera, estados), `components/admin/confirm-dialog.tsx`, `components/admin/form-dialog.tsx`, `components/admin/page-header.tsx` (`actions`), `components/admin/toast.tsx` (`notify`).
- `lib/admin/tag-params.ts` como modelo de parámetros en la URL.
- `node_modules/next/dist/docs/01-app/` sobre `searchParams` como promesa, Cache Components y `updateTag`.

## Alcance

**Incluye:**

- **Página (`page.tsx`):**
  - Cabecera (`AdminPageHeader`) con el botón "Subir imágenes" en `actions`, que abre el modal de subida.
  - Lee `searchParams` y la base dentro de un `<Suspense>` con esqueleto de 12 miniaturas, después de `requireAdmin()`.
  - Desaparecen `upload-form.tsx` y `media-card.tsx`.

- **Barra de búsqueda y filtro (`media-toolbar.tsx`, cliente):**
  - Input "Buscar por texto alternativo o nombre de archivo" (`type="search"`, máx. 100), con 300 ms de espera después de la última tecla.
  - Filtro de uso como `radiogroup` con tres opciones: "Todas", "En uso" y "Sin usar".
  - Estado en la URL: `/admin/media?q=equipo&uso=sin-usar`. Se actualiza con `router.replace` y sin scroll. "Todas" y una búsqueda vacía no van en la URL.
  - Parámetros inválidos se ignoran (`uso=otro` → "Todas"; `q` de más de 100 se recorta).
  - Contador debajo: "{N} imágenes" / "1 imagen", que cuenta con la búsqueda y el filtro aplicados.

- **Grilla (`media-grid.tsx`, reescrita):**
  - De la más nueva a la más vieja, 24 por tanda, con "Cargar más" mientras haya `nextCursor` (como hoy).
  - Cambiar búsqueda o filtro reinicia la grilla a la primera tanda.
  - Columnas `repeat(auto-fill, minmax(160px, 1fr))`; a 390 px quedan 2.
  - **Miniatura (`media-tile.tsx`):** un `<button>` con `aria-label="Ver detalles de {alt}"` que contiene:
    - La imagen cuadrada (`object-cover`), con `next/image` y `alt=""` (el nombre ya está en el botón).
    - El `alt` recortado a una línea.
    - Una insignia "En uso" o "Sin usar".
  - Estados:

    | Estado                  | Texto                                                               |
    | ----------------------- | ------------------------------------------------------------------- |
    | Biblioteca vacía        | "Todavía no hay imágenes." + botón "Subir imágenes" (abre el modal) |
    | Sin resultados con `q`  | "No hay imágenes que coincidan con «{q}»."                          |
    | Sin resultados, sin `q` | "No hay imágenes en uso." / "No hay imágenes sin usar."             |
    | Error al cargar más     | Toast "No pudimos cargar más imágenes." (como hoy)                  |

- **Modal de detalle (`media-detail-dialog.tsx`, `<dialog>` nativo como `ConfirmDialog`):**
  - Se abre al tocar una miniatura. `Escape` o el botón `aria-label="Cerrar"` lo cierran y el foco vuelve a esa miniatura.
  - Título: el `alt` de la imagen.
  - **Izquierda:** la imagen entera (`object-contain`) sobre fondo `cms-head`.
  - **Derecha, datos:** "Texto alternativo", "Nombre del archivo", medidas (`1920 × 1080 px`), peso (`{KB} KB`) y fecha de subida.
  - **"En uso en":** lista de enlaces "{título} · portada" o "{título} · cuerpo" a `/admin/articles/{postId}/edit`. Sin uso: "Sin usar".
  - **Acciones:**

    | Botón            | Qué hace                                                                                              |
    | ---------------- | ----------------------------------------------------------------------------------------------------- |
    | "Editar"         | Cambia los datos a un formulario con "Texto alternativo" y "Nombre del archivo".                      |
    | "Copiar URL"     | Copia `{location.origin}/media/{id}`. Anuncia "URL copiada" en una región `aria-live`.                |
    | "Copiar id"      | Copia el `id`. Anuncia "Id copiado".                                                                  |
    | "Abrir original" | Enlace a `/media/{id}` con `target="_blank"` y `rel="noopener"`.                                      |
    | "Borrar"         | Abre `ConfirmDialog` "¿Borrar la imagen?" / "Se borra el archivo y no se puede deshacer." / "Borrar". |

  - Sin permiso de portapapeles, "Copiar URL" y "Copiar id" no hacen nada (como hoy).
  - Con uso, "Borrar" queda deshabilitado y debajo se lee "Está en uso: quitala de esos artículos para borrarla.".
  - **Editar:**
    - "Texto alternativo": obligatorio, `trim`, máx. 300.
    - "Nombre del archivo": obligatorio, `trim`, máx. 200.
    - Botones "Guardar cambios" (spinner y "Guardando…") y "Cancelar".
    - Errores debajo de cada campo (`aria-invalid`, `aria-describedby`) y foco al primero con error. La misma validación corre en el cliente y en el servidor.
    - **Aviso de uso:** si la imagen está en uso, el formulario muestra arriba de los botones "Esta imagen está en uso en: {títulos}. El texto alternativo nuevo se ve en esos artículos donde la imagen no tiene uno propio." Sin uso no se muestra.
    - Al guardar: toast con el mensaje de la action, vuelve a la vista de datos y la miniatura y el título muestran el `alt` nuevo sin recargar.
  - **Borrar:** al confirmar, toast "Imagen borrada.", el modal se cierra, la miniatura sale de la grilla, el contador baja en 1 y el foco va a la miniatura siguiente (o la anterior si era la última, o al buscador si no queda ninguna).
  - **Navegación:**
    - Botones "Imagen anterior" e "Imagen siguiente" y las teclas `←` / `→` recorren las imágenes ya cargadas en la grilla, con la búsqueda y el filtro aplicados.
    - Texto "{posición} de {cargadas}".
    - "Imagen anterior" está deshabilitado en la primera y "Imagen siguiente" en la última cargada.
    - Las flechas no navegan con el foco en un input, ni mientras se edita o se borra.
    - La URL no cambia.
  - Mide 1040 px de ancho máximo en escritorio. Por debajo de `md` ocupa la pantalla entera y apila la imagen arriba y los datos abajo.

- **Modal de subida (`upload-dialog.tsx`, `<dialog>` nativo):**
  - Título "Subir imágenes". Zona de arrastrar y soltar con el texto "Arrastrá imágenes acá o elegí archivos" y un botón "Elegir archivos" (`input type="file" multiple`, `accept` con los 4 tipos).
  - Hasta 10 archivos en la cola. Si se agregan más, entran los primeros hasta llegar a 10 y se lee "Podés subir hasta 10 imágenes a la vez.".
  - **Fila por archivo:** vista previa (`URL.createObjectURL`, liberada al quitar o cerrar), nombre y peso, input "Texto alternativo de {nombre}" obligatorio (máx. 300) y botón "Quitar {nombre}".
  - **Chequeo en el cliente al agregar:** tipo fuera de los 4 → "Formato no soportado. Subí una imagen JPEG, PNG, WebP o AVIF."; más de 10 MB → "La imagen supera el máximo de 10 MB.". Esa fila queda con el error y no se sube.
  - Botón "Subir {N} imágenes" (o "Subir 1 imagen"), deshabilitado mientras falte algún alt o no haya filas válidas.
  - **Subida:** de a un archivo, en orden, con `uploadMediaAction`. Cada fila muestra su estado:

    | Estado    | Texto en la fila                       |
    | --------- | -------------------------------------- |
    | Pendiente | (sin texto)                            |
    | Subiendo  | Spinner + "Subiendo…"                  |
    | Subida    | "Subida."                              |
    | Ya estaba | "Esa imagen ya estaba subida."         |
    | Error     | El mensaje de la action + "Reintentar" |

  - Mientras sube, "Cancelar", el cierre y `Escape` están deshabilitados, y no se pueden agregar ni quitar filas.
  - Al terminar, una región `aria-live` resume "Se subieron {N}. {M} ya estaban. {K} con error." (solo las partes que no son 0). El botón principal pasa a "Listo" y cierra el modal.
  - Las filas con error quedan con "Reintentar" (vuelve a subir solo esa fila).
  - **Confirmar al cerrar:** si hay filas sin subir (pendientes o con error), "Cancelar", el botón de cierre y `Escape` no cierran. En su lugar, el pie del modal cambia a:
    - El texto "Tenés {N} imágenes sin subir. ¿Descartarlas?" (o "Tenés 1 imagen sin subir. ¿Descartarla?"), anunciado en una región `aria-live`.
    - Los botones "Descartar" (cierra el modal y descarta las filas) y "Seguir editando" (vuelve al pie normal sin tocar la cola).
    - El foco pasa a "Seguir editando". Un segundo `Escape` equivale a "Seguir editando".
  - Sin filas sin subir (cola vacía o todo subido), cerrar no pregunta.
  - Si se subió al menos una, la grilla vuelve a la primera tanda con la búsqueda y el filtro actuales (`revalidatePath` y la `key` de la grilla, como hoy).

- **Consultas (`db/media.ts`):**
  - `MediaQuery` suma `usage?: "used" | "unused"`. "En uso" = es portada de algún post o está en un nodo `image` del cuerpo de algún post, de cualquier estado (la misma regla que `getMediaUsage`).
  - `countMedia` suma `{ query?, usage? }` con los mismos filtros que `listMedia`.
  - `updateMediaAlt` se reemplaza por `updateMedia(id, { alt, originalName })`, que devuelve `{ ok: false, reason: "not-found" }` si el id no existe.
  - `deleteMedia` con un id inexistente lanza `MediaNotFoundError`.

- **Actions (`actions/admin/media/index.ts`):**
  - `updateMediaAltAction` se reemplaza por `updateMediaAction(prev, data)` (`id`, `alt`, `originalName`). Devuelve errores por campo y llama a `updateTag("blog")`, porque el `alt` de Medios se usa en el blog cuando el nodo no tiene uno propio (SPEC 20).
  - Si el `alt` cambió y la imagen está en uso, después de guardar busca el uso con `getMediaUsage` y el mensaje de éxito nombra los artículos (sin repetir títulos). Si solo cambió el nombre, o la imagen no está en uso, el mensaje es "Cambios guardados.".
  - `loadMoreMediaAction` pasa a recibir `{ cursor, query, usage }`.
  - `uploadMediaAction`, `deleteMediaAction`, `searchMediaAction` y `uploadPickerMediaAction` no cambian de firma.
  - Todas llaman a `requireAdmin()` antes de tocar la base o el disco y validan con Zod.
  - Mensajes:

    | Caso                 | Mensaje                                                           |
    | -------------------- | ----------------------------------------------------------------- |
    | Guardado             | "Cambios guardados."                                              |
    | Guardado, alt en uso | "Cambios guardados. El texto alternativo cambió en: {títulos}."   |
    | Alt vacío (campo)    | "El texto alternativo no puede estar vacío."                      |
    | Nombre vacío (campo) | "El nombre del archivo no puede estar vacío."                     |
    | Id inexistente       | "Esa imagen ya no existe."                                        |
    | En uso al borrar     | "No se puede borrar: está en uso en {títulos}." (como hoy)        |
    | Error de base        | "No pudimos guardar el cambio. Intentá de nuevo en unos minutos." |

- **Selector del editor (SPEC 20):** no cambia. Sigue usando `searchMediaAction` y `uploadPickerMediaAction` con un archivo.

- **Diseño:** grilla, miniaturas, insignias, barra de búsqueda y filtro, modal de detalle, modal de subida, zona de arrastre y estados se hacen con `/frontend-design`, siguiendo el selector de SPEC 20 y los tokens `cms-*`. Todos los controles miden 44 px o más y cumplen 4.5:1 de contraste. A 390 px no hay scroll horizontal y los dos modales ocupan la pantalla.

- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `__tests__/server/media-params.test.ts` y `__tests__/server/media-form.test.ts`, nuevos.
  - Vitest `db`: `media.test.ts` y `media-picker-actions.test.ts` suman casos; `__tests__/db/media-actions.test.ts`, nuevo.
  - Vitest `client`: `__tests__/client/media-detail-dialog.test.tsx`, `__tests__/client/upload-dialog.test.tsx` y `__tests__/client/media-toolbar.test.tsx`, nuevos; `media-grid.test.tsx` se reescribe.
  - Playwright: `e2e/medios.spec.ts` se reescribe para la UI nueva con los mismos escenarios más los nuevos; `media-picker.spec.ts` sigue pasando.

**Fuera de alcance (para specs futuros):**

- Selección múltiple y borrado en lote.
- Reemplazar el archivo de una imagen.
- Recortar, rotar o elegir el foco.
- Vista de lista o tabla, y alternar entre vistas.
- Ordenar por nombre, peso o fecha de subida ascendente.
- Filtros por fecha, tamaño o formato.
- Abrir el detalle por URL (`?imagen=<id>`).
- Subida múltiple en el selector del editor.
- Carpetas, álbumes o etiquetas de imágenes.
- Seguir a la tanda siguiente desde "Imagen siguiente" en la última imagen cargada.

## Modelo de datos

No hay tablas, columnas ni migraciones nuevas. `media.original_name` pasa a ser editable.

```ts
// lib/admin/media-params.ts (nuevo, como tag-params.ts)
export const MEDIA_USAGE_FILTERS = ["en-uso", "sin-usar"] as const;
export type MediaUsageFilter = (typeof MEDIA_USAGE_FILTERS)[number];
export type AdminMediaQuery = {
  q: string | null;
  uso: MediaUsageFilter | null;
}; // null = "Todas"
export function parseMediaParams(
  params: Record<string, string | string[] | undefined>,
): AdminMediaQuery;
export function mediaQueryHref(query: AdminMediaQuery): string; // "/admin/media?q=…&uso=…"

// lib/admin/media-form.ts (nuevo, sin dependencias de servidor)
export const MEDIA_FORM_LIMITS = {
  alt: 300,
  originalName: 200,
  query: 100,
} as const;
export type MediaEditInput = { alt: string; originalName: string };
export function parseMediaForm(data: FormData):
  | { ok: true; id: string; input: MediaEditInput }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof MediaEditInput | "id", string>>;
    };
// Chequeo de archivo en el cliente, espejo de MEDIA_LIMITS (process.ts importa sharp).
export const UPLOAD_LIMITS = {
  maxFiles: 10,
  maxBytes: 10 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp", "image/avif"],
} as const;
export function checkUploadFile(file: {
  type: string;
  size: number;
}): string | null; // mensaje o null

// db/media.ts (cambia)
export type MediaQuery = PageParams & {
  query?: string;
  usage?: "used" | "unused";
};
export async function listMedia(params?: MediaQuery): Promise<Page<MediaItem>>;
export async function countMedia(
  params?: Pick<MediaQuery, "query" | "usage">,
): Promise<number>;
export class MediaNotFoundError extends Error {}
export async function updateMedia(
  id: string,
  input: { alt: string; originalName: string },
): Promise<{ ok: true } | { ok: false; reason: "not-found" }>;
// updateMediaAlt se borra.

// app/(admin)/admin/media/card-item.ts (cambia)
export type CardItem = {
  id: string;
  src: string;
  alt: string;
  originalName: string;
  width: number;
  height: number;
  bytes: number;
  usage: { postId: string; title: string; as: "portada" | "cuerpo" }[];
  date: string;
};

// actions/admin/media/index.ts (cambia)
export type MediaFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<"alt" | "originalName", string>>;
    };
export async function updateMediaAction(
  prev: MediaFormState,
  data: FormData,
): Promise<MediaFormState>;
export async function loadMoreMediaAction(input: {
  cursor: string;
  query: string; // "" = sin filtro
  usage: "used" | "unused" | null;
}): Promise<LoadMoreState>;
// updateMediaAltAction se borra.
```

Archivos nuevos:

- `app/(admin)/admin/media/`: `media-toolbar.tsx`, `media-tile.tsx`, `media-detail-dialog.tsx`, `upload-dialog.tsx` y `upload-button.tsx` (botón de la cabecera que abre el modal).
- `lib/admin/media-params.ts`, `lib/admin/media-form.ts`.

Archivos que cambian: `app/(admin)/admin/media/page.tsx`, `media-grid.tsx`, `card-item.ts`, `styles.ts`, `db/media.ts`, `actions/admin/media/index.ts`.

Archivos que se borran: `app/(admin)/admin/media/media-card.tsx` y `upload-form.tsx`.

Convenciones:

- La URL guarda solo `q` y `uso`. El cursor y la imagen abierta viven en el estado del cliente.
- `CardItem` es lo único que viaja a la grilla. El modal de detalle no vuelve a pedir datos al servidor.
- El archivo en disco y `/media/<id>` nunca cambian después de subir.
- `UPLOAD_LIMITS` es un espejo de `MEDIA_LIMITS` para el cliente. El servidor sigue siendo la fuente de verdad con `processImage`.

## Plan de implementación

1. **Utilidades.** `lib/admin/media-params.ts` y `lib/admin/media-form.ts`, con `media-params.test.ts` y `media-form.test.ts`. Prueba: `npm run test:run` pasa.
2. **Consultas.** Filtro `usage` en `listMedia` y `countMedia`, `updateMedia`, `MediaNotFoundError` en `deleteMedia`, con casos en `media.test.ts`. Prueba: `npm run test:db` pasa y `/admin/media` se ve igual.
3. **Actions.** `updateMediaAction` (borrando `updateMediaAltAction` y adaptando `media-card.tsx` para que siga andando), `loadMoreMediaAction` con filtros, `CardItem` con `originalName` y `usage`, con `media-actions.test.ts` y casos en `media-picker-actions.test.ts`. Prueba: `npm run test:db` pasa.
4. **Grilla y barra.** `media-toolbar.tsx`, `media-tile.tsx`, `media-grid.tsx` reescrita y `page.tsx` leyendo `searchParams` dentro del `<Suspense>`. Las miniaturas todavía no abren nada; se mantiene `upload-form.tsx`. Diseño con `/frontend-design`. `media-toolbar.test.tsx` y `media-grid.test.tsx`. Prueba: `npm run test:run` pasa y a mano se busca y filtra con el seed.
5. **Modal de detalle.** `media-detail-dialog.tsx` con datos, uso con enlaces, editar, copiar, abrir, borrar y navegación. Se borra `media-card.tsx`. Diseño con `/frontend-design`. `media-detail-dialog.test.tsx`. Prueba: `npm run test:run` pasa y a mano se edita y borra una imagen.
6. **Modal de subida.** `upload-dialog.tsx` y `upload-button.tsx` en la cabecera, con cola, chequeo en el cliente y estados por fila. Se borra `upload-form.tsx`. Diseño con `/frontend-design`. `upload-dialog.test.tsx`. Prueba: `npm run test:run` pasa y a mano se suben 3 imágenes a la vez.
7. **E2E.** `e2e/medios.spec.ts` reescrito. Prueba: `npm run test:e2e` pasa completo.

## Criterios de aceptación

**General**

- [x] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [x] `npm run test:run` pasa con Docker apagado.
- [x] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa completo, con `media-picker.spec.ts` y `article-editor.spec.ts` sin cambios en sus casos.
- [x] `package.json` no suma dependencias.
- [x] `grep -rn "updateMediaAlt\|UploadForm\|MediaCard" app components actions db lib __tests__ e2e` no devuelve nada.

**Utilidades (`server`)**

- [x] `parseMediaParams({ q: "  equipo ", uso: "sin-usar" })` devuelve `{ q: "equipo", uso: "sin-usar" }`; `uso: "otro"` devuelve `uso: null`; una `q` de 101 caracteres se recorta a 100; `q: "   "` devuelve `q: null`.
- [x] `mediaQueryHref({ q: null, uso: null })` devuelve `/admin/media`; con los dos, `/admin/media?q=equipo&uso=sin-usar`.
- [x] `parseMediaForm` con `alt` vacío, `alt` de 301, `originalName` vacío, `originalName` de 201 o `id` que no es UUID devuelve el error en el campo correspondiente.
- [x] `checkUploadFile` con `image/gif` devuelve el mensaje de formato; con 10 MB + 1 byte, el de tamaño; con un PNG de 1 MB, `null`.
- [x] `UPLOAD_LIMITS.maxBytes` es igual a `MEDIA_LIMITS.maxBytes` y `UPLOAD_LIMITS.types` cubre los 4 formatos de `MEDIA_LIMITS.formats`.

**Consultas y actions (`db`)**

- [x] Con una imagen de portada, una en el cuerpo de un borrador y una sin usar, `listMedia({ usage: "used" })` devuelve las dos primeras y `listMedia({ usage: "unused" })` la tercera.
- [x] `listMedia({ query: "equipo", usage: "unused" })` aplica los dos filtros a la vez.
- [x] Con más de 24 imágenes sin usar, la segunda tanda con el `nextCursor` y `usage: "unused"` sigue filtrada y no repite.
- [x] `countMedia` con `query` y `usage` devuelve la misma cantidad que recorrer todas las tandas de `listMedia` con esos filtros.
- [x] `updateMedia` cambia `alt` y `original_name`; con un id inexistente devuelve `not-found` y no cambia nada.
- [x] `updateMediaAction` llama a `requireAdmin()` antes de tocar la base, devuelve "Cambios guardados." y llama a `updateTag("blog")`.
- [x] `updateMediaAction` que cambia el alt de la portada de `senales-sistema-a-medida` devuelve "Cambios guardados. El texto alternativo cambió en: {título del artículo}."; si solo cambia el nombre, devuelve "Cambios guardados.".
- [x] `updateMediaAction` con alt vacío devuelve `fieldErrors.alt` "El texto alternativo no puede estar vacío."; con un id inexistente, "Esa imagen ya no existe.".
- [x] `deleteMediaAction` con un id inexistente devuelve "Esa imagen ya no existe.".
- [x] `loadMoreMediaAction` con `query` y `usage` devuelve la tanda filtrada y `CardItem` con `originalName` y `usage[].postId`.
- [x] Cambiar el `alt` de Medios de la imagen del cuerpo de `senales-sistema-a-medida` (sin alt propio en el nodo) cambia el `alt` que devuelve `getPublishedPostBySlug`.

**Componentes (`client`)**

- [x] `MediaToolbar`: escribir en la búsqueda llama a `router.replace` una sola vez 300 ms después de la última tecla, con `?q=…`; elegir "Sin usar" lo hace con `?uso=sin-usar`; elegir "Todas" lo quita.
- [x] `MediaGrid` muestra "Todavía no hay imágenes.", "No hay imágenes que coincidan con «x».", "No hay imágenes en uso." y "No hay imágenes sin usar." en cada caso.
- [x] Cada miniatura es un botón con nombre "Ver detalles de {alt}" y muestra "En uso" o "Sin usar".
- [x] `MediaDetailDialog` muestra alt, nombre, medidas, peso, fecha y "En uso en" con enlaces a `/admin/articles/{postId}/edit` y "· portada" / "· cuerpo".
- [x] Con uso, "Borrar" está deshabilitado y se lee "Está en uso: quitala de esos artículos para borrarla.".
- [x] "Editar" sobre una imagen en uso muestra "Esta imagen está en uso en: {títulos}…"; sobre una sin usar no lo muestra.
- [x] "Editar" con alt vacío muestra el error, pone el foco en "Texto alternativo" y no llama a la action.
- [x] `→` pasa a la imagen siguiente y `←` a la anterior; con el foco en un input no navegan; en la primera, "Imagen anterior" está deshabilitado.
- [x] `Escape` cierra el detalle y el foco vuelve a la miniatura que lo abrió.
- [x] `UploadDialog`: agregar 12 archivos deja 10 filas y muestra "Podés subir hasta 10 imágenes a la vez.".
- [x] Un `.gif` entra como fila con "Formato no soportado…" y no cuenta en "Subir {N} imágenes".
- [x] "Subir {N} imágenes" está deshabilitado mientras falte un alt.
- [x] Con 3 archivos donde la action falla en el segundo, se suben el primero y el tercero, el segundo queda con su mensaje y "Reintentar", y el resumen dice "Se subieron 2. 1 con error.".
- [x] Mientras sube, `Escape` y "Cancelar" no cierran el modal.
- [x] Con 2 filas pendientes, "Cancelar", el botón de cierre y `Escape` no cierran: el pie muestra "Tenés 2 imágenes sin subir. ¿Descartarlas?" con "Descartar" y "Seguir editando", y el foco queda en "Seguir editando".
- [x] "Seguir editando" (o un segundo `Escape`) vuelve al pie normal con las 2 filas intactas; "Descartar" llama a `onClose` y libera las vistas previas.
- [x] Con la cola vacía, o después de "Listo" con todo subido, cerrar no muestra la confirmación.

**Medios (E2E, `medios.spec.ts`)**

- [x] "Subir imágenes" con 3 archivos y sus alts los sube, muestra "Se subieron 3." y, al tocar "Listo", aparecen primeros en la grilla; cada uno se sirve como `image/webp`.
- [x] Subir un archivo que ya estaba muestra "Esa imagen ya estaba subida." en su fila y no suma miniaturas.
- [x] Un `.txt` muestra el mensaje de formato no soportado en su fila y no se sube.
- [x] Elegir 2 archivos y tocar "Cancelar" pide confirmación; "Seguir editando" los conserva y "Descartar" cierra sin subir nada.
- [x] Editar el alt de la portada del seed muestra el aviso con el título del artículo y, al guardar, el toast lo nombra; `/blog/senales-sistema-a-medida` muestra el alt nuevo en el hero.
- [x] Buscar parte del alt de una imagen deja solo las que coinciden, la URL queda con `?q=` y recargar mantiene la búsqueda.
- [x] "Sin usar" oculta las imágenes del seed que usa `senales-sistema-a-medida` y "En uso" las muestra.
- [x] El detalle de la portada del seed lista "{título} · portada" y el enlace abre el editor de ese artículo.
- [x] Editar el alt y el nombre en el detalle muestra "Cambios guardados.", la miniatura cambia sin recargar y los datos persisten al recargar.
- [x] Una imagen sin usar se borra desde el detalle con confirmación y sale de la grilla; una en uso tiene "Borrar" deshabilitado.
- [x] "Copiar URL" deja `{origen}/media/{id}` en el portapapeles y "Copiar id" deja el id.
- [x] "Abrir original" apunta a `/media/{id}` con `target="_blank"`.
- [x] Con 30 imágenes, "Cargar más" deja 30 miniaturas y el botón desaparece; `→` desde la miniatura 24 llega a la 25.
- [x] Con 30 imágenes, borrar una de la segunda tanda la saca y conserva las demás.
- [x] Sin sesión, `/admin/media` redirige a `/cuenta/login`; la barra lateral lleva a Medios.
- [x] A 390 px la grilla tiene 2 columnas, los dos modales ocupan la pantalla y no hay scroll horizontal.
- [x] La grilla, la barra y los dos modales cumplen 4.5:1 de contraste y todos sus controles miden 44 px o más (revisado con `/frontend-design`).

## Decisiones

- **Sí:** grilla de miniaturas con un modal de detalle que concentra las acciones. Elegido por el usuario.
- **No:** alternar entre grilla y lista. Dos vistas que mantener para una biblioteca chica.
- **Sí:** subir desde un modal con hasta 10 archivos, alt obligatorio por archivo y una cola que sube de a uno. Elegido por el usuario.
- **No:** un alt común para el lote. Deja alts genéricos que nadie corrige.
- **No:** un request con todos los archivos. Superaría el `bodySizeLimit` de 11 MB y un archivo malo frenaría a todos.
- **Sí:** la cola reusa `uploadMediaAction` sin cambiarla. Ya devuelve los mensajes de duplicado y de `MediaError`.
- **Sí:** editar el alt y el nombre del archivo. Elegido por el usuario.
- **No:** reemplazar el archivo. Rompe el `immutable` de `/media/<id>` y obligaría a versionar la URL.
- **Sí:** búsqueda por alt y nombre más filtro "Todas / En uso / Sin usar", con estado en la URL. Elegido por el usuario. La búsqueda reusa la de `listMedia` (SPEC 20).
- **Sí:** "En uso" cuenta borradores igual que publicados. Es la misma regla que impide borrar.
- **Sí:** cursor con "Cargar más", 24 por tanda. Elegido por el usuario. Es lo que ya usan la página y el selector.
- **No:** páginas numeradas. Pide offset y otro modelo de consulta solo para esta página.
- **Sí:** cada miniatura muestra el alt en una línea y una insignia de uso. Elegido por el usuario. Medidas, peso y fecha van al detalle.
- **Sí:** el detalle tiene "Copiar URL", "Copiar id", "Abrir original" y enlaces a los artículos donde se usa. Elegido por el usuario.
- **Sí:** anterior y siguiente con botones y flechas entre las imágenes cargadas, sin cambiar la URL. Elegido por el usuario.
- **No:** abrir el detalle por URL. Suma estado en `searchParams` y casos con Cache Components por poco uso.
- **No:** que "Imagen siguiente" cargue la tanda siguiente. Mezcla la navegación con la paginación; se usa "Cargar más".
- **No:** selección múltiple y borrado en lote. Elegido por el usuario. Queda para otro spec.
- **Sí:** el selector del editor no cambia. Elegido por el usuario.
- **Sí:** `updateMediaAction` invalida `blog`. El alt de Medios sale en el blog cuando el nodo no tiene uno propio, y hoy editarlo no invalida la caché.
- **Sí:** la miniatura usa `alt=""` y el botón lleva el nombre "Ver detalles de {alt}". Evita que el lector de pantalla lea el alt dos veces.
- **Sí:** cerrar el modal de subida con filas sin subir pide confirmación. Elegido por el usuario. Los alts escritos se perderían.
- **Sí:** la confirmación cambia el pie del modal a "Descartar" / "Seguir editando". Lo dejó a elección el usuario (modal o en los mismos botones).
- **No:** un `ConfirmDialog` encima del modal de subida. Apila otro `<dialog>`, que ya es un riesgo en el detalle, por una pregunta de dos botones.
- **Sí:** editar el alt de una imagen en uso avisa en qué artículos antes de guardar, y el mensaje de éxito los nombra. Pedido por el usuario. Cambiar el alt de Medios cambia el blog sin abrir el artículo.
- **No:** bloquear la edición o pedir un segundo paso de confirmación. El aviso alcanza y el cambio se revierte editando de nuevo.
- **Sí:** chequeo de tipo y tamaño en el cliente con `UPLOAD_LIMITS`, espejo de `MEDIA_LIMITS`. `process.ts` importa `sharp` y no puede ir al cliente.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| El filtro "En uso" con `jsonb_array_elements` sobre todos los posts es lento.               | Usa `EXISTS` y la biblioteca y los posts son pocos. Un índice o una tabla de uso irían en otro spec si hiciera falta.                        |
| `ConfirmDialog` se abre encima del `<dialog>` de detalle y el foco o `Escape` se confunden. | Los dos usan `showModal`, que apila en la capa superior. `Escape` cierra solo el de arriba y el foco vuelve a "Borrar"; test `client`.       |
| Las flechas `←` / `→` navegan mientras se escribe en el formulario de edición.              | No navegan con el foco en un input ni en modo edición; test `client`.                                                                        |
| `UPLOAD_LIMITS` y `MEDIA_LIMITS` se desalinean.                                             | Un test `server` compara `UPLOAD_LIMITS.maxBytes` con `MEDIA_LIMITS.maxBytes`. El servidor valida igual, así que lo peor es un error tardío. |
| Las vistas previas de la cola dejan memoria tomada.                                         | Cada `createObjectURL` se libera con `revokeObjectURL` al quitar la fila o cerrar el modal.                                                  |
| Leer `searchParams` o la base fuera de `<Suspense>` rompe el build con Cache Components.    | Toda lectura va dentro del `<Suspense>` de la página; el build sin `DATABASE_URL` lo prueba.                                                 |
| Reescribir `medios.spec.ts` pierde escenarios que hoy se prueban.                           | Los criterios E2E cubren los mismos escenarios de hoy (subir, duplicado, `.txt`, editar, borrar, en uso, copiar, 30 imágenes, barra).        |

## Qué **no** incluye este spec

- Selección múltiple y borrado en lote.
- Reemplazar, recortar o rotar imágenes.
- Vista de lista, otros órdenes y filtros por fecha, tamaño o formato.
- Detalle abierto por URL.
- Cambios en el selector del editor.
- Carpetas o álbumes.

Cada uno de estos, si llega, va en su propio spec.
