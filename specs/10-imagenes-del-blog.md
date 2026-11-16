# SPEC 10 — Imágenes del blog

> **Estado:** Aprobado
> **Depende de:** SPEC 03, SPEC 07, SPEC 09
> **Fecha:** 2026-11-15
> **Objetivo:** Permitir que un admin suba imágenes a una biblioteca propia guardada en disco local, y usarlas como portada y como bloque dentro del cuerpo de los posts, sin servicios de terceros.

## Por qué existe este spec

SPEC 09 dejó las tablas del blog sin imágenes: la portada es un dibujo generado por categoría (`PostThumb`) y `BlogBlock` solo tiene texto.
No hay editor de posts y las páginas siguen leyendo `lib/blog-posts.ts`.
Este spec suma la biblioteca de medios (tabla, archivos, procesamiento, subida y ruta pública), la portada y el bloque `image` en la base, y los componentes públicos listos para mostrarlos.
Las páginas siguen leyendo el mock: un post mock lleva portada e imagen para verlas funcionando.

Tres decisiones marcan el diseño:

- Todo es gratis y local: los archivos van a una carpeta en disco (`MEDIA_DIR`) y se procesan con `sharp`. No hay CDN, S3 ni servicios externos.
- Cada subida se re-codifica a WebP de 1920 px de ancho como máximo. Así se borran el EXIF y el GPS y el formato servido es uno solo.
- El cuerpo guarda el **id** de la imagen (`mediaId`), no su URL. `db/blog.ts` lo resuelve al leer y una imagen en uso no se puede borrar.

Las etiquetas, pedidas junto con esta funcionalidad, van en su propio spec.

**Referencias:**

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (route handler `GET` con params dinámicos y `cacheComponents`).
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` (`bodySizeLimit`).
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md` (el default de 10 MB del proxy de `proxy.ts`).
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` (`fill`, `sizes`, imágenes locales).
- La documentación de `sharp`: `rotate()`, `resize({ withoutEnlargement })`, `webp()`, `limitInputPixels`.
- La documentación de Drizzle: contención `@>` sobre `jsonb`.

## Alcance

**Incluye:**

- Dependencia `sharp` en `dependencies`, con versión fija.
- Variable `MEDIA_DIR` (carpeta de los archivos), con default `storage/media` relativo a la raíz del repo. `/storage` va al `.gitignore`.
- `db/schema/media.ts`, reexportado desde `db/schema/index.ts`: tabla `media`.
- `db/schema/blog.ts`: `post.coverMediaId`, FK nullable a `media` con `restrict`.
- Migración `db/migrations/0003_media.sql`, generada con `npm run db:generate -- --name media`.
- `lib/media/process.ts` (sin `server-only`, para probarlo en el proyecto `server`):
  - `processImage(input: Buffer)`: valida y re-codifica (detalle en el modelo de datos).
  - Acepta JPEG, PNG, WebP y AVIF de hasta 10 MB y 40 megapíxeles. Rechaza el resto con un `MediaError` y un mensaje en español.
  - Respeta la orientación EXIF con `rotate()` antes de descartar los metadatos.
- `lib/media/storage.ts` (`import "server-only"`): `getMediaDir()`, `writeMediaFile`, `readMediaFile` y `deleteMediaFile`. Los archivos se llaman `<id>.webp`. `getMediaDir()` valida `MEDIA_DIR` con Zod al llamar y crea la carpeta si no existe.
- `db/media.ts` (`import "server-only"`):
  - `createMedia`, `listMedia`, `updateMediaAlt`, `getMediaUsage` y `deleteMedia`.
  - `createMedia` deduplica por `sha256` del archivo original: si ya existe, devuelve la fila existente con `duplicate: true`.
  - `deleteMedia` lanza `MediaInUseError` con los títulos de los posts si la imagen es portada o aparece en el `body` de cualquier post, `borrador` o `publicado`.
- `db/blog-body.ts`: `blogBodySchema` suma el bloque guardado `{ type: "image", mediaId, alt?, caption? }`.
- `lib/blog-posts.ts`:
  - Tipo `BlogImage` (`src`, `width`, `height`, `alt`).
  - `BlogBlock` suma `{ type: "image"; image: BlogImage; caption?: string }`, ya resuelto.
  - `BlogPost` suma `cover?: BlogImage`.
  - `senales-sistema-a-medida` lleva portada y una imagen en el cuerpo, justo después del primer `h2`.
- `db/blog.ts`:
  - `PostSummary` suma `cover: BlogImage | null`.
  - `PostDetail.body` devuelve bloques `image` resueltos a `BlogImage` con `src` = `/media/<id>`. El `alt` del bloque pisa el de `media`.
  - Si un bloque o la portada apunta a un `media` que no existe, lanza un error que nombra el slug y el `mediaId`.
- Ruta pública `app/media/[id]/route.ts` (`GET`):
  - Valida que `id` sea un UUID y que exista la fila en `media`. Si no, responde 404.
  - Devuelve el archivo con `Content-Type: image/webp` y `Cache-Control: public, max-age=31536000, immutable`.
  - Si la fila existe pero falta el archivo, responde 404 y registra un `console.error` con el id.
- Componentes públicos:
  - `components/blog/post-thumb.tsx` recibe `cover?: BlogImage`. Con portada muestra `next/image` con `fill`, `object-cover` y `sizes` según la variante. Sin portada mantiene el diseño actual.
  - En `card` y `featured` la imagen lleva `alt=""` porque el título ya es el texto del enlace. En `banner` (`article-hero`) lleva el `alt` de la imagen.
  - `post-card.tsx`, `featured-post.tsx` y `article-hero.tsx` pasan `post.cover`.
  - `components/blog/article-body.tsx` renderiza `image` como `<figure>` con `next/image` (`width` y `height` reales, ancho de la columna) y `<figcaption>` si hay `caption`.
- Administración en `app/(site)/admin/medios/page.tsx`, solo para `admin` con `requireAdmin()`, diseñada con `/frontend-design` sobre los tokens de `app/globals.css` y el estilo de `/admin`:
  - Formulario de subida con archivo (`accept` con los 4 tipos) y `alt` obligatorio.
  - Grilla de todas las imágenes, de la más nueva a la más vieja, sin paginación. Cada tarjeta muestra miniatura, `alt`, medidas, peso en KB, fecha y "En uso en: …" con los títulos de los posts, o "Sin usar".
  - Botón "Copiar id" que copia el `id` al portapapeles y muestra "Copiado" durante 2 s.
  - Editar `alt` en el lugar, con guardar y cancelar.
  - Borrar en dos pasos dentro de la tarjeta: "Borrar" pasa a "¿Borrar? Sí / No". Si la imagen está en uso, el botón queda `disabled` con el texto "En uso".
  - Mensajes: "Imagen subida.", "Esa imagen ya estaba subida." (duplicado), el mensaje del `MediaError`, y "No se puede borrar: está en uso en …".
  - `/admin` suma un enlace a "Medios".
- Server Actions en `app/(site)/admin/medios/actions.ts`: `uploadMediaAction`, `updateMediaAltAction` y `deleteMediaAction`. Cada una llama a `requireAdmin()`, valida con Zod y hace `revalidatePath("/admin/medios")`.
- `next.config.ts`: `serverActions.bodySizeLimit` de `11mb`, para que entre un archivo de 10 MB más el formulario.
- Imágenes de demo generadas desde SVG abstractos con la paleta del sitio, convertidas a WebP y commiteadas:
  - `public/blog/senales-portada.webp` (1920×1080).
  - `public/blog/senales-diagrama.webp` (1600×900).
  - Las fuentes SVG quedan en `scripts/demo-images/`.
- Seed (`db/seed/blog.ts`):
  - Para cada imagen del mock, lee el archivo de `public/`, lo pasa por `processImage`, lo guarda en `MEDIA_DIR` y crea la fila `media` con el `alt` del mock.
  - Guarda `post.coverMediaId` y los bloques `image` con su `mediaId`.
  - Sigue siendo idempotente: la clave natural de `media` es `sha256`, y un archivo que ya está en disco no se reescribe.
- Variables de entorno: `MEDIA_DIR` en `.env.example` (comentada, con el default), `.env.test.local` y el CI (`test-results/media`).
- Tests:
  - Vitest `server`: `__tests__/server/media-process.test.ts` y casos nuevos en `__tests__/server/blog-body.test.ts`.
  - Vitest `client`: `__tests__/client/post-thumb.test.tsx` y `__tests__/client/article-body.test.tsx`.
  - Vitest `db`: `__tests__/db/media.test.ts`, y casos nuevos en `blog-queries.test.ts` y `blog-seed.test.ts`. `MEDIA_DIR` apunta a una carpeta temporal de `os.tmpdir()` que se borra en `afterAll`. `resetBlog()` también borra `media`, después de `post`.
  - Playwright `e2e/medios.spec.ts`, con un PNG de prueba en `e2e/fixtures/imagen.png`.
- `README.md`: `MEDIA_DIR`, que la carpeta tiene que ser persistente y entrar en el backup junto con la base, y que el despliegue serverless no sirve sin cambiar el almacenamiento.

**Fuera de alcance (para specs futuros):**

- Etiquetas de posts (su propio spec).
- Pasar `/blog`, `/blog/[slug]` y la home a leer de la base.
- Editor de posts: crear y editar posts, y elegir portada o insertar imágenes desde una UI.
- Varios tamaños generados al subir o `srcset` propio. Lo hace `next/image`.
- Recorte, rotación manual o edición de imágenes.
- Paginación y búsqueda en `/admin/medios`.
- Almacenamiento en S3, MinIO o un CDN.
- Imágenes en comentarios o en el perfil de usuario.
- Galerías o varias imágenes en un mismo bloque.
- GIF animados, SVG y video.
- Limpieza de archivos huérfanos en disco.

## Modelo de datos

```ts
// db/schema/media.ts — columnas en camelCase, snake_case en la base (casing de SPEC 06)
export const media = pgTable("media", {
  id: text().primaryKey(), // crypto.randomUUID() con $defaultFn; nombre del archivo
  sha256: text().notNull().unique(), // hash del archivo original: dedup y clave del seed
  alt: text().notNull(), // check: length(trim(alt)) > 0
  width: integer().notNull(), // del WebP procesado; check > 0
  height: integer().notNull(), // check > 0
  bytes: integer().notNull(), // tamaño del WebP en disco; check > 0
  originalName: text().notNull(), // "foto equipo.jpg", solo informativo
  uploadedBy: text().references(() => user.id, { onDelete: "set null" }),
  createdAt,
  updatedAt,
}); // índice: (created_at)

// db/schema/blog.ts — columna nueva en post
coverMediaId: text().references(() => media.id, { onDelete: "restrict" }),
// índice: (cover_media_id)
```

```ts
// lib/blog-posts.ts
export type BlogImage = {
  src: string; // "/media/<id>" o "/blog/senales-portada.webp" en el mock
  width: number;
  height: number;
  alt: string;
};
export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; id: string; text: string }
  | { type: "tip"; text: string }
  | { type: "summary"; text: string }
  | { type: "image"; image: BlogImage; caption?: string }; // nuevo, resuelto
// BlogPost suma: cover?: BlogImage;

// db/blog-body.ts — forma guardada en post.body (jsonb)
export type StoredBlogBlock =
  | Exclude<BlogBlock, { type: "image" }>
  | { type: "image"; mediaId: string; alt?: string; caption?: string };
export const blogBodySchema: z.ZodType<StoredBlogBlock[]>;
// mediaId: UUID. alt y caption: si están, no vacíos después de trim.

// lib/media/process.ts
export class MediaError extends Error {}
export const MEDIA_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 40_000_000,
  maxWidth: 1920,
  formats: ["jpeg", "png", "webp", "avif"],
  webpQuality: 82,
} as const;
export function processImage(input: Buffer): Promise<{
  data: Buffer; // WebP sin metadatos
  width: number;
  height: number;
  sha256: string; // del input original
}>;

// db/media.ts (server-only)
export type MediaUsage = {
  postId: string;
  slug: string;
  title: string;
  as: "portada" | "cuerpo";
};
export type MediaItem = {
  id: string;
  src: string; // "/media/<id>"
  alt: string;
  width: number;
  height: number;
  bytes: number;
  originalName: string;
  createdAt: Date;
  usage: MediaUsage[];
};
export class MediaInUseError extends Error {
  usage: MediaUsage[];
}
export function createMedia(input: {
  file: Buffer;
  originalName: string;
  alt: string;
  uploadedBy: string | null;
}): Promise<{ item: MediaItem; duplicate: boolean }>;
export function listMedia(): Promise<MediaItem[]>; // createdAt descendente
export function updateMediaAlt(id: string, alt: string): Promise<void>;
export function getMediaUsage(id: string): Promise<MediaUsage[]>;
export function deleteMedia(id: string): Promise<void>; // lanza MediaInUseError

// db/blog.ts — cambios
// PostSummary suma: cover: BlogImage | null;
// PostDetail.body: BlogBlock[] con los bloques image ya resueltos.
```

Formato del archivo en disco: `${MEDIA_DIR}/<id>.webp`. La base guarda las medidas, así que la ruta no lee metadatos.

Flujo de subida (`createMedia`):

1. `processImage(file)`. Si falla, lanza `MediaError` y no toca ni el disco ni la base.
2. Si existe una fila con ese `sha256`, la devuelve con `duplicate: true` y no escribe nada.
3. Escribe `<id>.webp` en `MEDIA_DIR`.
4. Inserta la fila. Si el insert falla, borra el archivo recién escrito y relanza el error.

Flujo de borrado (`deleteMedia`):

1. `getMediaUsage(id)`: busca `post.cover_media_id = id` y `post.body @> '[{"type":"image","mediaId":"<id>"}]'`, en posts de cualquier estado.
2. Si hay uso, lanza `MediaInUseError`.
3. Borra la fila y después el archivo. Si el archivo no está, no falla.

Variables de entorno nuevas:

| Variable    | Dónde                                     | Ejemplo / default |
| ----------- | ----------------------------------------- | ----------------- |
| `MEDIA_DIR` | `.env.local`, `.env.test.local`, CI, prod | `storage/media`   |

Comportamiento al borrar:

| Se borra                       | Efecto                                                      |
| ------------------------------ | ----------------------------------------------------------- |
| Una imagen que es portada      | Falla por la FK `restrict` y, antes, por `MediaInUseError`. |
| Una imagen usada en un `body`  | Falla por `MediaInUseError` (no hay FK dentro del jsonb).   |
| Una imagen sin usar            | Borra la fila y el archivo.                                 |
| El usuario que subió la imagen | La imagen queda, con `uploaded_by` nulo.                    |
| Un post                        | Sus imágenes quedan en la biblioteca, ahora "Sin usar".     |

Convenciones:

- Solo `db/media.ts`, `db/blog.ts`, el seed y la ruta `/media/[id]` consultan `media`.
- La URL pública de una imagen es siempre `/media/<id>`. Nadie arma rutas a `MEDIA_DIR` fuera de `lib/media/storage.ts`.
- `next/image` optimiza `/media/<id>` como imagen local, sin `remotePatterns`.

## Plan de implementación

1. **Procesamiento.** Instalar `sharp`, crear `lib/media/process.ts` y `__tests__/server/media-process.test.ts`. Prueba: `npm run test:run` pasa.
2. **Tipos y esquema del cuerpo.** Sumar `BlogImage`, el bloque `image` y `cover?` en `lib/blog-posts.ts`, y `StoredBlogBlock` en `db/blog-body.ts` con sus tests. Ningún post mock usa imágenes todavía. Prueba: `npm run test:run` y `npx tsc --noEmit` pasan.
3. **Componentes públicos.** `PostThumb` con `cover` y `ArticleBody` con `image`, diseñados con `/frontend-design`, con sus tests `client`. Prueba: `npm run test:run` pasa y `/blog` se ve igual que antes.
4. **Demo en el mock.** Crear los SVG en `scripts/demo-images/`, generar los dos WebP en `public/blog/` y sumar portada e imagen a `senales-sistema-a-medida`. Prueba: en `npm run dev`, `/blog` y `/blog/senales-sistema-a-medida` muestran la portada y la imagen, y los demás posts muestran el dibujo generado.
5. **Tabla y migración.** Crear `db/schema/media.ts`, sumar `post.coverMediaId` y generar `0003_media.sql`. Prueba: `npm run db:migrate` crea `media` y la columna, y un segundo `db:generate` no crea migraciones.
6. **Almacenamiento y biblioteca.** Crear `lib/media/storage.ts`, `db/media.ts` y `__tests__/db/media.test.ts`, y actualizar `resetBlog()`. Prueba: `npm run test:db` pasa.
7. **Resolver en `db/blog.ts`.** Sumar `cover` y la resolución de bloques `image`, con casos en `blog-queries.test.ts`. Prueba: `npm run test:db` pasa.
8. **Ruta `/media/[id]`.** Crear `app/media/[id]/route.ts`. Prueba: con una imagen cargada por test o seed, `curl -I localhost:3000/media/<id>` devuelve 200 `image/webp`, y un id inválido devuelve 404.
9. **Seed.** Cargar las imágenes del mock en `seedBlog` y extender `blog-seed.test.ts`. Prueba: `npm run db:seed` dos veces deja 2 filas en `media` y 2 archivos en `MEDIA_DIR`.
10. **Admin: subir y listar.** `app/(site)/admin/medios/page.tsx`, `uploadMediaAction`, `bodySizeLimit` y el enlace desde `/admin`. Prueba: como admin, subir un JPG lo muestra en la grilla, y como lector `/admin/medios` no se ve.
11. **Admin: alt, copiar y borrar.** `updateMediaAltAction`, `deleteMediaAction` y los controles de la tarjeta. Prueba: editar el alt persiste al recargar, y una imagen en uso no se puede borrar.
12. **E2E, variables y README.** `e2e/medios.spec.ts`, `MEDIA_DIR` en `.env.example`, `.env.test.local` y CI, `/storage` en `.gitignore`, y la sección del README.

## Criterios de aceptación

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado, incluidos los tests de SPEC 07, 08 y 09.
- [ ] `npm run test:e2e` pasa.
- [ ] Los jobs `checks`, `db` y `e2e` del CI pasan en un PR a `main`.
- [ ] `package.json` tiene `sharp` en `dependencies` y ningún paquete de almacenamiento de terceros.
- [ ] `npm run db:migrate` crea la tabla `media` y la columna `post.cover_media_id`, y después `db:generate` no crea migraciones nuevas.
- [ ] `processImage` con un JPEG de 4000×3000 devuelve un WebP de 1920×1440.
- [ ] `processImage` con un PNG de 800×600 devuelve un WebP de 800×600 (no agranda).
- [ ] `processImage` con un JPEG con EXIF de orientación 6 devuelve la imagen girada y sin EXIF ni GPS.
- [ ] `processImage` rechaza con `MediaError` un GIF, un archivo de texto renombrado a `.jpg`, un archivo de más de 10 MB y una imagen de más de 40 megapíxeles.
- [ ] `blogBodySchema` acepta un bloque `{ type: "image", mediaId: <uuid> }` y rechaza uno sin `mediaId`, uno con `mediaId` que no es UUID y uno con `alt` vacío.
- [ ] `PostThumb` sin `cover` renderiza el dibujo de la categoría como antes.
- [ ] `PostThumb` con `cover` en `card` renderiza un `<img>` con `alt=""`, y en `banner` con el `alt` de la imagen.
- [ ] `ArticleBody` con un bloque `image` y `caption` renderiza `<figure>`, `<img>` con su `alt` y `<figcaption>` con el texto.
- [ ] `/blog` muestra la portada de `senales-sistema-a-medida` en su tarjeta, y los otros 7 posts muestran el dibujo generado.
- [ ] `/blog/senales-sistema-a-medida` muestra la portada en el hero y la imagen del cuerpo después del primer `h2`.
- [ ] `createMedia` guarda `<id>.webp` en `MEDIA_DIR` y una fila con medidas y `bytes` iguales al archivo.
- [ ] `createMedia` dos veces con el mismo archivo devuelve la misma fila, `duplicate: true` en la segunda, y deja un solo archivo.
- [ ] `createMedia` con un archivo inválido no deja ni fila ni archivo.
- [ ] Insertar `media` con `alt` vacío o solo espacios falla por el check.
- [ ] `deleteMedia` de una imagen que es portada lanza `MediaInUseError` con el título del post.
- [ ] `deleteMedia` de una imagen usada en el `body` de un post `borrador` lanza `MediaInUseError`.
- [ ] `deleteMedia` de una imagen sin usar borra la fila y el archivo.
- [ ] Borrar el usuario que subió una imagen deja la imagen con `uploaded_by` nulo.
- [ ] `getPublishedPostBySlug` devuelve el bloque `image` con `src` `/media/<id>`, las medidas de `media` y el `alt` del bloque si lo tiene o el de `media` si no.
- [ ] `getPublishedPosts` devuelve `cover: null` para un post sin portada.
- [ ] `getPublishedPostBySlug` lanza un error que nombra el slug y el `mediaId` si un bloque apunta a un `media` inexistente.
- [ ] `GET /media/<id>` de una imagen existente devuelve 200, `Content-Type: image/webp` y `Cache-Control: public, max-age=31536000, immutable`.
- [ ] `GET /media/no-es-uuid` y `GET /media/<uuid inexistente>` devuelven 404.
- [ ] Después de `seedBlog`, `getPublishedPostBySlug("senales-sistema-a-medida")` tiene `cover` y un bloque `image` resuelto, y hay 2 filas en `media`.
- [ ] Correr `seedBlog` dos veces deja la misma cantidad de filas en `media` y de archivos en `MEDIA_DIR`.
- [ ] Un usuario `lector` que abre `/admin/medios` no ve la página (mismo comportamiento que `/admin`).
- [ ] Llamar a `uploadMediaAction`, `updateMediaAltAction` o `deleteMediaAction` sin sesión de admin no cambia nada en la base ni en el disco.
- [ ] E2E: un admin sube `e2e/fixtures/imagen.png` con alt, ve "Imagen subida." y la tarjeta con ese alt, y `GET` del `src` de la tarjeta devuelve `image/webp`.
- [ ] E2E: subir el mismo archivo otra vez muestra "Esa imagen ya estaba subida." y la grilla no suma tarjetas.
- [ ] E2E: un archivo `.txt` muestra el mensaje de formato no soportado.
- [ ] E2E: editar el alt y recargar muestra el alt nuevo.
- [ ] E2E: una imagen sin usar se borra con "Borrar" → "Sí" y desaparece de la grilla.
- [ ] Una imagen en uso muestra "En uso en: <título>" y su botón de borrar está deshabilitado.
- [ ] "Copiar id" deja el id en el portapapeles y muestra "Copiado".
- [ ] `/admin` tiene un enlace a `/admin/medios`.
- [ ] `/storage` está en `.gitignore` y `MEDIA_DIR` está en `.env.example`.
- [ ] `README.md` explica `MEDIA_DIR`, que la carpeta debe persistir y entrar en el backup, y que serverless no sirve con este almacenamiento.

## Decisiones

- **Sí:** imágenes en este spec y etiquetas en otro. Son independientes y juntas tocaban más de tres áreas. Elegido por el usuario.
- **Sí:** archivos en disco local (`MEDIA_DIR`), fuera de `public/`, servidos por un route handler. Es gratis, no depende de terceros y rinde mejor que la base. Elegido por el usuario.
- **No:** `bytea` en Postgres. Funciona en cualquier host, pero agranda la base y los backups.
- **No:** MinIO u otro storage compatible con S3. Es un servicio más para operar.
- **No:** guardar en `public/`. Next sirve `public/` como está en el build: lo subido después no aparece en producción.
- **Sí:** `MEDIA_DIR` configurable con default `storage/media`. El destino de despliegue todavía no está definido y la carpeta tiene que poder montarse como volumen.
- **Sí:** página `/admin/medios` para subir, listar, editar alt, copiar id y borrar. El futuro editor de posts la reutiliza. Elegido por el usuario.
- **No:** script de CLI ni editor de posts completo. El primero no tiene UI y el segundo es otro spec.
- **Sí:** componentes públicos listos y demo en el mock. Se ve funcionando sin pasar las páginas a la base. Elegido por el usuario.
- **No:** conectar las páginas a la base en este spec. Trae caché y prerender y va en su propio spec.
- **Sí:** re-codificar con `sharp` a WebP de 1920 px como máximo y calidad 82. Borra EXIF y GPS, corrige la orientación y deja un solo formato. Elegido por el usuario.
- **No:** guardar el original. Deja metadatos privados y archivos pesados.
- **No:** generar varios tamaños al subir. `next/image` ya genera el `srcset`.
- **Sí:** límite de 10 MB y 40 megapíxeles. Evita bombas de descompresión y subidas que el proxy cortaría.
- **Sí:** `alt` obligatorio en `media`, que el bloque `image` puede pisar, más `caption` opcional. Accesible por defecto y ajustable por contexto. Elegido por el usuario.
- **Sí:** en tarjetas la portada es decorativa (`alt=""`). El título del post ya es el texto del enlace y leerlo dos veces molesta en lectores de pantalla.
- **Sí:** el `body` guarda `mediaId` y `db/blog.ts` lo resuelve a `BlogImage`. El id es estable y el chequeo de uso es exacto. Elegido por el usuario.
- **No:** guardar `src` y medidas en el bloque. Duplica datos y el chequeo de uso pasa a ser búsqueda de texto.
- **Sí:** dos tipos, `BlogBlock` (resuelto, lo usan los componentes) y `StoredBlogBlock` (lo guarda la base). Los componentes no saben de la base y el mock usa la forma resuelta con archivos de `public/`.
- **Sí:** bloquear el borrado de una imagen en uso, con FK `restrict` en la portada y búsqueda `@>` en el `body`. Ningún post queda con una imagen rota. Elegido por el usuario.
- **No:** borrar igual y degradar. Rompería posts publicados sin aviso.
- **Sí:** deduplicar por `sha256` del archivo original. Subir dos veces lo mismo no llena el disco, y el seed tiene una clave natural.
- **Sí:** `/media/<id>` público, con cache `immutable`. Un id nunca cambia de contenido: editar el alt no toca el archivo. Los UUID no se pueden adivinar.
- **Sí:** imágenes de demo generadas desde SVG con la paleta del sitio. No tienen problemas de licencia. Elegido por el usuario.
- **Sí:** Playwright cubre subir, duplicado, formato inválido, editar alt y borrar. Es el único flujo con archivos reales de punta a punta. Elegido por el usuario.
- **Sí:** borrar en dos pasos dentro de la tarjeta, sin `window.confirm`. Se prueba fácil y respeta el diseño.
- **Sí:** `uploaded_by` con `set null`. Borrar una cuenta no rompe posts que usan sus imágenes.

## Riesgos

| Riesgo                                                                                            | Mitigación                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Se despliega en un host serverless o con disco efímero y las imágenes desaparecen en cada deploy. | El README lo advierte y `MEDIA_DIR` es configurable para montar un volumen. Cambiar a `bytea` o S3 sería otro spec, y solo hay que reemplazar `lib/media/storage.ts`. |
| La base y `MEDIA_DIR` se respaldan por separado y quedan desalineadas: hay fila sin archivo.      | `/media/<id>` responde 404 y registra el id con `console.error`. El README pide respaldar los dos juntos.                                                             |
| `sharp` no tiene binario para la plataforma del CI o del servidor.                                | Versión fija en `dependencies`. El paso 1 lo verifica en CI antes de seguir.                                                                                          |
| El proxy de `proxy.ts` corta el body en 10 MB y una subida grande llega truncada.                 | El límite de archivo es 10 MB y `bodySizeLimit` es 11 MB. El paso 10 prueba un archivo cercano al límite. Si hace falta, se sube `proxyClientMaxBodySize`.            |
| Una imagen maliciosa (bomba de descompresión, archivo poliglota).                                 | `limitInputPixels` en 40 MP, se detecta el formato por contenido y no por extensión, y siempre se re-codifica: nunca se sirve el archivo original.                    |
| Un `mediaId` del `body` apunta a una imagen inexistente por un insert manual.                     | `db/blog.ts` lanza un error que nombra el slug y el `mediaId`, igual que un `body` inválido en SPEC 09.                                                               |
| Los tests de base escriben archivos en el `MEDIA_DIR` real.                                       | Los tests `db` usan una carpeta temporal de `os.tmpdir()` y el e2e usa `test-results/media`.                                                                          |
| `next/image` no optimiza `/media/<id>` por la configuración de imágenes locales de Next 16.       | El paso 3 y el 8 lo verifican en `npm run dev` y en `build`. Si hace falta, se agrega `images.localPatterns` con `/media/**` y las rutas de `public/` ya usadas.      |

## Qué **no** incluye este spec

- Etiquetas.
- Páginas del blog leyendo de la base.
- Editor de posts y selector de imágenes.
- Varios tamaños, recorte o edición de imágenes.
- Paginación y búsqueda de medios.
- S3, MinIO, CDN o cualquier servicio de terceros.
- Imágenes en comentarios o perfiles, galerías, GIF, SVG y video.
- Limpieza de archivos huérfanos.

Cada uno de estos, si llega, va en su propio spec.
