# SPEC 19 — Editor de artículos

> **Estado:** Aprobado
> **Depende de:** SPEC 09, SPEC 11, SPEC 16, SPEC 17, SPEC 18
> **Fecha:** 2026-11-18
> **Objetivo:** Que el admin cree artículos en `/admin/articles/new` y los edite en `/admin/articles/{id}/edit` con un editor Tiptap (título, resumen, cuerpo, categoría, CTA, slug y etiquetas), guardándolos como borrador, publicándolos o eliminándolos, con el tiempo de lectura calculado del texto.

## Por qué existe este spec

SPEC 17 dejó la tabla de artículos sin "Nuevo artículo" ni "Editar", y SPEC 18 cambió `post.body` al JSON de Tiptap sin instalar Tiptap. Este spec suma el editor: instala Tiptap v3, lo configura para que produzca exactamente el formato de SPEC 18 y arma el formulario del artboard "Editor de artículo" del canvas [CMS Courroux Digital](https://claude.ai/artifact/QnCCtdB9JaPEQ7nf84dVgA) (`project/Editor.dc.html`).

El canvas también muestra cosas que no entran acá: el selector de Medios para la portada y para imágenes del cuerpo (SPEC 20), "Vista previa", "Programado", "Destacado", fecha de publicación y la sección "Cómo aparece en buscadores".

**Referencias:**

- Canvas, artboard "Editor de artículo": cabecera con estado y botones, campos "Título del artículo" y "Resumen que aparece debajo del título", barra H2/H3/B/I, panel lateral "Publicación" (categoría, tiempo de lectura calculado), "Imagen de portada" y "Eliminar artículo".
- `db/blog-body.ts` (`blogBodySchema`, `BlogDoc`, `docHeadings`), `db/admin-posts.ts`, `db/blog.ts` (`getCategories`), `db/schema/blog.ts` (`post`, `tag`, `post_tag`), `actions/admin/articles/index.ts`, `components/admin/confirm-dialog.tsx`, `components/admin/toast.tsx` (`notify`), `components/admin/page-header.tsx`, `lib/auth/dal.ts` (`requireAdmin`), `actions/cuenta/index.ts` (`FormState`).
- Documentación de Tiptap v3: `useEditor` con `immediatelyRender: false`, StarterKit (qué trae y cómo desactivar extensiones), Link (`openOnClick`, `isAllowedUri`), nodos propios con `Node.create`.
- `node_modules/next/dist/docs/01-app/` sobre rutas dinámicas (`params` como promesa), `notFound()`, Cache Components y `updateTag`.

## Alcance

**Incluye:**

- **Dependencias:** `@tiptap/react`, `@tiptap/pm` y `@tiptap/starter-kit` v3, con versión exacta (sin `^`). Solo se importan desde componentes cliente del panel; el blog público no las usa.
- **Rutas nuevas:**

  | Ruta                        | Carpeta                                 | Qué hace                                                    |
  | --------------------------- | --------------------------------------- | ----------------------------------------------------------- |
  | `/admin/articles/new`       | `app/(admin)/admin/articles/new/`       | Editor vacío; no crea fila hasta el primer guardado         |
  | `/admin/articles/{id}/edit` | `app/(admin)/admin/articles/[id]/edit/` | Editor con el post cargado; id inválido o inexistente → 404 |
  - Ambas páginas llaman a `requireAdmin()` y leen la base dentro de un `<Suspense>` con esqueleto del editor.
  - Al guardar por primera vez en `/new`, el cliente hace `router.replace("/admin/articles/{id}/edit")`.
  - "Artículos" de la barra lateral sigue activo en las dos rutas.

- **Entradas desde la tabla (SPEC 17):**
  - `AdminPageHeader` de `/admin/articles` suma el botón "Nuevo artículo" (enlace a `/admin/articles/new`).
  - El título de cada fila pasa a ser un `<Link>` a su editor.
  - "Más acciones" suma "Editar" como primera opción, visible siempre, sin modal.
- **Cabecera del editor:**
  - Enlace "← Artículos" a `/admin/articles`.
  - Título de la página: "Nuevo artículo" o el título guardado del post.
  - Badge de estado ("Borrador" / "Publicado") y "Actualizado {formatDate(updatedAt)}" (en `/new`, solo "Borrador · sin guardar").
  - Botones según el estado guardado:

    | Estado             | Botón secundario   | Botón principal   |
    | ------------------ | ------------------ | ----------------- |
    | Nuevo o `borrador` | "Guardar borrador" | "Publicar"        |
    | `publicado`        | "Pasar a borrador" | "Guardar cambios" |

  - "Publicar" y "Pasar a borrador" abren `ConfirmDialog` con los textos de SPEC 17 y, al confirmar, guardan el formulario completo con el estado nuevo. "Guardar borrador" y "Guardar cambios" guardan sin modal.
  - Mientras guarda, los botones quedan deshabilitados y el que se tocó muestra spinner y "Guardando…" / "Publicando…".
  - En móvil la cabecera queda fija arriba con los dos botones visibles; a 390 px no hay scroll horizontal.

- **Columna principal:**
  - "Título del artículo": input de una línea, obligatorio, máx. 120 caracteres.
  - "Resumen que aparece debajo del título" (`excerpt`): textarea, máx. 300, con contador "N de 300".
  - Cuerpo: editor Tiptap con la barra y el formato del modelo de datos, placeholder "Empezá a escribir…".
- **Barra del cuerpo (`editor-toolbar.tsx`):** botones de ícono con `aria-label` y `aria-pressed` cuando la marca o el nodo está activo, en este orden: Deshacer, Rehacer | H2, H3 | Negrita, Cursiva, Enlace | Lista con viñetas, Lista numerada | Cita, Consejo, En resumen.
  - `role="toolbar"` con `aria-label="Formato del texto"` y navegación con flechas.
  - Queda pegada arriba del área del cuerpo al hacer scroll. En móvil hace scroll horizontal propio, sin romper el ancho de la página.
  - Funcionan los atajos de Tiptap (Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+Z…) y los de markdown (`## `, `### `, `- `, `1. `, `> `).
  - Consejo y En resumen convierten el bloque actual en `tip` / `summary` (o lo vuelven párrafo si ya lo es).
- **Enlaces (`link-popover.tsx`):** el botón Enlace abre un popover anclado con input "URL", "Aplicar" y "Quitar enlace" (si la selección ya tiene enlace).
  - Acepta `http://`, `https://` y rutas que empiezan con `/` (no `//`), con la misma regla que `blogBodySchema`. Otra cosa muestra "Usá una dirección que empiece con https:// o con /." en el popover.
  - Sin selección y fuera de un enlace, el botón está deshabilitado.
  - `Escape` cierra el popover y el foco vuelve al editor.
  - Los enlaces no se abren al hacer clic dentro del editor.
- **Imágenes existentes del cuerpo:** el nodo `image` del editor es atómico. Muestra la miniatura resuelta de Medios con su `alt` (o "Imagen no disponible" si el `mediaId` ya no está en Medios). Se puede seleccionar, mover arrastrando y borrar con el teclado. No se puede insertar ni editar `alt`/`caption`. Se guarda con los mismos `attrs`.
- **Panel lateral:**
  - **Publicación:** select "Categoría" (obligatorio, "Elegí una categoría" sin valor por defecto en `/new`), "Tiempo de lectura: N min, calculado según el texto." que se actualiza mientras se escribe, y textarea "Llamado a la acción" (`cta`, máx. 300).
  - **URL:** prefijo `/blog/` y el input del slug.
    - Mientras el post nunca se publicó (`publishedAt` vacío) y el admin no editó el slug a mano, el slug sigue al título con `slugify`.
    - Editarlo a mano corta el seguimiento. Borrarlo entero lo vuelve a activar.
    - Si el post tiene `publishedAt`, el input es de solo lectura con la nota "La URL no cambia porque el artículo ya se publicó." y el servidor ignora el slug enviado.
    - Máx. 80 caracteres y formato `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - **Etiquetas (`tag-input.tsx`):** combobox con chips.
    - Autocompleta sobre todas las etiquetas de la tabla `tag` (sin distinguir mayúsculas ni tildes).
    - `Enter` o elegir una opción la agrega; una que no existe se muestra como "Crear «nombre»" y se crea al guardar.
    - Cada chip tiene botón "Quitar etiqueta {nombre}". `Backspace` con el input vacío quita la última.
    - Máximo 5 por artículo y 40 caracteres por nombre. Duplicados (mismo slug) se ignoran.
  - **Imagen de portada:** miniatura de solo lectura si el post tiene `coverMediaId`, o "Sin portada". Sin controles. El guardado nunca toca `cover_media_id`.
  - **Eliminar artículo** (solo en `/edit`): botón con tono peligro que abre `ConfirmDialog` con los textos de SPEC 17. Al confirmar, llama a `deletePostAction`, muestra el toast y hace `router.replace("/admin/articles")`.
- **Validación:**

  | Campo     | Guardar borrador                                | Publicar / Guardar cambios de un publicado |
  | --------- | ----------------------------------------------- | ------------------------------------------ |
  | Título    | Obligatorio (sin espacios alrededor)            | Obligatorio                                |
  | Categoría | Obligatoria                                     | Obligatoria                                |
  | Slug      | Obligatorio y válido; se genera si falta        | Obligatorio y válido                       |
  | Resumen   | Puede quedar vacío                              | Obligatorio                                |
  | CTA       | Puede quedar vacío                              | Obligatorio                                |
  | Cuerpo    | Puede quedar vacío (`doc` con un párrafo vacío) | Al menos un nodo con texto                 |
  | Etiquetas | 0 a 5                                           | 0 a 5                                      |
  - El cuerpo siempre pasa `blogBodySchema` antes de escribir.
  - Los errores se muestran debajo de cada campo (`aria-invalid`, `aria-describedby`) y el foco va al primer campo con error. Un error que no es de un campo sale como toast.
  - La misma validación corre en el cliente (antes de abrir el modal de publicar) y en el servidor.

- **Cambios sin guardar:** el formulario sabe si cambió algo desde la última carga o el último guardado. Si hay cambios, cerrar o recargar la pestaña dispara el aviso nativo de `beforeunload`, y el enlace "← Artículos" abre un `ConfirmDialog` "¿Salir sin guardar?" / "Los cambios que no guardaste se pierden." / "Salir". Después de guardar, el aviso se apaga.
- **Conflicto entre pestañas:** el formulario manda el `updatedAt` que cargó. Si en la base es distinto, no se guarda nada y se muestra el toast "Alguien modificó este artículo. Recargá para ver los cambios.".
- **Server Actions (`actions/admin/articles/index.ts`):**
  - `saveArticleAction(prev, data)` nueva, con `intent` en `data`: `draft` (guardar como borrador), `publish`, `unpublish` o `save` (guardar sin cambiar el estado).
  - Llama a `requireAdmin()`, parsea con `parseArticleForm` y, sin `id`, crea con `createPost` (autor = admin actual); con `id`, actualiza con `updatePost`.
  - Si guardó: `updateTag("blog")`, `updateTag(\`post:${slug}\`)`(y el slug anterior si cambió),`revalidatePath("/admin/articles")`.
  - Mensajes: "Borrador guardado.", "Artículo publicado.", "Artículo pasado a borrador.", "Cambios guardados.". Slug repetido: error en el campo "Ya hay un artículo con esa URL.". Id inexistente: "Ese artículo ya no existe.". Conflicto: el mensaje de arriba. Error de base: "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.".
  - `deletePostAction`, `publishPostAction` y `unpublishPostAction` de SPEC 17 no cambian.
- **Consultas (`db/admin-posts.ts`, `server-only`, sin caché):** `getPostForEdit`, `listAllTags`, `createPost` y `updatePost` (firmas en el modelo de datos).
  - `createPost` y `updatePost` escriben el post y reemplazan sus `post_tag` en una transacción; las etiquetas nuevas se insertan con `onConflictDoNothing` por `slug`.
  - Publicar fija `published_at = now()` solo si está vacío; pasar a borrador no lo toca (igual que `setPostStatus`).
  - `reading_minutes` se calcula siempre en el servidor con `docReadingMinutes(body)`; el valor del cliente no se usa.
  - `getPostForEdit` devuelve también las imágenes del cuerpo y la portada resueltas (`src`, `alt`) para mostrarlas en el editor.
- **Tiptap (`components/admin/article-editor/extensions.ts`):**
  - StarterKit con `heading: { levels: [2, 3] }`, `link: { openOnClick: false, autolink: false, isAllowedUri }` y desactivados `code`, `codeBlock`, `strike`, `underline` y `horizontalRule`.
  - Nodos propios `tip` y `summary` (bloque con contenido en línea) e `image` (atómico, solo en la raíz, con `mediaId`, `alt` y `caption`).
  - `editor.getJSON()` pasa `blogBodySchema` para todo lo que la barra puede producir.
  - Pegar contenido de otro sitio pasa por el esquema de Tiptap: lo que no está en el formato (tablas, H1, código, imágenes externas) se descarta o se baja a párrafo.
  - `useEditor` con `immediatelyRender: false`.
- **Formato y slug sin servidor:**
  - `db/blog-body.ts` suma `docPlainText(doc)`, `docReadingMinutes(doc)` (palabras / 200, hacia arriba, mínimo 1) y `docHasText(doc)`.
  - `lib/slug.ts` nuevo: `slugify` (minúsculas, sin tildes, `ñ` → `n`, todo lo que no es letra o número → `-`, sin guiones repetidos ni en los bordes, recortado a 80) y `isSlug`.
  - `lib/admin/article-form.ts` nuevo: `parseArticleForm` y los tipos del formulario.
- **Diseño:** cabecera, campos, barra, popover, combobox de etiquetas, nodo de imagen, panel lateral y estados de error se hacen con `/frontend-design`, siguiendo el artboard y los tokens `cms-*`. El cuerpo del editor usa la tipografía de `ArticleBody` (H2, H3, listas, citas, Consejo y En resumen se ven parecidos al blog). Todos los controles miden 44 px o más y cumplen 4.5:1 de contraste. En escritorio, dos columnas (cuerpo y panel lateral de 320 px); por debajo de `lg`, una sola columna con el panel debajo del cuerpo.
- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `__tests__/server/slug.test.ts` y `__tests__/server/article-form.test.ts`, nuevos; `blog-body.test.ts` suma casos.
  - Vitest `db`: `__tests__/db/admin-posts.test.ts` y `__tests__/db/admin-articles-actions.test.ts` suman casos.
  - Vitest `client`: `__tests__/client/article-editor.test.tsx` y `__tests__/client/tag-input.test.tsx`, nuevos; `row-menu.test.tsx` suma "Editar".
  - Playwright: `e2e/article-editor.spec.ts`, nuevo; `articles.spec.ts` ya no verifica la ausencia de "Nuevo artículo" y "Editar".

**Fuera de alcance (para specs futuros):**

- Selector de Medios: elegir, cambiar o quitar la portada, e insertar imágenes en el cuerpo o editar su `alt`/`caption` (SPEC 20).
- Autoguardado y "guardado hace un momento".
- "Vista previa" de borradores.
- Estado "Programado", fecha de publicación editable y "Destacado".
- Descripción para buscadores, preview de Google y la sección "Cómo aparece en buscadores".
- Cambiar el slug de un artículo ya publicado y redirects de URLs viejas.
- Cambiar el autor.
- Administrar etiquetas (renombrar, borrar, fusionar) y categorías.
- Historial de versiones.
- Bloquear la navegación interna de Next con cambios sin guardar, salvo el enlace "← Artículos".
- Subrayado, tachado, código, tablas, embeds y H3 en el índice.

## Modelo de datos

No hay tablas, columnas ni migraciones nuevas. Se usa el esquema de SPEC 09 y SPEC 11 (`post`, `category`, `tag`, `post_tag`, `media`) y el formato de SPEC 18.

```ts
// lib/slug.ts
export const SLUG_MAX = 80;
export function slugify(text: string): string; // "¿Qué es SaaS? Guía 2026" → "que-es-saas-guia-2026"
export function isSlug(value: string): boolean; // ^[a-z0-9]+(-[a-z0-9]+)*$ y ≤ 80

// db/blog-body.ts (suma, sin "server-only")
export function docPlainText(doc: BlogDoc): string;
export function docReadingMinutes(doc: BlogDoc): number; // ceil(palabras / 200), mínimo 1
export function docHasText(doc: BlogDoc): boolean;

// lib/admin/article-form.ts (sin dependencias de servidor)
export type ArticleIntent = "draft" | "publish" | "unpublish" | "save";
export const ARTICLE_LIMITS = {
  title: 120,
  excerpt: 300,
  cta: 300,
  tags: 5,
  tagName: 40,
} as const;

export type ArticleInput = {
  title: string;
  slug: string;
  excerpt: string;
  cta: string;
  categoryId: string; // uuid
  body: BlogDoc;
  tags: string[]; // nombres, únicos por slug, máx. 5
};
export type ArticleField = keyof ArticleInput;

export type ParsedArticleForm =
  | {
      ok: true;
      id: string | null; // null en /new
      intent: ArticleIntent;
      expectedUpdatedAt: Date | null;
      input: ArticleInput;
    }
  | { ok: false; fieldErrors: Partial<Record<ArticleField, string>> };

// `status` es el estado con el que quedaría el post (decide si se exigen
// resumen, CTA y cuerpo con texto). El body llega como JSON en `data.get("body")`.
export function parseArticleForm(
  data: FormData,
  currentStatus: "borrador" | "publicado" | null,
): ParsedArticleForm;

// db/admin-posts.ts (suma, "server-only")
export type EditablePost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cta: string;
  categoryId: string;
  body: BlogDoc;
  tags: { slug: string; name: string }[];
  status: "borrador" | "publicado";
  publishedAt: Date | null;
  updatedAt: Date;
  cover: { src: string; alt: string } | null;
  images: Record<string, { src: string; alt: string }>; // mediaId → miniatura
};
export async function getPostForEdit(id: string): Promise<EditablePost | null>;
export async function listAllTags(): Promise<{ slug: string; name: string }[]>;

export type SavePostResult =
  | {
      ok: true;
      id: string;
      slug: string;
      previousSlug: string | null;
      updatedAt: Date;
    }
  | { ok: false; reason: "slug-taken" | "stale" | "not-found" };

export async function createPost(
  input: ArticleInput,
  status: "borrador" | "publicado",
  authorId: string,
): Promise<SavePostResult>;
export async function updatePost(
  id: string,
  input: ArticleInput,
  status: "borrador" | "publicado",
  expectedUpdatedAt: Date,
): Promise<SavePostResult>; // ignora input.slug si el post tiene publishedAt

// actions/admin/articles/index.ts (suma)
export type ArticleFormState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<ArticleField, string>>;
    }
  | {
      status: "success";
      message: string;
      id: string;
      slug: string;
      postStatus: "borrador" | "publicado";
      updatedAt: string; // ISO
    };
export async function saveArticleAction(
  prev: ArticleFormState,
  data: FormData,
): Promise<ArticleFormState>;
```

Campos de `FormData` de `saveArticleAction`: `id` (vacío en `/new`), `intent`, `updatedAt` (ISO, vacío en `/new`), `title`, `slug`, `excerpt`, `cta`, `categoryId`, `body` (JSON), `tags` (uno por etiqueta, repetido).

Archivos nuevos:

- `app/(admin)/admin/articles/new/page.tsx`
- `app/(admin)/admin/articles/[id]/edit/page.tsx`
- `components/admin/article-editor/`: `article-editor.tsx` (cliente, formulario y cabecera), `body-editor.tsx` (cliente, Tiptap), `editor-toolbar.tsx`, `link-popover.tsx`, `tag-input.tsx`, `image-node-view.tsx` y `extensions.ts`.
- `lib/slug.ts`, `lib/admin/article-form.ts`.

Archivos que cambian: `package.json`, `db/blog-body.ts`, `db/admin-posts.ts`, `actions/admin/articles/index.ts`, `app/(admin)/admin/articles/page.tsx`, `articles-table.tsx` y `row-menu.tsx`.

Convenciones:

- Las rutas del editor van en inglés; los textos, en español (SPEC 17).
- Tiptap solo vive en `components/admin/article-editor/`. El blog público sigue con su renderer propio.
- El servidor es la fuente de verdad: valida con `blogBodySchema`, calcula `reading_minutes` e ignora el slug de un post ya publicado.
- Las etiquetas se identifican por `slug`, calculado con `slugify` del nombre.

## Plan de implementación

1. **Tiptap y extensiones.** Instalar las tres dependencias con versión exacta. Crear `extensions.ts` (StarterKit configurado y nodos `tip`, `summary`, `image`). Sumar a `blog-body.test.ts` un caso que arma un doc con un editor headless de Tiptap usando esas extensiones (todos los nodos y marcas) y lo valida con `blogBodySchema`. Prueba: `npm run test:run` pasa y `npm run build` no incluye `@tiptap` en las rutas de `/blog`.
2. **Utilidades.** `lib/slug.ts`, `docPlainText`/`docReadingMinutes`/`docHasText` en `db/blog-body.ts`, y `lib/admin/article-form.ts`, con `slug.test.ts`, `article-form.test.ts` y los casos nuevos de `blog-body.test.ts`. Prueba: `npm run test:run` pasa.
3. **Consultas.** `getPostForEdit`, `listAllTags`, `createPost` y `updatePost`, con casos en `admin-posts.test.ts`. Prueba: `npm run test:db` pasa.
4. **Action.** `saveArticleAction` con casos en `admin-articles-actions.test.ts`. Prueba: `npm run test:db` pasa.
5. **Editor de solo cuerpo y campos.** Páginas `/new` y `/[id]/edit`, `article-editor.tsx`, `body-editor.tsx`, `editor-toolbar.tsx`, `link-popover.tsx` e `image-node-view.tsx`, con guardar, publicar, pasar a borrador, slug y tiempo de lectura. Diseño con `/frontend-design`. `article-editor.test.tsx`. Prueba: `npm run test:run` pasa y con el seed se crea, edita y publica un artículo a mano.
6. **Etiquetas.** `tag-input.tsx` en el panel lateral y `tag-input.test.tsx`. Prueba: `npm run test:run` pasa y una etiqueta nueva aparece en `/blog` del artículo publicado.
7. **Eliminar, cambios sin guardar y conflicto.** Botón "Eliminar artículo", aviso `beforeunload`, modal de "← Artículos" y toast de conflicto. Prueba: `npm run test:run` pasa.
8. **Entradas desde la tabla.** "Nuevo artículo" en la cabecera, título como enlace y "Editar" en "Más acciones"; ajustar `row-menu.test.tsx` y `articles.spec.ts`. Prueba: `npm run test:run` pasa.
9. **E2E.** `e2e/article-editor.spec.ts`. Prueba: `npm run test:e2e` pasa completo.

## Criterios de aceptación

**General**

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa completo, con `blog.spec.ts` sin cambios.
- [ ] `package.json` tiene `@tiptap/react`, `@tiptap/pm` y `@tiptap/starter-kit` con versión exacta (sin `^` ni `~`).
- [ ] `grep -rln "@tiptap" app/\(site\) components/blog db lib` no devuelve nada.

**Utilidades (`server`)**

- [ ] `slugify("¿Qué es SaaS? Guía 2026")` devuelve `que-es-saas-guia-2026`; `slugify("Año  ñandú -- test")` devuelve `ano-nandu-test`; un texto de 200 caracteres da un slug de 80 o menos sin guion final; `slugify("¡¿?!")` devuelve `""`.
- [ ] `isSlug` acepta `seo-local-2026` y rechaza `SEO`, `-seo`, `seo--local`, `seo_local` y uno de 81 caracteres.
- [ ] `docReadingMinutes` de un doc vacío es 1, de uno con 450 palabras repartidas en párrafos, listas, citas y Consejo es 3, y no cuenta las imágenes.
- [ ] `docHasText` es `false` para un doc con un párrafo vacío o solo una imagen, y `true` con una palabra en un `listItem`.
- [ ] `parseArticleForm` con `intent=draft`, título y categoría pero sin resumen, CTA ni cuerpo con texto devuelve `ok: true`.
- [ ] Con `intent=publish` y los mismos datos devuelve errores en `excerpt`, `cta` y `body`.
- [ ] Con `intent=save` y `currentStatus: "publicado"` exige resumen, CTA y cuerpo con texto.
- [ ] Sin título (o solo espacios), sin categoría, con un título de 121 caracteres, un slug `Mal Slug`, 6 etiquetas o un `body` que no pasa `blogBodySchema` devuelve el error en el campo correspondiente.
- [ ] Un slug vacío en un borrador se reemplaza por `slugify(título)`.
- [ ] Etiquetas `["SEO", "seo", " Seo "]` quedan como una sola.
- [ ] Un doc armado con el editor headless de Tiptap y las extensiones del panel (H2, H3, listas anidadas, cita, Consejo, En resumen, imagen, negrita, cursiva, enlace y `hardBreak`) pasa `blogBodySchema`.

**Consultas (`admin-posts.test.ts`)**

- [ ] `createPost` como borrador guarda el post con `status: "borrador"`, `published_at` vacío, `author_id` del admin, `reading_minutes` calculado del cuerpo y sus etiquetas, creando las que no existían.
- [ ] `createPost` con un slug que ya existe devuelve `reason: "slug-taken"` y no crea nada (ni etiquetas).
- [ ] `updatePost` con el `updatedAt` correcto guarda los cambios y reemplaza las etiquetas (las que se quitaron dejan de estar en `post_tag`, la tabla `tag` las conserva).
- [ ] `updatePost` con un `updatedAt` viejo devuelve `reason: "stale"` y no cambia nada; con un id inexistente, `reason: "not-found"`.
- [ ] `updatePost` sobre un post con `published_at` ignora un slug distinto y devuelve `previousSlug: null`; sobre un borrador nunca publicado cambia el slug y devuelve el anterior en `previousSlug`.
- [ ] Publicar fija `published_at` si estaba vacío y lo conserva si ya tenía; pasar a borrador no lo toca.
- [ ] `updatePost` nunca cambia `cover_media_id` ni `author_id`.
- [ ] `getPostForEdit` devuelve las etiquetas, la portada resuelta y en `images` la miniatura de cada `mediaId` del cuerpo; con un id inexistente o que no es UUID devuelve `null`.

**Action (`admin-articles-actions.test.ts`)**

- [ ] `saveArticleAction` llama a `requireAdmin()` antes de tocar la base.
- [ ] Sin `id` e `intent=draft` crea el borrador y devuelve "Borrador guardado." con el `id` nuevo.
- [ ] `intent=publish` devuelve "Artículo publicado." y el post sale en `getPublishedPosts`; llama a `updateTag("blog")`, `updateTag("post:{slug}")` y `revalidatePath("/admin/articles")`.
- [ ] `intent=unpublish` devuelve "Artículo pasado a borrador." y el post deja de salir en `getPublishedPosts`.
- [ ] `intent=save` sobre un publicado devuelve "Cambios guardados." y no cambia `status` ni `published_at`.
- [ ] Cambiar el slug de un borrador llama a `updateTag` con el slug nuevo y el anterior.
- [ ] Un slug repetido devuelve `fieldErrors.slug` "Ya hay un artículo con esa URL."; un `updatedAt` viejo, "Alguien modificó este artículo. Recargá para ver los cambios."; un id inexistente, "Ese artículo ya no existe.".
- [ ] Un `body` con un enlace `javascript:alert(1)` devuelve error y no escribe.

**Componentes (`client`)**

- [ ] `ArticleEditor` en `/new` muestra "Guardar borrador" y "Publicar"; con un post publicado, "Pasar a borrador" y "Guardar cambios".
- [ ] Escribir un título en `/new` llena el slug con `slugify`; editar el slug a mano corta el seguimiento.
- [ ] Con `publishedAt`, el input del slug es de solo lectura y muestra la nota.
- [ ] "Publicar" sin resumen muestra el error debajo del campo, mueve el foco a él y no abre el modal.
- [ ] Los botones de la barra tienen `aria-label` y "Negrita" tiene `aria-pressed="true"` con el cursor en texto en negrita.
- [ ] El popover de enlace rechaza `javascript:alert(1)` con el mensaje de error y acepta `/servicios`.
- [ ] Con cambios sin guardar, "← Artículos" abre "¿Salir sin guardar?"; sin cambios, navega directo.
- [ ] `TagInput`: `Enter` agrega un chip, "Crear «nombre»" aparece para una etiqueta nueva, `Backspace` con el input vacío quita la última y con 5 chips el input se deshabilita.
- [ ] `RowMenu` muestra "Editar" primero, con `href="/admin/articles/{id}/edit"`, en borradores y publicados.

**Editor (E2E, `article-editor.spec.ts`)**

- [ ] "Nuevo artículo" en `/admin/articles` lleva a `/admin/articles/new`.
- [ ] Completar título, categoría y una línea de cuerpo y tocar "Guardar borrador" muestra "Borrador guardado.", deja la URL en `/admin/articles/{id}/edit` y el artículo aparece en "Borradores" de la tabla.
- [ ] En el cuerpo, `## ` crea un H2, Ctrl/Cmd+B pone negrita, "Lista con viñetas" crea una lista, "Consejo" crea un recuadro y "Enlace" con `https://ejemplo.com` crea un enlace; después de guardar y recargar, todo sigue ahí.
- [ ] Publicar ese artículo pide confirmación, muestra "Artículo publicado." y `/blog/{slug}` muestra el H2 con `01`, la negrita, la lista, el Consejo y el enlace con `target="_blank"`.
- [ ] Después de publicar, el slug es de solo lectura; cambiar el título y "Guardar cambios" actualiza `/blog/{slug}` sin cambiar la URL.
- [ ] El tiempo de lectura del panel lateral cambia al pegar un texto largo, y el de `/blog/{slug}` coincide después de guardar.
- [ ] Una etiqueta nueva agregada en el editor aparece en el artículo publicado y en el filtro de etiquetas de `/blog`.
- [ ] Editar `senales-sistema-a-medida` (que tiene imágenes en el cuerpo) muestra sus miniaturas y, al guardar sin tocar nada, `/blog/senales-sistema-a-medida` se ve igual.
- [ ] Un slug repetido muestra "Ya hay un artículo con esa URL." debajo del campo.
- [ ] Guardar en una pestaña y después en otra abierta antes muestra "Alguien modificó este artículo. Recargá para ver los cambios." y no pisa el cambio.
- [ ] "Pasar a borrador" desde el editor pide confirmación y `/blog/{slug}` da 404.
- [ ] "Eliminar artículo" pide confirmación; "Eliminar" lleva a `/admin/articles` con el toast y el artículo ya no está.
- [ ] Editar desde "Más acciones → Editar" y desde el título de la fila abre el editor del artículo correcto.
- [ ] `/admin/articles/no-existe/edit` y `/admin/articles/{uuid-inexistente}/edit` responden 404; sin sesión, `/admin/articles/new` redirige a `/cuenta/login`.
- [ ] A 390 px el editor no tiene scroll horizontal de página y los botones de la cabecera siguen visibles.
- [ ] El texto, los botones, los errores y el popover cumplen 4.5:1 de contraste y todos los controles miden 44 px o más (revisado con `/frontend-design`).

## Decisiones

- **Sí:** el editor va en dos specs. SPEC 19 es el editor de texto, metadatos y etiquetas; SPEC 20, el selector de Medios para portada e imágenes del cuerpo. Elegido por el usuario.
- **No:** todo en uno. Spec grande que no se verifica por partes.
- **Sí:** `/admin/articles/new` no crea fila hasta el primer guardado. Elegido por el usuario.
- **No:** crear un borrador vacío al tocar "Nuevo artículo". Obliga a defaults en columnas `NOT NULL` y deja borradores fantasma.
- **Sí:** guardado manual con aviso de cambios sin guardar. Elegido por el usuario.
- **No:** autoguardado. Suma conflictos, validación parcial y estado de red; puede llegar en otro spec.
- **Sí:** borrador laxo (título y categoría) y publicar estricto (más resumen, CTA y cuerpo con texto). Elegido por el usuario.
- **Sí:** el slug sigue al título hasta que se edita a mano y queda fijo una vez publicado. Elegido por el usuario.
- **No:** slug editable siempre. Rompe enlaces compartidos y no hay redirects.
- **Sí:** etiquetas existentes con autocompletado y creación de nuevas al guardar, máximo 5. Elegido por el usuario.
- **Sí:** tiempo de lectura calculado en el servidor a 200 palabras por minuto; CTA como textarea. Elegido por el usuario.
- **No:** minutos manuales. Se desactualizan al editar el texto.
- **Sí:** las imágenes que ya están en el cuerpo se ven como miniatura y se conservan; no se insertan hasta SPEC 20. Elegido por el usuario.
- **Sí:** la barra tiene todo el formato de SPEC 18, más deshacer y rehacer. Elegido por el usuario.
- **No:** solo H2, H3, B e I como el canvas. Consejo y En resumen no tendrían forma de crearse.
- **Sí:** enlaces con un popover propio que valida igual que `blogBodySchema`. Elegido por el usuario.
- **No:** `window.prompt`. No se puede estilar y bloquea los tests de navegador.
- **Sí:** cabecera como el canvas sin "Vista previa", "Eliminar artículo" en el panel lateral, "Nuevo artículo" en la tabla y "Editar" en el título y en "Más acciones". Elegido por el usuario.
- **Sí:** Tiptap v3 con StarterKit y extensiones fuera del formato desactivadas; nodos propios en el repo; versiones exactas. Elegido por el usuario.
- **No:** extensiones sueltas sin StarterKit. Más paquetes para el mismo resultado.
- **Sí:** la portada se ve de solo lectura y el guardado no la toca. Elegido por el usuario.
- **Sí:** detectar ediciones concurrentes con `updatedAt`. Elegido por el usuario.
- **No:** gana el último. Pisa trabajo sin aviso.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.
- **Sí:** "Publicar" y "Pasar a borrador" del editor piden confirmación con los textos de SPEC 17; guardar no. Cambian lo que ve el público, como en la tabla.
- **Sí:** una sola action `saveArticleAction` con `intent`. Publicar desde el editor guarda los cambios y el estado en una transacción, sin dos viajes.
- **Sí:** el servidor revalida todo y calcula `reading_minutes`; el cliente valida solo para dar feedback rápido.
- **Sí:** el aviso de cambios sin guardar cubre `beforeunload` y "← Artículos". Next no permite bloquear cualquier navegación interna sin hacks.
- **Sí:** el slug de las etiquetas nuevas se calcula con el mismo `slugify`, que cumple el `CHECK` de `tag.slug`.
- **Sí:** el autor de un artículo nuevo es el admin que lo crea y no se cambia.

## Riesgos

| Riesgo                                                                                        | Mitigación                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Tiptap produce JSON con nodos o atributos que `blogBodySchema` rechaza y no se puede guardar. | Extensiones fuera del formato desactivadas; un test arma un doc con todo lo de la barra en un editor headless y lo valida con el esquema. |
| Pegar HTML de otro sitio mete contenido fuera del formato.                                    | El esquema de ProseMirror descarta lo que no conoce y el servidor valida con `blogBodySchema` antes de escribir.                          |
| Tiptap renderiza en el servidor y rompe la hidratación o el build.                            | `useEditor` con `immediatelyRender: false` dentro de un componente cliente; el build sin `DATABASE_URL` lo prueba.                        |
| Tiptap termina en el bundle del blog público.                                                 | Solo se importa desde `components/admin/article-editor/`; un `grep` de los criterios lo verifica.                                         |
| Guardar un post con imágenes en el cuerpo las pierde o cambia sus `attrs`.                    | Nodo `image` atómico que guarda `mediaId`, `alt` y `caption` sin tocarlos; un E2E guarda `senales-sistema-a-medida` y compara el blog.    |
| Cambiar el slug de un borrador deja la caché pública del slug viejo.                          | La action invalida `post:{slug}` nuevo y anterior.                                                                                        |
| Dos pestañas guardan a la vez y una pisa a la otra.                                           | Chequeo de `updatedAt` en el `UPDATE`; test `db` y E2E.                                                                                   |
| Una carrera entre dos creaciones con el mismo slug viola el `UNIQUE`.                         | `createPost`/`updatePost` atrapan la violación de unicidad y devuelven `slug-taken`.                                                      |
| Una etiqueta nueva cuyo nombre da un slug vacío (solo signos) viola el `CHECK` de `tag`.      | `parseArticleForm` descarta etiquetas con `slugify` vacío; test de utilidades.                                                            |
| El admin pierde texto al salir sin guardar.                                                   | Aviso `beforeunload` y modal en "← Artículos".                                                                                            |
| Leer `params` o la base fuera de `<Suspense>` rompe el build con Cache Components.            | Toda lectura va dentro del `<Suspense>` de la página; el build sin `DATABASE_URL` lo prueba.                                              |

## Qué **no** incluye este spec

- Selector de Medios para portada e imágenes del cuerpo (SPEC 20).
- Autoguardado, "Vista previa" e historial de versiones.
- "Programado", fecha de publicación editable y "Destacado".
- SEO: descripción para buscadores y preview de Google.
- Slug editable después de publicar y redirects.
- Administración de etiquetas y categorías.
- Marcas y bloques fuera del formato de SPEC 18.

Cada uno de estos, si llega, va en su propio spec.
