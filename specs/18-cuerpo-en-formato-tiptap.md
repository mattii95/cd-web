# SPEC 18 — Cuerpo de los artículos en formato Tiptap

> **Estado:** Aprobado
> **Depende de:** SPEC 09, SPEC 10, SPEC 13
> **Fecha:** 2026-11-17
> **Objetivo:** Que `post.body` guarde un documento JSON de Tiptap (párrafos, H2, H3, listas, citas, Consejo, En resumen, imágenes, negrita, cursiva y enlaces), con los posts existentes convertidos por una migración y el blog público renderizándolo sin cambios visibles en los artículos actuales.

## Por qué existe este spec

El próximo paso del CMS es el editor de artículos (SPEC 19), y se decidió que sea un WYSIWYG con Tiptap que guarde su propio JSON, como el artboard "Editor de artículo" del canvas [CMS Courroux Digital](https://claude.ai/artifact/QnCCtdB9JaPEQ7nf84dVgA) (`Editor.dc.html`), que tiene barra con H2, H3, negrita y cursiva.

Hoy `post.body` es una lista plana de bloques (`p`, `h2`, `tip`, `summary`, `image`) sin marcas en línea. Cambiar ese formato toca la base, el seed, el blog público y Medios. Hacerlo junto con el editor daría un spec que toca tres áreas y no se puede verificar por partes. Por eso este spec **solo cambia el formato**: cuando termina, el blog se ve igual y ya sabe renderizar todo lo que el editor va a poder escribir. El editor, la vista previa y el resto del panel lateral van en specs propios.

Este spec **no instala Tiptap**. Define el formato con los mismos nombres de nodos y marcas que usa Tiptap (`doc`, `paragraph`, `heading`, `bulletList`…), lo valida con Zod y lo renderiza con un componente propio. SPEC 19 configura las extensiones para que produzcan exactamente este formato.

**Referencias:**

- `db/blog-body.ts` (`blogBodySchema`, `StoredBlogBlock`), `db/blog.ts` (`resolveBody`, `getPublishedPostBySlug`), `db/media.ts` (`getUsageByMedia`), `db/seed/blog.ts` (`toStored`), `db/seed/blog-data.ts`.
- `components/blog/article-body.tsx`, `components/blog/article-toc.tsx`, `app/(site)/blog/[slug]/page.tsx`.
- Documentación de Tiptap: forma de `editor.getJSON()` y nombres de nodos y marcas de StarterKit y Link.
- Documentación de Drizzle: migraciones custom (`drizzle-kit generate --custom`).

## Alcance

**Incluye:**

- **Formato nuevo de `post.body`:** un `BlogDoc` (`{ type: "doc", content: [...] }`) con los nodos y marcas del modelo de datos.
  - Nodos de bloque: `paragraph`, `heading` (niveles 2 y 3), `bulletList`, `orderedList`, `listItem`, `blockquote`, `tip`, `summary`, `image`.
  - Nodos en línea: `text` y `hardBreak`.
  - Marcas: `bold`, `italic`, `link`.
  - `image` solo puede ir en la raíz del documento, no dentro de listas ni citas.
  - `tip` y `summary` contienen texto en línea (con marcas y `hardBreak`), no párrafos.
  - `link.href` admite `http://`, `https://` y rutas internas que empiezan con `/` (no `//`). Cualquier otro esquema (`javascript:`, `mailto:`, `data:`…) se rechaza.
  - Atributos que Zod no conoce (por ejemplo `target`, `rel` o `class` de Tiptap en `link`) se descartan al validar.
  - Un `text` vacío, un tipo de nodo o marca desconocido, un `heading` de nivel distinto de 2 o 3, o una `image` anidada hacen fallar la validación.
  - `paragraph` puede no tener `content` (párrafo vacío de Tiptap).
- **`db/blog-body.ts`** (sin `server-only`), reescrito:
  - Tipos `BlogDoc`, `BlogBlockNode`, `BlogInline`, `BlogMark` y `ResolvedBlogDoc`.
  - `blogBodySchema: z.ZodType<BlogDoc>` (recursivo con `z.lazy` para listas anidadas).
  - `blocksToDoc(blocks)`: convierte el formato viejo al nuevo. La usa el seed y es la referencia que la migración SQL tiene que igualar.
  - `docHeadings(doc)`: devuelve los H2 en orden como `{ id: "s1", text }`, con `text` en texto plano.
  - Se eliminan `StoredBlogBlock` y el esquema de bloques.
- **Migración `db/migrations/0005_cuerpo_tiptap.sql`**, generada con `npm run db:generate -- --custom --name cuerpo_tiptap`:
  - Convierte en el lugar cada `post.body` que sea un array (`jsonb_typeof(body) = 'array'`) a un `doc`, con este mapeo:

    | Bloque viejo                                 | Nodo nuevo                                                                    |
    | -------------------------------------------- | ----------------------------------------------------------------------------- |
    | `{ type: "p", text }`                        | `{ type: "paragraph", content: [{ type: "text", text }] }`                    |
    | `{ type: "h2", id, text }`                   | `{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] }` |
    | `{ type: "tip", text }`                      | `{ type: "tip", content: [{ type: "text", text }] }`                          |
    | `{ type: "summary", text }`                  | `{ type: "summary", content: [{ type: "text", text }] }`                      |
    | `{ type: "image", mediaId, alt?, caption? }` | `{ type: "image", attrs: { mediaId, alt, caption } }` (`null` si falta)       |

  - Conserva el orden de los bloques. El `id` del `h2` se descarta: el ancla se calcula al renderizar.
  - Un `body` que ya es objeto no se toca, así que correrla dos veces da el mismo resultado.
  - No cambia el tipo de la columna (sigue `jsonb`) ni ninguna otra tabla.

- **Lectura (`db/blog.ts`):**
  - `getPublishedPostBySlug` valida con el nuevo `blogBodySchema`. Un `body` inválido sigue lanzando un error que nombra el slug.
  - `resolveBody` recorre la raíz del doc y cambia cada `image` por un nodo con la imagen resuelta (`src`, `width`, `height`, `alt` del nodo o, si es `null`, el de Medios). Un `mediaId` inexistente sigue lanzando un error que nombra el slug y el id.
  - `PostDetail.body` pasa a `ResolvedBlogDoc`.
- **Medios en uso (`db/media.ts`):** `getUsageByMedia` busca imágenes con `jsonb_array_elements(p.body->'content')` en lugar de `jsonb_array_elements(p.body)`. Una imagen usada en un cuerpo sigue sin poder borrarse.
- **Seed (`db/seed/blog.ts`):** los datos mock de `db/seed/blog-data.ts` siguen en el formato de bloques (`BlogBlock` de `lib/blog-posts.ts`). El seed cambia `image.src` por el `mediaId` como hoy y después aplica `blocksToDoc`; guarda el resultado validado con `blogBodySchema`.
- **Render del blog (`components/blog/article-body.tsx`, servidor):**
  - Recibe `ResolvedBlogDoc` y lo recorre de forma recursiva, devolviendo componentes de React. Sin `dangerouslySetInnerHTML` y sin dependencias de Tiptap.
  - `heading` nivel 2: `<h2 id="sN">` con el número `01`, `02`… como hoy. `N` es el orden del H2 en el documento, empezando en 1.
  - `heading` nivel 3: `<h3>` sin número ni `id`, con estilo propio más chico que el H2.
  - `paragraph`, `tip`, `summary` e `image`: mismo HTML y estilos que hoy. Un `paragraph` sin contenido no se renderiza.
  - `bulletList` → `<ul>`, `orderedList` → `<ol>` (con `start` si es distinto de 1), `listItem` → `<li>`, `blockquote` → `<blockquote>`, `hardBreak` → `<br>`.
  - `bold` → `<strong>`, `italic` → `<em>`, `link` → `<a>`. Los enlaces externos (`http(s)://`) llevan `target="_blank"` y `rel="noopener noreferrer"`; los internos usan `next/link`.
  - Estilos de H3, listas, citas y enlaces hechos con `/frontend-design`, siguiendo la tipografía y los colores del artículo, con contraste 4.5:1.
- **Índice (`components/blog/article-toc.tsx`):** recibe `ResolvedBlogDoc` y usa `docHeadings`. Solo lista H2, con las mismas anclas `#s1`, `#s2`… que hoy. El texto del índice es texto plano (sin marcas).
- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `__tests__/server/blog-body.test.ts`, reescrito.
  - Vitest `db`: `__tests__/db/cuerpo-tiptap-migration.test.ts`, nuevo. `blog-queries.test.ts`, `blog-seed.test.ts` y `media.test.ts` se ajustan al formato nuevo.
  - Vitest `client`: `__tests__/client/article-body.test.tsx`, nuevo.
  - Playwright: `blog.spec.ts` pasa sin cambios.

**Fuera de alcance (para specs futuros):**

- El editor de artículos con Tiptap, "Nuevo artículo", "Editar" y las rutas `/admin/articles/new` y `/admin/articles/{id}/edit` (SPEC 19).
- Instalar `@tiptap/*`.
- Portada desde Medios, etiquetas, slug y validación de borrador en el editor (SPEC 19).
- Descripción SEO con su columna y preview de Google.
- Vista previa de borradores.
- Calcular el tiempo de lectura a partir del cuerpo: `reading_minutes` sigue guardado como hoy.
- H3 en el índice, imágenes dentro de listas o citas, y marcas como subrayado, tachado o código.
- Tablas, videos, embeds y bloques de código.
- Revertir la migración al formato de bloques.

## Modelo de datos

No hay tablas ni columnas nuevas. Cambia el contenido de `post.body` (sigue `jsonb NOT NULL`) y su tipo en Drizzle: `body: jsonb().$type<BlogDoc>().notNull()`.

```ts
// db/blog-body.ts (sin "server-only")
import type { BlogBlock, BlogImage } from "@/lib/blog-posts";

export type BlogMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string } }; // http(s):// o "/ruta"

export type BlogInline =
  | { type: "text"; text: string; marks?: BlogMark[] } // text no vacío
  | { type: "hardBreak" };

export type BlogParagraph = { type: "paragraph"; content?: BlogInline[] };

export type BlogNestedNode = // lo que puede ir dentro de listas y citas
  | BlogParagraph
  | { type: "bulletList"; content: BlogListItem[] }
  | { type: "orderedList"; attrs?: { start?: number }; content: BlogListItem[] }
  | { type: "blockquote"; content: BlogNestedNode[] };

export type BlogListItem = { type: "listItem"; content: BlogNestedNode[] }; // empieza con paragraph

export type BlogBlockNode = // raíz del doc
  | BlogNestedNode
  | { type: "heading"; attrs: { level: 2 | 3 }; content: BlogInline[] }
  | { type: "tip"; content: BlogInline[] }
  | { type: "summary"; content: BlogInline[] }
  | {
      type: "image";
      attrs: { mediaId: string; alt: string | null; caption: string | null };
    };

export type BlogDoc = { type: "doc"; content: BlogBlockNode[] };

// Lo que recibe el blog: las imágenes ya resueltas.
export type ResolvedImageNode = {
  type: "image";
  attrs: { image: BlogImage; caption: string | null };
};
export type ResolvedBlogDoc = {
  type: "doc";
  content: (Exclude<BlogBlockNode, { type: "image" }> | ResolvedImageNode)[];
};

export const blogBodySchema: z.ZodType<BlogDoc>;

// Formato viejo (con mediaId ya puesto) → doc. Referencia de la migración SQL.
export type LegacyBlock =
  | Exclude<BlogBlock, { type: "image" }>
  | { type: "image"; mediaId: string; alt?: string; caption?: string };
export function blocksToDoc(blocks: LegacyBlock[]): BlogDoc;

// H2 en orden: [{ id: "s1", text: "…" }, …]. Acepta BlogDoc o ResolvedBlogDoc.
export function docHeadings(
  doc: BlogDoc | ResolvedBlogDoc,
): { id: string; text: string }[];

// db/blog.ts
export type PostDetail = PostSummary & { body: ResolvedBlogDoc; cta: string };
```

Archivos que cambian: `db/blog-body.ts`, `db/schema/blog.ts` (tipo de `body`), `db/blog.ts`, `db/media.ts`, `db/seed/blog.ts`, `components/blog/article-body.tsx`, `components/blog/article-toc.tsx`, `__tests__/server/blog-body.test.ts`, `__tests__/db/blog-queries.test.ts`, `__tests__/db/blog-seed.test.ts`, `__tests__/db/media.test.ts`. Archivos nuevos: `db/migrations/0005_cuerpo_tiptap.sql` (más su snapshot y entrada en `meta/_journal.json`), `__tests__/db/cuerpo-tiptap-migration.test.ts`, `__tests__/client/article-body.test.tsx`.

Convenciones:

- Los nombres de nodos, marcas y atributos son los de Tiptap. Los nodos propios son `tip`, `summary` e `image` (con `mediaId`, no `src`).
- El `body` guarda referencias a Medios, nunca URLs. La URL se resuelve al leer.
- Las anclas de los H2 no se guardan: siempre son `s1`, `s2`… por orden.
- `BlogBlock` de `lib/blog-posts.ts` queda solo como formato de los datos mock del seed.

## Plan de implementación

1. **Formato y validación.** En `db/blog-body.ts`, sumar los tipos nuevos, `blogBodySchema` nuevo (como `blogDocSchema` mientras convive con el viejo), `blocksToDoc` y `docHeadings`. Reescribir `blog-body.test.ts`. Prueba: `npm run test:run` pasa.
2. **Render.** `ArticleBody` y `ArticleToc` reciben `ResolvedBlogDoc`. `resolveBody` resuelve imágenes del doc. Mientras no exista la migración, `getPublishedPostBySlug` valida con el esquema viejo y aplica `blocksToDoc` antes de resolver. Estilos de H3, listas, citas y enlaces con `/frontend-design`. `article-body.test.tsx` nuevo. Prueba: `npm run test:run`, `npm run test:db` y `blog.spec.ts` pasan, y los artículos del seed se ven igual que antes.
3. **Migración y lectura definitiva.** `0005_cuerpo_tiptap.sql`, tipo de `body` en `db/schema/blog.ts`, seed con `blocksToDoc`, `getPublishedPostBySlug` valida el doc directamente, `getUsageByMedia` con `body->'content'`. Se borran el esquema viejo, `StoredBlogBlock` y la conversión temporal del paso 2. `cuerpo-tiptap-migration.test.ts` nuevo; ajustar `blog-queries`, `blog-seed` y `media`. Prueba: `npm run db:migrate` sobre una base con el seed viejo convierte los 8 posts, y `npm run test:db` pasa.
4. **Cierre.** `npm run lint`, `npx tsc --noEmit`, `npm run build` sin `DATABASE_URL` y `npm run test:e2e` completo. Prueba: todos pasan y el `grep` de los criterios no devuelve nada.

## Criterios de aceptación

**General**

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa completo, con `blog.spec.ts` sin cambios.
- [ ] `package.json` no tiene dependencias `@tiptap/*`.
- [ ] `grep -rn "StoredBlogBlock\|jsonb_array_elements(p.body)" app components db lib __tests__` no devuelve nada.

**Formato (`blog-body.test.ts`)**

- [ ] `blogBodySchema` acepta `blocksToDoc` de los cuerpos de los 8 posts mock.
- [ ] Acepta un doc con H3, listas con viñetas y numeradas (con `start: 3`), una lista anidada dentro de un `listItem`, una cita con dos párrafos, `hardBreak`, un párrafo vacío y texto con `bold`, `italic` y `link`.
- [ ] Rechaza: un nodo de tipo desconocido, una marca desconocida, un `heading` de nivel 1 y uno de nivel 4, un `text` vacío, una `image` dentro de un `listItem` o de un `blockquote`, un `tip` con un `paragraph` adentro, un `mediaId` que no es UUID, y un array (formato viejo).
- [ ] Rechaza un `link` con `href` `javascript:alert(1)`, `mailto:a@b.c`, `//evil.com` y `data:text/html,x`; acepta `https://ejemplo.com` y `/servicios`.
- [ ] Un `link` con `target` y `rel` se acepta y el resultado parseado no los incluye.
- [ ] `blocksToDoc` convierte cada uno de los cinco tipos de bloque según la tabla del alcance y conserva el orden; una `image` sin `alt` ni `caption` queda con ambos en `null`.
- [ ] `docHeadings` de un doc con H2, H3, H2 devuelve dos entradas con `id` `s1` y `s2`; el `text` de un H2 con negrita y enlace es el texto plano concatenado.

**Migración y lectura (`db`)**

- [ ] En `cuerpo-tiptap-migration.test.ts`, un post con `body` en formato viejo (los cinco tipos de bloque) queda, después de correr el SQL de `0005_cuerpo_tiptap.sql`, igual a `blocksToDoc` del mismo array.
- [ ] Correr el SQL dos veces deja el mismo `body`; un `body` que ya es doc no cambia.
- [ ] `getPublishedPostBySlug` devuelve el `body` como `ResolvedBlogDoc`, con las imágenes resueltas a `src`, `width` y `height` de Medios y el `alt` del nodo o, si es `null`, el de Medios.
- [ ] `getPublishedPostBySlug` sobre un post con `body` inválido lanza un error que nombra el slug; con un `mediaId` inexistente, uno que nombra el slug y el id.
- [ ] `blog-seed.test.ts`: después del seed, los 8 `body` pasan `blogBodySchema` y correrlo dos veces deja los mismos `body`.
- [ ] `media.test.ts`: una imagen usada en la raíz del cuerpo de un post aparece en su uso y `deleteMedia` lanza `MediaInUseError`.

**Render (`article-body.test.tsx`)**

- [ ] Dos H2 se renderizan como `<h2 id="s1">` y `<h2 id="s2">` con `01` y `02`; un H3 entre ellos es un `<h3>` sin `id` ni número.
- [ ] `bold`, `italic` y `hardBreak` producen `<strong>`, `<em>` y `<br>`.
- [ ] Un enlace a `https://ejemplo.com` tiene `target="_blank"` y `rel="noopener noreferrer"`; uno a `/servicios` no tiene `target`.
- [ ] Listas con viñetas, numeradas con `start="3"`, anidadas y citas producen `<ul>`, `<ol start="3">`, `<li>` anidado y `<blockquote>`.
- [ ] Un párrafo vacío no genera `<p>`.
- [ ] `tip` muestra "Consejo" y `summary` "En resumen", con el texto y sus marcas.
- [ ] `ArticleToc` lista solo los H2, con `href="#s1"`, `#s2`, y sin H3.

**Blog público (E2E y manual)**

- [ ] `blog.spec.ts` pasa sin cambios.
- [ ] Después de `npm run db:migrate` sobre la base con el seed viejo, `/blog/senales-sistema-a-medida` muestra el mismo índice, las mismas anclas `#s1`, `#s2` y las mismas imágenes que antes de migrar.
- [ ] H3, listas, citas y enlaces cumplen 4.5:1 de contraste y siguen la tipografía del artículo (revisado con `/frontend-design`).

## Decisiones

- **Sí:** el body pasa a guardar el JSON de Tiptap. Elegido por el usuario.
- **No:** editor Tiptap limitado a los bloques actuales. No permite H3, marcas ni listas como el canvas.
- **No:** sumar H3 y marcas al formato de bloques propio. Es inventar otro formato de texto enriquecido que Tiptap igual tendría que convertir.
- **Sí:** el cambio de formato va en un spec previo al editor; el editor es SPEC 19 y la vista previa, otro spec. Elegido por el usuario.
- **No:** formato y editor en un mismo spec. Toca base, blog público y panel, y no se puede verificar por partes.
- **Sí:** nodos y marcas admitidos: párrafo, H2, H3, listas con viñetas y numeradas, cita, Consejo, En resumen, imagen, negrita, cursiva y enlaces. Elegido por el usuario.
- **Sí:** los posts existentes se convierten con una migración SQL de Drizzle que corre sola con `db:migrate`. Elegido por el usuario.
- **No:** script TS manual. Hay que acordarse de correrlo en cada entorno.
- **No:** convertir solo el seed. No sirve si hay posts reales fuera del seed.
- **Sí:** `blocksToDoc` en TS es la referencia de la conversión, y un test compara la salida del SQL con ella. Así el seed y la migración no divergen.
- **Sí:** renderer propio a React. Elegido por el usuario.
- **No:** `@tiptap/static-renderer`. Mete Tiptap en el blog público y acopla el render a su versión.
- **Sí:** este spec no instala Tiptap. Valida con Zod y usa los nombres de Tiptap para que SPEC 19 solo tenga que configurar las extensiones.
- **Sí:** las anclas de los H2 se calculan al renderizar (`s1`, `s2`…) y el índice solo lista H2. Las anclas actuales no cambian. Elegido por el usuario.
- **No:** anclas por slug del texto o guardadas en el nodo. Cambian las existentes o cargan al editor con mantenerlas únicas.
- **Sí:** Consejo y En resumen contienen texto en línea con marcas, no párrafos. Mapea directo a los datos actuales y no cambia el diseño del recuadro. Elegido por el usuario.
- **Sí:** las imágenes solo van en la raíz del doc y se admite `hardBreak`. La consulta de Medios en uso sigue siendo un solo nivel. Elegido por el usuario.
- **Sí:** los enlaces solo admiten `http(s)://` y rutas internas `/…`; los externos abren en otra pestaña con `rel="noopener noreferrer"`. Cierra la puerta a `javascript:` y similares.
- **Sí:** los atributos extra de Tiptap (`target`, `rel`, `class`) se descartan al validar; el renderer decide cómo se abre cada enlace.
- **Sí:** el `alt` de una imagen del cuerpo es `null` si no se sobrescribe, y cae al de Medios al leer, como hoy.
- **Sí:** los datos mock del seed siguen en formato de bloques y se convierten con `blocksToDoc`. No hace falta reescribir los 8 cuerpos a mano.
- **Sí:** `reading_minutes` sigue guardado; calcularlo desde el cuerpo queda para el editor.
- **Sí:** el paso 2 lee el formato viejo y lo convierte al vuelo, para que el blog funcione antes de la migración. Se borra en el paso 3.

## Riesgos

| Riesgo                                                                                                        | Mitigación                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| La migración SQL y `blocksToDoc` producen JSON distinto y el seed y la base migrada divergen.                 | `cuerpo-tiptap-migration.test.ts` compara la salida del SQL con `blocksToDoc` para los cinco tipos de bloque.                                     |
| La migración no se puede revertir y un error deja posts ilegibles.                                            | Es idempotente, solo toca `body` que son arrays, y el test la corre sobre todos los tipos. Hacer backup de la base antes de migrar en producción. |
| Desplegar el código antes de migrar (o al revés) rompe `/blog/[slug]` porque el `body` no pasa la validación. | `db:migrate` corre antes de levantar la app nueva. El error de validación nombra el slug para detectarlo rápido.                                  |
| Un enlace con `javascript:` o un HTML inyectado llega al blog público.                                        | Zod solo admite `http(s)://` y `/…`; el renderer arma elementos de React sin `dangerouslySetInnerHTML`. Tests de rechazo.                         |
| Una imagen usada en el cuerpo se puede borrar desde Medios porque la consulta de uso sigue mirando el array.  | `getUsageByMedia` usa `body->'content'`; `media.test.ts` lo verifica y el `grep` de los criterios lo repite.                                      |
| Las anclas `#s1`, `#s2` cambian y se rompen enlaces compartidos al índice.                                    | Se calculan por orden de H2 igual que hoy; un test de render y la verificación manual de `senales-sistema-a-medida` lo cubren.                    |
| SPEC 19 configura Tiptap con nombres o atributos distintos y lo que guarda el editor no valida.               | Este spec fija los nombres de Tiptap en el modelo de datos; SPEC 19 valida con el mismo `blogBodySchema` antes de guardar.                        |
| Listas anidadas muy profundas hacen lento el render o la validación.                                          | Esquema recursivo acotado a lo que produce Tiptap; el editor limita la anidación en SPEC 19 si hace falta.                                        |

## Qué **no** incluye este spec

- Editor de artículos, "Nuevo artículo", "Editar" y Tiptap instalado.
- Portada, etiquetas y slug editables.
- Descripción SEO y vista previa.
- Tiempo de lectura calculado.
- H3 en el índice, imágenes anidadas y marcas extra.
- Revertir la migración.

Cada uno de estos, si llega, va en su propio spec.
