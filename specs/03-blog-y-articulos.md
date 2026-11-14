# SPEC 03 — Blog y artículos

> **Estado:** Implementado
> **Revisión:** 2026-11-14. El diseño sumó 'Ingresar' en el header y valoraciones y comentarios en el artículo. Los pasos 10 a 13 y sus criterios son nuevos y están sin implementar.
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-14
> **Objetivo:** Maquetar el índice `/blog` y la plantilla `/blog/[slug]` según los artboards `Blog` y `Articulo` del diseño de Claude Design, con 8 artículos mock en `lib/blog-posts.ts`.

## Por qué existe este spec

SPEC 01 dejó las cards de blog de la home, el footer y "Ver todos los artículos" apuntando a `/blog` y `/blog/[slug]`, que hoy dan 404.
Este spec es **solo diseño**: los artículos son datos mock tipados, escritos a mano en el repo.
Un spec posterior hace el blog dinámico (CMS, base de datos o archivos) sin cambiar las plantillas.
Por eso el cuerpo de cada artículo se modela como bloques tipados, parecidos a lo que devolvería un CMS.

**Fuente del diseño:** el canvas https://claude.ai/artifact/C2LN5ysoCWnCeBgrekb5bw, artboards `project/Blog.dc.html` y `project/Articulo.dc.html`.
Se leen con la herramienta Artifact (`action: "read"`, `path: "project/Blog.dc.html"`).
Son la referencia de layout, espaciados, colores, copys, íconos y animaciones.
Ante cualquier duda visual, gana el artboard, salvo en lo que se excluye abajo.

## Alcance

**Incluye:**

- Índice `app/blog/page.tsx`, con las secciones en el orden del artboard `Blog`:
  - **Hero** oscuro: `// blog`, título "Tecnología explicada para hacer crecer tu negocio", bajada, buscador (solo visual) y filtros por categoría.
  - **Artículo destacado**: card grande con el post más reciente, badge "Destacado", categoría, minutos, título, bajada, autor y fecha.
  - **Grilla** con los demás artículos: miniatura con ícono y `// {categoryTag}`, categoría, minutos, título, bajada y "Leer artículo".
- Filtros funcionales: "Todos", "Desarrollo web", "Sistemas", "SaaS" e "IA". Filtran la lista en el cliente. El destacado solo se ve con "Todos" o con su categoría.
- Buscador **solo visual**: el input se muestra como en el artboard, pero no filtra.
- Artículo `app/blog/[slug]/page.tsx` con `generateStaticParams` para los 8 slugs, con las secciones en el orden del artboard `Articulo`:
  - **Hero** oscuro: breadcrumb "Blog / {categoría}", `h1`, bajada, autor con cargo, fecha, minutos de lectura y `// {categoryTag}`. Si el artículo tiene valoraciones, suma la línea "★ 4,6 (24 valoraciones · 4 comentarios)".
  - **Cuerpo**: índice `// en este artículo` (sticky en desktop) con links a cada `h2` (y a "Valoraciones y comentarios" si hay), botón "Compartir", y los bloques del cuerpo (párrafos, `h2` numerados `01`, `02`…, recuadro "Consejo" y recuadro "En resumen").
  - **Caja del autor**: iniciales, nombre y bio.
  - **Valoraciones y comentarios** (`// comunidad`, ancla `#valoraciones`), solo en artículos con valoraciones mock: promedio en estrellas, "{n} valoraciones" y distribución del 5 al 1 con barras; bloque "Iniciá sesión para comentar y puntuar" con "Ingresar" y "Crear cuenta"; "{n} comentarios" con selector "Ordenar por" (Más recientes, Mejor puntuados, Más votados); cada comentario con avatar de iniciales, nombre, estrellas, tiempo, texto, "Útil · {n}" y, si tiene, la respuesta del autor con badge "Autor".
  - **CTA**: texto propio del artículo y botón "Ver {título del servicio}" a `/servicios/{slug}`.
  - **Seguí leyendo**: 3 cards y el link "Ver todos los artículos" a `/blog`.
- Un slug que no existe muestra la página 404 con `notFound()`, como en SPEC 02.
- Botón "Compartir" funcional: usa `navigator.share` si existe y, si no, copia la URL y muestra "Link copiado".
- 8 artículos mock: los títulos, categorías, minutos y bajadas del artboard `Blog`. El de sistemas lleva el cuerpo completo del artboard `Articulo`. Los otros 7 llevan un cuerpo mock corto, con 2 o 3 `h2`, un "Consejo" y un "En resumen".
- Autor fijo mock: Matías Courroux, "Fundador de Courroux Digital", con una bio de una línea. Se muestra con un avatar con las iniciales "MC".
- Fechas mock con `publishedAt`, en formato "10 nov 2026" (es-AR).
- Hero oscuro y secciones de abajo claras, con los tokens claros de SPEC 02.
- Las animaciones del artboard, reutilizando las clases `fx-*` de `app/globals.css`. Se desactivan con `prefers-reduced-motion: reduce`.
- Header y footer compartidos. El link "Blog" del header (desktop y mobile) pasa de `/#blog` a `/blog`. El header suma el botón "Ingresar" del diseño (desktop y mobile), **solo visual**: no navega ni abre nada.
- Valoraciones y comentarios **solo con datos mock**: el artículo `senales-sistema-a-medida` lleva 24 valoraciones (5★: 18, 4★: 4, 3★: 1, 2★: 1, 1★: 0) y los 4 comentarios del artboard. Los otros 7 artículos no tienen valoraciones, así que no muestran la línea del hero, la entrada del índice ni la sección.
- Interacciones locales en la sección de comentarios: cambiar el orden y marcar o desmarcar "Útil" (suma o resta 1 al contador). No se guardan.
- La sección blog de la home muestra los 3 artículos más recientes. Con las fechas mock son los mismos 3 de hoy, así que la home se ve igual.
- SEO básico con `generateMetadata`, como en SPEC 02: `title`, `description`, `alternates.canonical` y `openGraph`. En el índice, la bajada del hero es la description. En el artículo, la description es su `excerpt`, y `openGraph.type` es `"article"` con `publishedTime`.

**Fuera de alcance (para specs futuros):**

- Blog dinámico (CMS, base de datos, MDX o archivos markdown): spec propio.
- Búsqueda funcional.
- Newsletter: el bloque "Recibí los nuevos artículos en tu email" no se muestra.
- Filtros en la URL (`?categoria=`), paginación y páginas por categoría.
- Varios autores, fotos de autor y páginas de autor.
- JSON-LD (`BlogPosting`), feed RSS, `sitemap.ts` y `robots.ts`.
- Imágenes de portada e imágenes Open Graph por artículo (se usa el logo de SPEC 01).
- Cuentas, login, registro y sesión: "Ingresar", "Crear cuenta" y "Responder" son visuales. Solo se muestra el estado sin sesión.
- Publicar comentarios y puntuar: no se incluye el formulario del estado con sesión (puntuación, comentario y "Publicar comentario").
- "Cargar más comentarios": el mock tiene 4 comentarios, así que el botón no se muestra.
- Backend de valoraciones y comentarios, moderación y notificaciones.
- Reacciones distintas de "Útil" y contador de lecturas.
- Barra de progreso de lectura del artboard `Articulo`.

## Modelo de datos

```ts
// lib/blog-posts.ts — reemplaza el tipo BlogPost de SPEC 01
export type BlogCategoryTag = "desarrollo-web" | "sistemas" | "saas" | "ia";

export type BlogCategory = {
  tag: BlogCategoryTag; // se muestra como "// sistemas"
  label: string; // "Sistemas", "Inteligencia artificial" (badge de la card)
  filterLabel: string; // "Sistemas", "IA" (botón de filtro)
  service: ServiceSlug; // servicio del CTA del artículo
};

export const blogCategories: BlogCategory[]; // en el orden de los filtros: web, sistemas, saas, ia

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; id: string; text: string } // id: "s1", "s2"… → ancla y entrada del índice
  | { type: "tip"; text: string } // recuadro "Consejo"
  | { type: "summary"; text: string }; // recuadro "En resumen"

export type BlogRating = 1 | 2 | 3 | 4 | 5;

export type BlogComment = {
  id: string;
  name: string;
  initials: string;
  rating: BlogRating;
  time: string; // texto mock: "Hace 2 días"
  likes: number; // "Útil · 12"
  text: string;
  reply?: { text: string; time: string }; // respuesta del autor
};

export type BlogReviews = {
  distribution: Record<BlogRating, number>; // cantidad de valoraciones por estrella
  comments: BlogComment[]; // ordenados del más reciente al más antiguo
};

export type BlogPost = {
  slug: string;
  category: BlogCategoryTag;
  readingMinutes: number;
  publishedAt: string; // "2026-11-10" (ISO, sin hora)
  title: string;
  excerpt: string; // bajada de la card, del hero y meta description
  body: BlogBlock[];
  cta: string; // "¿Tu empresa muestra estas señales? Contanos cómo trabajan hoy…"
  reviews?: BlogReviews; // solo senales-sistema-a-medida
};

export type BlogAuthor = {
  name: string;
  role: string;
  bio: string;
  initials: string;
};
export const blogAuthor: BlogAuthor; // Matías Courroux · Fundador de Courroux Digital · "MC"

export const blogPosts: BlogPost[]; // los 8, ordenados por publishedAt descendente

export function getPost(slug: string): BlogPost | undefined;
export function getCategory(tag: BlogCategoryTag): BlogCategory;
export function getRecentPosts(n: number): BlogPost[];
export function getRelatedPosts(post: BlogPost, n: number): BlogPost[];
export function formatPostDate(iso: string): string; // "10 nov 2026"
export function getRatingSummary(r: BlogReviews): {
  average: number;
  total: number;
}; // 4,6 y 24 para el mock
```

Artículos mock (en orden de fecha):

| Slug                                | Categoría        | Min | `publishedAt` |
| ----------------------------------- | ---------------- | --- | ------------- |
| `senales-sistema-a-medida`          | `sistemas`       | 6   | 2026-11-10    |
| `chatbots-ia-atencion-al-cliente`   | `ia`             | 5   | 2026-11-03    |
| `landing-page-o-sitio-web-completo` | `desarrollo-web` | 4   | 2026-10-27    |
| `validar-idea-saas`                 | `saas`           | 7   | 2026-10-20    |
| `velocidad-web-ventas`              | `desarrollo-web` | 5   | 2026-10-13    |
| `automatizaciones-ia-pymes`         | `ia`             | 6   | 2026-10-06    |
| `excel-o-sistema-de-gestion`        | `sistemas`       | 5   | 2026-09-29    |
| `mvp-primera-version`               | `saas`           | 6   | 2026-09-22    |

Convenciones:

- Los 3 slugs de SPEC 01 no cambian, así los links de la home siguen funcionando.
- El destacado es `blogPosts[0]` (el más reciente). No hay campo `featured`.
- Los `h2` se numeran por su posición entre los `h2` del cuerpo (`01`, `02`…), no por un campo.
- `getRelatedPosts` devuelve `n` posts sin el actual: primero los de la misma categoría y después los más recientes.
- `formatPostDate` usa `Intl.DateTimeFormat("es-AR", { timeZone: "UTC" })` sobre la fecha fija. No usa `new Date()` sin argumentos, así que el prerender no se rompe con `cacheComponents`.
- El ícono de la miniatura sale de la categoría: `desarrollo-web` → `Code`, `sistemas` → `Layers`, `saas` → `Cloud`, `ia` → `Sparkles`.
- El promedio se muestra con una decimal y coma ("4,6"). Se calcula con la distribución, no se guarda.
- Los órdenes de la lista: "Más recientes" es el orden del array; "Mejor puntuados" es por estrellas descendente y, a igualdad, por el orden del array; "Más votados" es por "Útil" descendente (con el voto local incluido).
- Los textos de los 7 cuerpos mock son placeholders. Se reemplazan cuando llegue el spec dinámico.

## Plan de implementación

1. **Datos.** Reescribir `lib/blog-posts.ts` con el modelo de arriba: categorías, autor, los 8 posts y las funciones auxiliares. El cuerpo de `senales-sistema-a-medida` se copia textual del artboard `Articulo`. Adaptar `components/home/blog-preview.tsx` para usar `getRecentPosts(3)` y `getCategory`. Prueba: `npm run build` compila y la home se ve igual.
2. **Miniatura y card compartidas.** Extraer la miniatura de `blog-preview.tsx` a `components/blog/post-thumb.tsx` y la card a `components/blog/post-card.tsx`. Usarlas en la home. Prueba: la home se ve igual.
3. **Header.** Cambiar en `components/site-header.tsx` el link "Blog" de `/#blog` a `/blog`. Revisar que `components/mobile-menu.tsx` use la misma lista.
4. **Índice: ruta y hero.** Crear `app/blog/page.tsx` con `metadata` y `components/blog/blog-hero.tsx` (título, bajada y buscador visual). Prueba: `/blog` carga con el header, el hero y el footer.
5. **Índice: lista con filtros.** Crear `components/blog/post-list.tsx` (client component) con los botones de filtro (`aria-pressed`), la card destacada `components/blog/featured-post.tsx` y la grilla de `post-card`. Prueba: "SaaS" deja 2 cards y oculta el destacado.
6. **Artículo: ruta y hero.** Crear `app/blog/[slug]/page.tsx` con `generateStaticParams`, `notFound()` y `generateMetadata`, y `components/blog/article-hero.tsx`. Prueba: `/blog/senales-sistema-a-medida` muestra el hero y `/blog/no-existe` muestra la página 404.
7. **Artículo: cuerpo.** Crear `components/blog/article-body.tsx` (renderiza los bloques y numera los `h2`) y `components/blog/article-toc.tsx` (índice con links a `#s1`…). Prueba: cada link del índice hace scroll a su `h2`.
8. **Compartir.** Crear `components/blog/share-button.tsx` (client component) con `navigator.share` y el fallback a `navigator.clipboard.writeText` + "Link copiado" durante 2 segundos.
9. **Autor, CTA y Seguí leyendo.** Crear `components/blog/author-box.tsx`, `components/blog/article-cta.tsx` y `components/blog/related-posts.tsx` (usa `getRelatedPosts(post, 3)` y `post-card`). Montarlos en la página del artículo.
10. **Header: "Ingresar".** Agregar en `components/site-header.tsx` el botón visual "Ingresar" (ícono de usuario, borde claro) antes de "Pedí tu presupuesto", y en `components/mobile-menu.tsx`. Prueba: se ve en desktop y mobile y no navega.
11. **Datos de valoraciones.** Agregar `BlogRating`, `BlogComment`, `BlogReviews`, `reviews?` en `BlogPost` y `getRatingSummary` a `lib/blog-posts.ts`, con los 4 comentarios y la distribución del artboard en `senales-sistema-a-medida`. Prueba: `getRatingSummary` da promedio 4,6 y total 24.
12. **Hero e índice.** En `components/blog/article-hero.tsx`, la línea "★ 4,6 (24 valoraciones · 4 comentarios)" si hay `reviews`. En `components/blog/article-toc.tsx`, la entrada "Valoraciones y comentarios" a `#valoraciones`. Prueba: solo el artículo de sistemas las muestra.
13. **Sección de comentarios.** Crear `components/blog/reviews-section.tsx` (client): resumen con distribución, bloque sin sesión, selector de orden, lista con "Útil" (`aria-pressed`) y respuesta del autor. Montarla entre la caja del autor y el CTA. Prueba: cambiar el orden reordena la lista y "Útil" suma y resta 1.

## Criterios de aceptación

- [x] `npm run build` termina sin errores ni warnings de tipos.
- [x] `npm run lint` termina sin errores.
- [x] El build prerenderiza `/blog` y los 8 `/blog/{slug}`.
- [x] `/blog` y los 8 artículos cargan sin errores en la consola del navegador.
- [x] `/blog/no-existe` muestra la página 404 con `noindex`.
- [ ] A 1440px de ancho, `/blog` coincide visualmente con el artboard `Blog` sin el bloque de newsletter, salvo el header.
- [ ] A 1440px de ancho, `/blog/senales-sistema-a-medida` coincide visualmente con el artboard `Articulo` sin el bloque de newsletter, salvo el header.
- [x] A 375px de ancho no hay scroll horizontal en `/blog` ni en ningún artículo.
- [x] El destacado de `/blog` es "5 señales de que tu empresa necesita un sistema a medida", y la grilla muestra los otros 7.
- [x] Al elegir "SaaS" se ven solo los 2 artículos de SaaS y no se ve el destacado. Al elegir "Sistemas" se ve el destacado y 1 card.
- [x] El filtro activo tiene `aria-pressed="true"` y los demás `false`.
- [x] Escribir en el buscador no cambia la lista.
- [x] Cada card lleva a `/blog/{slug}`.
- [x] El artículo muestra "Matías Courroux", "Fundador de Courroux Digital", la fecha en formato "10 nov 2026" y los minutos de lectura.
- [x] Los `h2` del cuerpo se numeran `01`, `02`… y cada entrada del índice hace scroll a su `h2`.
- [x] El artículo de sistemas muestra los recuadros "Consejo" y "En resumen".
- [x] En un navegador sin `navigator.share`, "Compartir" copia la URL del artículo y muestra "Link copiado".
- [x] El botón del CTA lleva a `/servicios/{slug}` del servicio de la categoría (ej.: sistemas → `/servicios/sistemas-a-medida`).
- [x] "Seguí leyendo" muestra 3 artículos, sin el actual, con los de la misma categoría primero.
- [x] El breadcrumb "Blog" lleva a `/blog`.
- [x] El link "Blog" del header (desktop y mobile) lleva a `/blog`.
- [x] La sección blog de la home sigue mostrando los mismos 3 artículos de antes, en el mismo orden.
- [x] La pestaña muestra "Blog · Courroux Digital" en el índice y "{título} · Courroux Digital" en cada artículo.
- [x] Cada página tiene `<meta name="description">` y `<link rel="canonical">` con su URL. Los artículos tienen `og:type` = `article`.
- [ ] Con `prefers-reduced-motion: reduce` emulado, `/blog` y los artículos no tienen animaciones.
- [x] El hero del artículo de sistemas muestra "★ 4,6 (24 valoraciones · 4 comentarios)". Los otros 7 artículos no muestran la línea, la entrada del índice ni la sección.
- [x] El índice del artículo de sistemas incluye "Valoraciones y comentarios" y hace scroll a `#valoraciones`.
- [x] La sección muestra el promedio "4,6", "24 valoraciones" y 5 barras con 18, 4, 1, 1 y 0.
- [x] La sección muestra "Iniciá sesión para comentar y puntuar" con "Ingresar" y "Crear cuenta", y no hay formulario de comentario.
- [x] "Más recientes" lista Lucía, Martín, Carla y Diego. "Mejor puntuados" lista Lucía, Carla, Martín y Diego. "Más votados" lista Lucía, Carla, Martín y Diego.
- [x] Marcar "Útil" en un comentario suma 1 y lo deja con `aria-pressed="true"`. Volver a marcarlo resta 1.
- [x] Los comentarios de Lucía y Diego muestran la respuesta del autor con el badge "Autor".
- [x] El header muestra "Ingresar" en desktop y mobile, y al hacer click no navega.
- [x] No aparece ningún texto "[Tu marca]", "[Nombre del autor]", "[Cargo]", "[Fecha]", "[Breve bio", "[frecuencia]", "[Tu nombre]" ni "suscribirse".

## Decisiones

- **Sí:** este spec es solo diseño, con datos mock. Separa la maqueta de la decisión de dónde vive el contenido.
- **No:** hacer el blog dinámico ahora. Va en su propio spec.
- **Sí:** cuerpo como bloques tipados en `lib/blog-posts.ts`. Sin dependencias, y la plantilla recibe la misma forma que podría devolver un CMS.
- **No:** MDX. Se eligió primero, pero si el spec dinámico usa un CMS habría que tirarlo.
- **No:** markdown con un parser. No permite componentes como "Consejo" sin inventar una convención.
- **Sí:** los 8 artículos del artboard. El índice y los filtros se ven como en el diseño.
- **No:** solo los 3 de la home. Los filtros casi no tendrían efecto.
- **Sí:** cuerpo real solo para el artículo de sistemas, y mock corto para los otros 7. Es el único texto que existe en el diseño.
- **Sí:** filtros y "Compartir" funcionales. Son baratos y sin backend.
- **No:** búsqueda funcional. Con contenido mock no aporta; el input se muestra para respetar el diseño.
- **No:** newsletter. Necesita un proveedor y la frecuencia de envío; mostrar un form que no hace nada es engañoso.
- **Sí:** filtro en estado local del componente. Con `cacheComponents`, leer `searchParams` obligaría a envolver la lista en `<Suspense>`, y no hay pedido de compartir links filtrados.
- **Sí:** autor fijo (Matías Courroux) con avatar de iniciales. No hay foto, y el modelo dinámico puede sumar varios autores después.
- **Sí:** el destacado es el post más reciente. Un campo `featured` se desincroniza; el spec dinámico puede agregarlo.
- **Sí:** "Seguí leyendo" con la misma categoría primero. Es lo más relevante para el lector.
- **Sí:** la home muestra los 3 más recientes. Con las fechas mock queda igual que hoy.
- **Sí:** `BlogCategory.service` une el artículo con su servicio. El CTA reutiliza las páginas de SPEC 02 sin repetir slugs.
- **Sí:** el link "Blog" del header va a `/blog`. Ya existe la página, y en el artboard el nav apunta al índice.
- **Sí:** header compartido, como en SPEC 02.
- **Sí:** valoraciones y comentarios como maqueta con datos mock, solo en el artículo de sistemas. Es el único con diseño completo, y así los otros 7 no inventan opiniones.
- **No:** cuentas, login ni formulario de comentario. Necesitan un backend y decidir cómo se guardan los datos; van en un spec propio.
- **Sí:** mostrar solo el estado sin sesión. El estado con sesión del artboard depende de una cuenta que no existe.
- **Sí:** orden y "Útil" en estado local. Son baratos y dejan ver el diseño; no se guardan.
- **No:** "Cargar más comentarios". Con 4 comentarios no hay nada que cargar.
- **Sí:** "Ingresar" visual en el header, porque el diseño nuevo lo trae. No lleva a ninguna página hasta que exista el login.
- **Sí:** SEO básico como en SPEC 02. JSON-LD, RSS y sitemap van con el spec dinámico o con uno de SEO.

## Riesgos

| Riesgo                                                                                                | Mitigación                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Un buscador que no filtra puede confundir a quien lo use.                                             | Es una maqueta. Si el blog se publica antes del spec dinámico, ocultar el input con una línea. |
| Los 7 cuerpos mock pueden quedar publicados como si fueran contenido real.                            | Los textos se marcan como mock en `lib/blog-posts.ts`. El spec dinámico los reemplaza.         |
| `Intl.DateTimeFormat` puede formatear distinto en el servidor y en el cliente (ej.: "nov." vs "nov"). | Formatear solo en Server Components. `post-list.tsx` recibe la fecha ya formateada como prop.  |
| `navigator.clipboard` solo funciona en contexto seguro (HTTPS o `localhost`).                         | En producción es HTTPS. Si falla, el botón muestra "No se pudo copiar" y no rompe la página.   |
| El índice sticky puede tapar contenido o quedar muy largo en pantallas bajas.                         | Sticky solo desde `lg`. Debajo de `lg` el índice va arriba del cuerpo, sin sticky.             |
| Un "Ingresar" y un "Crear cuenta" que no llevan a ningún lado pueden confundir.                       | Es una maqueta. Si el blog se publica antes del spec de cuentas, ocultar los tres botones.     |
| Los comentarios y las valoraciones mock pueden pasar por opiniones reales de clientes.                | Se marcan como mock en `lib/blog-posts.ts`. El spec de comentarios los reemplaza.              |
| `generateStaticParams` con `cacheComponents: true` falla en el build si devuelve un array vacío.      | Sale de `blogPosts`, que siempre tiene 8 elementos.                                            |

## Qué **no** incluye este spec

- Blog dinámico (CMS, base de datos, MDX o markdown).
- Búsqueda funcional.
- Newsletter.
- Filtros en la URL, paginación y páginas por categoría.
- Varios autores, fotos y páginas de autor.
- JSON-LD, RSS, sitemap y robots.
- Imágenes de portada y Open Graph por artículo.
- Cuentas, login, formulario de comentario y backend de valoraciones.
- Reacciones distintas de "Útil" y contador de lecturas.
- Barra de progreso de lectura.

Cada uno de estos, si llega, va en su propio spec.
