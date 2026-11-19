# SPEC 20 — Selector de Medios

> **Estado:** Aprobado
> **Depende de:** SPEC 10, SPEC 12, SPEC 16, SPEC 18, SPEC 19
> **Fecha:** 2026-11-18
> **Objetivo:** Que el admin elija, cambie o quite la portada e inserte imágenes en el cuerpo desde el editor de artículos con un modal de Medios que busca, pagina y sube, y que edite el texto alternativo y el pie de cada imagen del cuerpo.

## Por qué existe este spec

SPEC 19 dejó la portada de solo lectura y las imágenes del cuerpo como miniaturas que se mueven o se borran, pero no se insertan ni se editan. El selector de Medios quedó afuera a propósito para que el editor de texto se verificara solo. Este spec lo suma sobre la biblioteca de SPEC 10 (`media`, `/media/<id>`, `createMedia`) y la paginación por cursor de SPEC 12, sin tablas nuevas.

Tres decisiones marcan el diseño:

- **Un solo modal para todo.** El mismo componente elige la portada y la imagen del cuerpo; solo cambian el título y el botón principal.
- **La portada se guarda con el formulario.** Elegirla o quitarla es un cambio sin guardar más, igual que el título. Respeta el guardado manual, el aviso de salida y el conflicto por `updatedAt` de SPEC 19.
- **El servidor no confía en los `mediaId`.** Antes de escribir, comprueba que la portada y cada imagen del cuerpo existan en `media`. Así una imagen borrada en otra pestaña no termina rompiendo `/blog/{slug}`.

**Referencias:**

- Canvas [CMS Courroux Digital](https://claude.ai/artifact/QnCCtdB9JaPEQ7nf84dVgA), artboard "Editor de artículo" (`project/Editor.dc.html`): bloque "Imagen de portada" del panel lateral.
- `db/media.ts` (`listMedia`, `createMedia`, `MediaItem`), `actions/admin/media/index.ts` (`uploadMediaAction`, `loadMoreMediaAction`), `app/(admin)/admin/media/upload-form.tsx`, `lib/pagination.ts`, `lib/media/process.ts` (`MEDIA_LIMITS`).
- `components/admin/article-editor/` (`article-editor.tsx`, `body-editor.tsx`, `editor-toolbar.tsx`, `extensions.ts`, `image-node-view.tsx`, `link-popover.tsx`), `components/admin/confirm-dialog.tsx` (`<dialog>` nativo), `lib/admin/article-form.ts`, `db/admin-posts.ts` (`createPost`, `updatePost`, `getPostForEdit`), `db/blog-body.ts` (`blogBodySchema`).
- Documentación de Tiptap v3: `NodeViewProps` (`updateAttributes`, `deleteNode`, `selected`), `insertContentAt`, `NodeSelection`, `editorProps.handleDrop` / `handlePaste`.

## Alcance

**Incluye:**

- **Selector (`components/admin/media-picker/media-picker.tsx`, cliente):**
  - Modal sobre `<dialog>` nativo, como `ConfirmDialog`: foco atrapado, fondo inerte, `Escape` cierra y el foco vuelve al botón que lo abrió.
  - Dos modos:

    | Modo    | Título del modal  | Botón principal     |
    | ------- | ----------------- | ------------------- |
    | `cover` | "Elegir portada"  | "Usar como portada" |
    | `body`  | "Insertar imagen" | "Insertar"          |

  - Dos pestañas (`role="tablist"`): "Biblioteca" (abierta por defecto) y "Subir imagen".
  - Botón "Cancelar" y botón de cierre con `aria-label="Cerrar"`. Cerrar no cambia nada en el editor.

- **Pestaña "Biblioteca":**
  - Input "Buscar por texto alternativo o nombre de archivo" (`type="search"`), con 300 ms de espera después de la última tecla. Máx. 100 caracteres.
  - Grilla de miniaturas de la más nueva a la más vieja, 24 por página, con "Cargar más" mientras haya `nextCursor`. Cambiar la búsqueda reinicia la grilla.
  - Cada miniatura es un botón con `aria-pressed` y `aria-label` igual al `alt` de Medios. Debajo muestra el `alt` recortado a una línea y las medidas (`1920 × 1080`).
  - Selección única. Tocar una miniatura la selecciona y habilita el botón principal. Doble clic o `Enter` sobre la seleccionada confirma.
  - En modo `cover`, la portada actual aparece marcada al abrir.
  - Estados:

    | Estado                 | Texto                                                                            |
    | ---------------------- | -------------------------------------------------------------------------------- |
    | Cargando (primera vez) | Esqueleto de 8 miniaturas                                                        |
    | Biblioteca vacía       | "Todavía no hay imágenes. Subí la primera." + enlace a la pestaña "Subir imagen" |
    | Sin resultados         | "No hay imágenes que coincidan con «{búsqueda}»."                                |
    | Error                  | "No pudimos cargar las imágenes." + botón "Reintentar"                           |

- **Pestaña "Subir imagen":**
  - Mismos campos y límites que `upload-form.tsx` de Medios: archivo (`accept` con los 4 tipos de `MEDIA_LIMITS`) y "Texto alternativo" obligatorio (máx. 300).
  - Al subir, el botón muestra spinner y "Subiendo…".
  - Si sube (o el archivo ya estaba), vuelve a "Biblioteca" con la búsqueda vacía, la imagen primera en la grilla y seleccionada, y el mensaje "Imagen subida." o "Esa imagen ya estaba subida." en una región `aria-live`.
  - Un `MediaError` o un fallo se muestra debajo del formulario con el mismo texto que en Medios.
- **Actions nuevas (`actions/admin/media/index.ts`):**
  - `searchMediaAction({ query, cursor })`: llama a `requireAdmin()`, valida con Zod y devuelve una página de `PickerItem`. Errores (incluido `InvalidCursorError`) → `{ status: "error", message: "No pudimos cargar las imágenes." }`.
  - `uploadPickerMediaAction(prev, data)`: igual que `uploadMediaAction` (mismo esquema, mismos mensajes y `revalidatePath("/admin/media")`), pero en éxito devuelve también el `PickerItem` subido o el existente.
  - `uploadMediaAction` y `loadMoreMediaAction` no cambian.
- **Búsqueda (`db/media.ts`):** `listMedia` suma `query?: string` opcional.
  - Con `query` (después de `trim`, no vacía) filtra con `ILIKE` sobre `alt` y `original_name`, sin distinguir mayúsculas.
  - `%`, `_` y `\` se escapan: buscar `50%` encuentra `50%` y no todo.
  - El cursor y el orden no cambian. `/admin/media` sigue llamando sin `query`.
- **Portada en el panel lateral (`article-editor.tsx`):**
  - Con portada: miniatura 16:9, su `alt` debajo y dos botones "Cambiar portada" (abre el selector en modo `cover`) y "Quitar portada".
  - Sin portada: recuadro "Sin portada" y botón "Elegir portada".
  - Elegir, cambiar o quitar la portada actualiza el formulario y lo marca con cambios sin guardar. No escribe en la base hasta "Guardar borrador", "Publicar" o "Guardar cambios".
  - La portada sigue siendo opcional para borradores y para publicar.
- **Insertar en el cuerpo (`editor-toolbar.tsx`, `body-editor.tsx`):**
  - La barra suma un grupo al final con el botón "Imagen" (`aria-label="Insertar imagen"`), que abre el selector en modo `body`.
  - Al confirmar, inserta `{ type: "image", attrs: { mediaId, alt: null, caption: null } }` después del bloque raíz donde está el cursor (si el cursor está dentro de una lista o una cita, después de esa lista o cita). Si ese bloque es un párrafo vacío, la imagen lo reemplaza.
  - La imagen nueva queda seleccionada y el foco vuelve al editor.
  - La miniatura aparece sin recargar: el mapa `images` del editor (`mediaId → { src, alt }`) pasa a ser estado que el selector amplía con cada imagen elegida.
  - Pegar o soltar archivos sobre el cuerpo se ignora (`handlePaste` / `handleDrop` devuelven `true` cuando traen archivos). Pegar HTML con `<img>` sigue descartándose como en SPEC 19.
- **Barra de la imagen del cuerpo (`image-node-view.tsx`):**
  - Cuando el nodo `image` está seleccionado, se ve una barra sobre la miniatura (`role="toolbar"`, `aria-label="Opciones de la imagen"`) con cuatro botones: "Texto alternativo", "Pie de foto", "Cambiar imagen" y "Quitar imagen".
  - "Texto alternativo" abre un popover (`image-text-popover.tsx`, mismo comportamiento que `link-popover.tsx`) con un input, "Aplicar" y "Usar el de Medios". La ayuda dice "Si lo dejás vacío se usa el de Medios: «{alt de Medios}»."
  - "Pie de foto" abre el mismo popover con "Aplicar" y "Quitar pie".
  - En los dos: el texto se guarda con `trim`, máx. 300 caracteres. Vacío o "Usar el de Medios" / "Quitar pie" guardan `null`. `Escape` cierra y devuelve el foco a la imagen.
  - "Cambiar imagen" abre el selector en modo `body`. Al confirmar, cambia `mediaId`, pone `alt` en `null` y conserva `caption`.
  - "Quitar imagen" borra el nodo, sin modal (se recupera con Deshacer).
  - La miniatura muestra el `alt` propio si lo tiene y si no el de Medios. Si hay `caption`, la muestra debajo como hoy.
- **Formulario y guardado:**
  - `ArticleInput` suma `coverMediaId: string | null`. `FormData` suma el campo `coverMediaId` (vacío = sin portada).
  - `parseArticleForm` acepta vacío o UUID. Otra cosa → `fieldErrors.coverMediaId` "Elegí la portada de nuevo.".
  - `blogBodySchema`: `alt` y `caption` del nodo `image` pasan a ser `null` o un texto con algo después de `trim` y de 300 caracteres o menos.
  - `createPost` y `updatePost` escriben `cover_media_id`. Dentro de la transacción, antes de escribir, buscan en `media` la portada y todos los `mediaId` del cuerpo. Si falta alguno, devuelven `reason: "missing-media"` y no cambian nada.
  - `saveArticleAction` con `missing-media` responde el toast "Una de las imágenes ya no está en Medios. Elegí otra." y no guarda.
  - Si guardó, además de lo de SPEC 19, llama a `revalidatePath("/admin/media")` para que "En uso en" se actualice.
  - `getPostForEdit` devuelve `cover` con `id`, para que el formulario sepa qué portada tiene.
- **Diseño:** modal, pestañas, grilla, estados, panel de portada, botón de la barra, barra de la imagen y popover se hacen con `/frontend-design`, siguiendo el artboard y los tokens `cms-*`. Todos los controles miden 44 px o más y cumplen 4.5:1 de contraste. El modal ocupa la pantalla entera por debajo de `sm` y mide 960 px de ancho máximo en escritorio. A 390 px no hay scroll horizontal; la grilla pasa a 2 columnas.
- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `blog-body.test.ts` y `article-form.test.ts` suman casos.
  - Vitest `db`: `media.test.ts`, `admin-posts.test.ts` y `admin-articles-actions.test.ts` suman casos; `__tests__/db/media-picker-actions.test.ts`, nuevo.
  - Vitest `client`: `__tests__/client/media-picker.test.tsx` y `__tests__/client/image-node-view.test.tsx`, nuevos; `article-editor.test.tsx` suma casos.
  - Playwright: `e2e/media-picker.spec.ts`, nuevo, con `e2e/fixtures/imagen.png`.

**Fuera de alcance (para specs futuros):**

- Búsqueda en la página `/admin/media`.
- Arrastrar o pegar archivos en el cuerpo para subirlos.
- Comando `/` para insertar bloques.
- Selección múltiple, galerías o varias imágenes por bloque.
- Recortar, rotar o elegir el foco de la portada.
- Editar el `alt` de Medios desde el editor (solo se pisa por imagen).
- Imágenes dentro de listas o citas.
- Borrar una imagen de Medios desde el selector.
- Filtros por fecha, tamaño o "sin usar" en el selector.
- Portada obligatoria para publicar.

## Modelo de datos

No hay tablas, columnas ni migraciones nuevas. `post.cover_media_id` (SPEC 10) pasa a escribirse desde el editor. El formato del cuerpo es el de SPEC 18, con `alt` y `caption` más estrictos.

```ts
// db/media.ts (cambia)
export type MediaQuery = PageParams & { query?: string };
export async function listMedia(params?: MediaQuery): Promise<Page<MediaItem>>;

// actions/admin/media/index.ts (suma)
export type PickerItem = {
  id: string;
  src: string; // "/media/<id>"
  alt: string; // el de Medios
  width: number;
  height: number;
};
export type PickerPage =
  | { status: "success"; items: PickerItem[]; nextCursor: string | null }
  | { status: "error"; message: string };
export async function searchMediaAction(input: {
  query: string; // "" = sin filtro, máx. 100
  cursor: string | null;
}): Promise<PickerPage>;

export type PickerUploadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string; item: PickerItem };
export async function uploadPickerMediaAction(
  prev: PickerUploadState,
  data: FormData, // file, alt
): Promise<PickerUploadState>;

// components/admin/media-picker/media-picker.tsx (cliente)
export type MediaPickerMode = "cover" | "body";
export function MediaPicker(props: {
  open: boolean;
  mode: MediaPickerMode;
  selectedId?: string | null; // portada actual en modo cover
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}): JSX.Element;

// lib/admin/article-form.ts (cambia)
export const ARTICLE_LIMITS = { /* … SPEC 19 */ imageText: 300 } as const;
export type ArticleInput = {
  /* … SPEC 19 */
  coverMediaId: string | null; // uuid
};

// db/blog-body.ts (cambia el nodo image de blogBodySchema)
// attrs: { mediaId: uuid, alt: string | null, caption: string | null }
// alt y caption: null o texto con trim no vacío y ≤ 300.

// db/admin-posts.ts (cambia)
export type EditablePost = {
  /* … SPEC 19 */
  cover: { id: string; src: string; alt: string } | null;
};
export type SavePostResult =
  | {
      ok: true;
      id: string;
      slug: string;
      previousSlug: string | null;
      updatedAt: Date;
    }
  | {
      ok: false;
      reason: "slug-taken" | "stale" | "not-found" | "missing-media";
    };
// createPost y updatePost escriben cover_media_id y comprueban que existan
// la portada y cada mediaId del cuerpo antes de escribir.
```

Archivos nuevos:

- `components/admin/media-picker/`: `media-picker.tsx` (modal y pestañas), `media-library.tsx` (búsqueda, grilla, estados, "Cargar más") y `media-upload.tsx` (formulario de subida).
- `components/admin/article-editor/image-text-popover.tsx` y `cover-field.tsx` (bloque "Imagen de portada" del panel lateral).

Archivos que cambian: `db/media.ts`, `db/blog-body.ts`, `db/admin-posts.ts`, `actions/admin/media/index.ts`, `actions/admin/articles/index.ts`, `lib/admin/article-form.ts`, `components/admin/article-editor/article-editor.tsx`, `body-editor.tsx`, `editor-toolbar.tsx`, `extensions.ts` e `image-node-view.tsx`.

Convenciones:

- El selector solo habla con el servidor por `searchMediaAction` y `uploadPickerMediaAction`. No importa nada de `db/`.
- `PickerItem` es lo único que viaja al cliente: sin `usage`, `bytes` ni `originalName`.
- Una imagen del cuerpo con `alt: null` usa el `alt` de Medios al leer (SPEC 18). El editor nunca copia el `alt` de Medios al nodo.
- El servidor sigue siendo la fuente de verdad: valida el cuerpo, la portada y la existencia de cada `mediaId`.

## Plan de implementación

1. **Búsqueda en `listMedia`.** Sumar `query` con `ILIKE` escapado y casos en `media.test.ts`. Prueba: `npm run test:db` pasa y `/admin/media` se ve igual.
2. **Actions del selector.** `PickerItem`, `searchMediaAction` y `uploadPickerMediaAction`, con `media-picker-actions.test.ts`. Prueba: `npm run test:db` pasa.
3. **Formato y formulario.** `alt`/`caption` estrictos en `blogBodySchema`, `coverMediaId` en `ArticleInput` y `parseArticleForm`, con casos en `blog-body.test.ts` y `article-form.test.ts`. El editor manda la portada que ya tenía. Prueba: `npm run test:run` pasa.
4. **Guardado de portada y chequeo de medios.** `createPost`/`updatePost` escriben `cover_media_id` y devuelven `missing-media`; `getPostForEdit` devuelve `cover.id`; `saveArticleAction` responde el toast y revalida `/admin/media`. Casos en `admin-posts.test.ts` y `admin-articles-actions.test.ts`. Prueba: `npm run test:db` pasa.
5. **Modal del selector.** `media-picker.tsx`, `media-library.tsx` y `media-upload.tsx`, diseñados con `/frontend-design`, con `media-picker.test.tsx`. Todavía no se usa desde el editor. Prueba: `npm run test:run` pasa.
6. **Portada en el panel.** `cover-field.tsx` con elegir, cambiar y quitar, conectado al formulario y a cambios sin guardar. Casos en `article-editor.test.tsx`. Prueba: `npm run test:run` pasa y a mano se cambia la portada de un artículo y se ve en `/blog`.
7. **Insertar en el cuerpo.** Botón "Imagen" en la barra, inserción después del bloque raíz, mapa `images` como estado y paste/drop de archivos ignorado. Prueba: `npm run test:run` pasa y a mano una imagen insertada aparece en `/blog/{slug}` después de guardar.
8. **Barra de la imagen.** Barra en `image-node-view.tsx` e `image-text-popover.tsx` con alt, pie, cambiar y quitar, con `image-node-view.test.tsx`. Prueba: `npm run test:run` pasa.
9. **E2E.** `e2e/media-picker.spec.ts`. Prueba: `npm run test:e2e` pasa completo.

## Criterios de aceptación

**General**

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa completo, con `blog.spec.ts`, `medios.spec.ts` y `article-editor.spec.ts` sin cambios en sus casos.
- [ ] `package.json` no suma dependencias.
- [ ] `grep -rn "@/db" components/admin/media-picker` no devuelve nada.

**Formato y formulario (`server`)**

- [ ] `blogBodySchema` acepta una `image` con `alt` y `caption` en `null` o con texto, y rechaza `alt: ""`, `alt: "   "`, `caption: ""` y un `alt` de 301 caracteres.
- [ ] `parseArticleForm` con `coverMediaId` vacío devuelve `coverMediaId: null`; con un UUID lo devuelve; con `no-uuid` devuelve `fieldErrors.coverMediaId`.
- [ ] Publicar sin portada sigue siendo válido.

**Consultas y actions (`db`)**

- [ ] `listMedia({ query: "equipo" })` devuelve solo las imágenes con "equipo" en `alt` u `original_name`, sin distinguir mayúsculas.
- [ ] `listMedia({ query: "50%" })` no devuelve imágenes sin `50%`; `listMedia({ query: "a_b" })` no devuelve `axb`.
- [ ] `listMedia({ query: "   " })` devuelve lo mismo que `listMedia()`.
- [ ] Con más de 24 resultados de una búsqueda, la segunda página con el `nextCursor` sigue filtrada y no repite imágenes.
- [ ] `searchMediaAction` y `uploadPickerMediaAction` llaman a `requireAdmin()` antes de tocar la base o el disco.
- [ ] `searchMediaAction` con un cursor inválido devuelve `status: "error"` con "No pudimos cargar las imágenes.".
- [ ] `uploadPickerMediaAction` con un PNG válido devuelve `status: "success"`, "Imagen subida." y un `item` con `src` `/media/<id>`; con el mismo archivo otra vez, "Esa imagen ya estaba subida." y el mismo `item.id`.
- [ ] `uploadPickerMediaAction` con un `.txt` devuelve el mensaje de `MediaError` y no crea filas ni archivos.
- [ ] `createPost` con `coverMediaId` guarda `cover_media_id`; `updatePost` con `null` lo deja vacío y con otro id lo cambia.
- [ ] `createPost` y `updatePost` con una portada o un `mediaId` del cuerpo que no existe en `media` devuelven `reason: "missing-media"` y no cambian el post, sus etiquetas ni crean etiquetas.
- [ ] `getPostForEdit` devuelve `cover.id` igual a `cover_media_id`.
- [ ] `saveArticleAction` con `missing-media` devuelve "Una de las imágenes ya no está en Medios. Elegí otra." y, al guardar bien, llama a `revalidatePath("/admin/media")`.
- [ ] Después de guardar una portada, `getMediaUsage` de esa imagen incluye el post con `as: "portada"`.

**Componentes (`client`)**

- [ ] `MediaPicker` en modo `cover` muestra "Elegir portada" y "Usar como portada"; en modo `body`, "Insertar imagen" e "Insertar".
- [ ] El botón principal está deshabilitado hasta seleccionar una miniatura; la miniatura seleccionada tiene `aria-pressed="true"`.
- [ ] En modo `cover` con `selectedId`, esa miniatura aparece seleccionada al abrir.
- [ ] Escribir en la búsqueda llama a `searchMediaAction` una sola vez 300 ms después de la última tecla, con `cursor: null`.
- [ ] Con `nextCursor`, "Cargar más" agrega miniaturas sin quitar las anteriores; sin `nextCursor` no aparece.
- [ ] Se ven "Todavía no hay imágenes. Subí la primera.", "No hay imágenes que coincidan con «x»." y "No pudimos cargar las imágenes." con "Reintentar" en cada caso.
- [ ] Subir con éxito vuelve a "Biblioteca" con la imagen primera y seleccionada, y anuncia "Imagen subida.".
- [ ] `Escape` y "Cancelar" llaman a `onClose` sin llamar a `onSelect`.
- [ ] `ArticleEditor` sin portada muestra "Sin portada" y "Elegir portada"; elegir una muestra su miniatura, "Cambiar portada" y "Quitar portada", y "← Artículos" pasa a abrir "¿Salir sin guardar?".
- [ ] La barra del cuerpo tiene "Insertar imagen" después de "En resumen".
- [ ] `ImageNodeView` seleccionado muestra "Texto alternativo", "Pie de foto", "Cambiar imagen" y "Quitar imagen"; sin seleccionar no los muestra.
- [ ] Aplicar un texto alternativo vacío o tocar "Usar el de Medios" deja `alt: null`; aplicar "Gráfico de ventas " deja `alt: "Gráfico de ventas"`.
- [ ] "Cambiar imagen" deja `alt: null` y conserva `caption`.

**Editor (E2E, `media-picker.spec.ts`)**

- [ ] En un artículo nuevo, "Elegir portada" → "Subir imagen" con `e2e/fixtures/imagen.png` y un alt → "Usar como portada" muestra la miniatura en el panel; al publicar, `/blog` muestra esa portada en la tarjeta y `/blog/{slug}` en el hero.
- [ ] "Insertar imagen" con el cursor en el segundo párrafo, elegir una imagen y "Insertar" la deja después de ese párrafo; con pie "Diagrama del flujo" y guardar, `/blog/{slug}` muestra un `<figure>` en ese lugar con `<figcaption>` "Diagrama del flujo".
- [ ] Un alt propio en la imagen del cuerpo aparece como `alt` del `<img>` en `/blog/{slug}`; con "Usar el de Medios", aparece el de Medios.
- [ ] Insertar con el cursor dentro de una lista deja la imagen después de la lista, no adentro.
- [ ] La búsqueda del selector con parte del alt de una imagen la muestra y oculta las que no coinciden.
- [ ] "Quitar portada" y "Guardar cambios" deja la tarjeta de `/blog` con el dibujo de la categoría.
- [ ] Después de guardar, `/admin/media` muestra "En uso en: {título}" en la portada y en la imagen del cuerpo.
- [ ] Si la imagen elegida como portada se borra (en el test, directo en la base) antes de guardar, el editor muestra "Una de las imágenes ya no está en Medios. Elegí otra." y `/blog/{slug}` sigue igual.
- [ ] Soltar un archivo sobre el cuerpo no inserta nada.
- [ ] Guardar `senales-sistema-a-medida` sin tocar nada deja `/blog/senales-sistema-a-medida` igual (portada e imagen del cuerpo).
- [ ] A 390 px el selector ocupa la pantalla, la grilla tiene 2 columnas y no hay scroll horizontal.
- [ ] El modal, la barra de la imagen y el popover cumplen 4.5:1 de contraste y todos sus controles miden 44 px o más (revisado con `/frontend-design`).

## Decisiones

- **Sí:** un modal con grilla, el mismo para portada y cuerpo. Elegido por el usuario.
- **No:** drawer lateral o popover chico. El drawer termina siendo modal en móvil y el popover no tiene lugar para una biblioteca grande.
- **Sí:** subir desde el modal, con `alt` obligatorio, dejando la imagen seleccionada. Elegido por el usuario.
- **No:** solo elegir imágenes ya subidas. Obliga a salir del editor con cambios sin guardar.
- **Sí:** búsqueda por `alt` y nombre de archivo en el selector. Elegido por el usuario.
- **No:** búsqueda también en `/admin/media`. Toca otra pantalla; puede ir en otro spec. Elegido por el usuario.
- **Sí:** la portada se guarda con el formulario. Elegido por el usuario.
- **No:** guardado inmediato de la portada. Rompe el guardado manual, el aviso de cambios y el conflicto por `updatedAt` de SPEC 19.
- **Sí:** portada opcional para publicar. Elegido por el usuario. Sin portada, el blog ya muestra el dibujo de la categoría.
- **Sí:** barra sobre la imagen seleccionada para alt, pie, cambiar y quitar. Elegido por el usuario.
- **No:** inputs fijos debajo de cada imagen. Ensucian el cuerpo y complican el NodeView.
- **Sí:** la barra vive dentro de `ImageNodeView`, sin `BubbleMenu` de Tiptap. No suma `@tiptap/extension-bubble-menu` ni Floating UI.
- **Sí:** botón "Imagen" en la barra, que inserta después del bloque raíz actual. Elegido por el usuario. Las imágenes solo van en la raíz (SPEC 18).
- **No:** comando `/`. Suma un menú de comandos que no existe.
- **Sí:** el servidor comprueba que existan la portada y cada imagen del cuerpo. Elegido por el usuario. Una imagen borrada en otra pestaña rompería `/blog/{slug}`, que lanza error con un `mediaId` inexistente.
- **No:** confiar solo en la FK de la portada. El cuerpo no tiene FK.
- **No:** pegar o soltar archivos en el cuerpo. Elegido por el usuario. Saltearía el `alt` obligatorio.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.
- **Sí:** actions nuevas para el selector en lugar de cambiar `uploadMediaAction` y `loadMoreMediaAction`. Estas devuelven `FormState` y `CardItem`, que usa la página de Medios; el selector necesita el `PickerItem` subido y la búsqueda.
- **Sí:** el nodo guarda `alt: null` y no copia el `alt` de Medios. Si el alt de Medios mejora, el artículo lo hereda.
- **Sí:** "Cambiar imagen" pone `alt` en `null` y conserva `caption`. El alt describe la imagen vieja; el pie suele hablar del contexto.
- **Sí:** `alt` y `caption` del cuerpo, si tienen texto, con `trim` no vacío y máx. 300, como el `alt` de Medios. Evita `alt=""` guardado por error, que ocultaría la imagen a lectores de pantalla.
- **Sí:** "Quitar imagen" sin modal. Deshacer la recupera y no cambia nada hasta guardar.
- **Sí:** `saveArticleAction` revalida `/admin/media`. Cambiar portada o cuerpo cambia "En uso en".

## Riesgos

| Riesgo                                                                                               | Mitigación                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Se borra una imagen de Medios entre elegirla y guardar, y el blog lanza error al resolver el cuerpo. | `createPost`/`updatePost` comprueban todos los `mediaId` en la misma transacción y devuelven `missing-media`; test `db` y E2E.     |
| Un `alt` o `caption` vacío de posts ya guardados deja de pasar el esquema estricto.                  | El editor siempre guardó `null`; el paso 3 corre `test:db` con el seed y un `select` de `body` con `alt = ''` confirma que no hay. |
| La búsqueda con `ILIKE` y comodines del usuario devuelve todo o es lenta.                            | `%`, `_` y `\` se escapan; la biblioteca es chica y el orden usa el índice de `created_at`. Un índice trigram va en otro spec.     |
| La miniatura de una imagen recién insertada no aparece porque el mapa `images` es fijo.              | El mapa pasa a estado del editor que el selector amplía; test `client` y E2E.                                                      |
| La barra de la imagen roba el foco o rompe la selección de Tiptap al hacer clic.                     | Los botones previenen el `mousedown` por defecto y los popovers devuelven el foco a la imagen; test `client`.                      |
| El `<dialog>` del selector se abre encima de `ConfirmDialog` o del popover de enlace.                | El selector cierra el popover abierto antes de abrirse y solo se abre desde la barra o el panel, nunca desde otro modal.           |
| Subir un archivo grande desde el modal se corta por el límite de body.                               | Usa el mismo `bodySizeLimit` de 11 MB y los límites de `MEDIA_LIMITS` de SPEC 10.                                                  |

## Qué **no** incluye este spec

- Búsqueda y filtros en `/admin/media`.
- Arrastrar o pegar archivos en el cuerpo y comando `/`.
- Galerías, selección múltiple e imágenes dentro de listas o citas.
- Recorte, rotación o foco de la portada.
- Editar el `alt` de Medios o borrar imágenes desde el selector.
- Portada obligatoria.

Cada uno de estos, si llega, va en su propio spec.
