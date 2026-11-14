# SPEC 02 — Páginas de servicio

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-14
> **Objetivo:** Crear las 4 páginas `/servicios/[slug]` con una plantilla compartida, según los artboards `Servicio-*` del diseño de Claude Design.

## Por qué existe este spec

SPEC 01 dejó las cards de servicio de la home y del footer apuntando a `/servicios/[slug]`, que hoy dan 404.
Los 4 artboards de servicio comparten la misma estructura y solo cambian los textos y los íconos.
Por eso se arma una sola plantilla que lee el contenido de `lib/services.ts`.

**Fuente del diseño:** el canvas https://claude.ai/artifact/C2LN5ysoCWnCeBgrekb5bw, artboards `project/Servicio-Web.dc.html`, `project/Servicio-Sistemas.dc.html`, `project/Servicio-SaaS.dc.html` y `project/Servicio-IA.dc.html`.
Se leen con la herramienta Artifact (`action: "read"`, `path: "project/Servicio-Web.dc.html"`).
Son la referencia de layout, espaciados, colores, copys, íconos y animaciones.
Ante cualquier duda visual, gana el artboard, salvo en el header (ver Decisiones).

## Alcance

**Incluye:**

- Ruta dinámica `app/servicios/[slug]/page.tsx` con `generateStaticParams` para los 4 slugs de `lib/services.ts`.
- Un slug que no existe devuelve 404 con `notFound()`.
- Secciones de la página, en el orden del artboard:
  - **Hero** (fondo oscuro con grilla, orbes y anillo): breadcrumb "Servicios / {título}", `h1`, bajada, botones "Quiero este servicio" y "Qué incluye", y la card con número (`01`–`04`), ícono grande, título y tags.
  - **Qué incluye** (`#incluye`): título "Todo lo que necesitás, en un mismo equipo" y 6 cards con ícono, título y texto.
  - **Cómo trabajamos**: título "Un proceso simple y transparente" y los 4 pasos, iguales para todos los servicios.
  - **Ideal para**: título "¿Es para vos?", bajada y los 4 casos del servicio.
  - **CTA**: "¿Hablamos de tu proyecto?", bajada y botón "Pedí tu presupuesto".
  - **Otros servicios**: cards con número, ícono y título de los otros 3 servicios, con link a su página.
- Hero oscuro y secciones de abajo claras (`#FFFFFF` / `#F4F7FD`, texto `#0B1222`, bordes `#E3E8F2`), como en el artboard. Los colores claros se suman como tokens a `app/globals.css`.
- Las animaciones del artboard (`fx-rise`, `fx-reveal`, `fx-revealx`, `fx-fill`, `fx-pop`, `fx-float`, `fx-beam`, `fx-scan`, `fx-card`, `fx-icon`, `fx-arrow`, `fx-ghost`, `fx-btn`), reutilizando las clases que ya existen en `app/globals.css`. Se desactivan con `prefers-reduced-motion: reduce`, como en SPEC 01.
- Header y footer compartidos de SPEC 01, sin cambios.
- "Quiero este servicio" y "Pedí tu presupuesto" llevan a `/?servicio={slug}#contacto`.
- El formulario de contacto de la home lee `?servicio={slug}` y deja ese servicio elegido en el select.
- El breadcrumb "Servicios" apunta a `/#servicios`.
- Redirect de `/servicios` a `/#servicios` en `next.config.ts`.
- SEO por página con `generateMetadata`: `title` (`{título} · Courroux Digital` vía el template de SPEC 01), `description` con la bajada del hero, `alternates.canonical` y `openGraph` con título y descripción.

**Fuera de alcance (para specs futuros):**

- La variante de header del artboard (logo + "Volver al inicio" + CTA).
- Página índice `/servicios`.
- JSON-LD (`schema.org/Service`).
- `app/sitemap.ts` y `robots.ts`.
- Imágenes Open Graph propias por servicio (se usa el logo de SPEC 01).
- Precios, casos de éxito, testimonios o portfolio por servicio.
- Pasos de "Cómo trabajamos" distintos por servicio.
- Tema claro completo o switch de tema.
- Blog `/blog` y artículo `/blog/[slug]`: SPEC 03.

## Modelo de datos

```ts
// lib/services.ts — el tipo Service de SPEC 01 se extiende
export type ServiceIcon =
  | "code" // ícono de cada servicio y de cada ítem, según el artboard
  | "sparkles"; // … se completa con los SVG reales de los 4 artboards

export type ServiceSlug =
  | "desarrollo-web"
  | "sistemas-a-medida"
  | "desarrollo-saas"
  | "inteligencia-artificial";

export type Service = {
  slug: ServiceSlug;
  title: string; // "Desarrollo web" (card de la home, breadcrumb, select del form)
  description: string; // copy de la card de la home (sin cambios)
  isNew?: boolean; // badge "Nuevo" (solo IA)
  icon: ServiceIcon; // ícono grande del hero y de "Otros servicios"
  headline: string; // h1: "Tu negocio, con una web que trabaja por vos"
  intro: string; // bajada del hero; también es la meta description
  tags: string[]; // ["Landing pages", "Sitios institucionales", "Tiendas online"]
  features: { icon: ServiceIcon; title: string; text: string }[]; // 6 ítems de "Qué incluye"
  idealFor: string[]; // 4 casos de "¿Es para vos?"
};
```

```ts
// lib/services.ts — constante compartida por las 4 páginas
export const processSteps: { title: string; text: string }[] = [
  {
    title: "Charla inicial",
    text: "Entendemos tu negocio, tus objetivos y lo que necesitás.",
  },
  {
    title: "Propuesta",
    text: "Alcance, plazos y presupuesto claros, sin sorpresas.",
  },
  {
    title: "Desarrollo",
    text: "Avanzamos por etapas y vas viendo y probando cada avance.",
  },
  {
    title: "Lanzamiento y soporte",
    text: "Publicamos, te capacitamos y seguimos a tu lado.",
  },
];

export function getService(slug: string): Service | undefined;
```

Convenciones:

- El número del servicio (`01`–`04`) sale de su posición en el array `services`, no de un campo.
- "Otros servicios" son los 3 servicios restantes, en el orden del array.
- Los nombres de `ServiceIcon` se definen al copiar los SVG de los artboards y mapean a componentes de `components/icons.tsx`.
- El parámetro de la URL es `servicio` y su valor es el `slug`. Un valor que no existe se ignora.
- Los copys de los 4 servicios se copian textuales de su artboard.

## Plan de implementación

1. **Tokens claros.** Agregar a `@theme inline` de `app/globals.css` los colores de las secciones claras del artboard (`#FFFFFF`, `#F4F7FD`, `#EAF1FF`, `#0B1222`, `#5B6478`, `#E3E8F2`). Prueba: `npm run dev` levanta y la home se ve igual que antes.
2. **Íconos.** Agregar a `components/icons.tsx` los SVG de los 4 artboards (ícono de cada servicio y de los 24 ítems de "Qué incluye", sin repetir) y exportar un mapa `ServiceIcon → componente`. Todos llevan `aria-hidden="true"`.
3. **Datos.** Extender `Service` en `lib/services.ts` con `icon`, `headline`, `intro`, `tags`, `features` e `idealFor`, cargar los copys de los 4 artboards, y agregar `processSteps` y `getService`. Prueba: la home y el footer siguen compilando y se ven igual.
4. **Ruta y hero.** Crear `app/servicios/[slug]/page.tsx` con `generateStaticParams`, `notFound()` para slugs desconocidos y `generateMetadata`. Crear `components/service/hero.tsx` con breadcrumb, `h1`, bajada, botones y la card. Prueba: `/servicios/desarrollo-web` muestra el hero y `/servicios/no-existe` da 404.
5. **Qué incluye.** Crear `components/service/features.tsx` con `id="incluye"` y las 6 cards. Prueba: "Qué incluye" del hero hace scroll a la sección.
6. **Cómo trabajamos.** Crear `components/service/process.tsx` con los 4 pasos de `processSteps` y las barras `fx-fill`.
7. **Ideal para.** Crear `components/service/ideal-for.tsx` con el título, la bajada y los 4 casos.
8. **CTA y otros servicios.** Crear `components/service/cta.tsx` y `components/service/other-services.tsx`. Montarlos en la página.
9. **Preselección del form.** En `components/home/contact-form.tsx`, al montar, leer `servicio` de `window.location.search`. Si coincide con un slug, dejar elegido su `title` en el select. Prueba: `/?servicio=desarrollo-saas#contacto` muestra "Desarrollo SaaS" elegido.
10. **Redirect.** Agregar en `next.config.ts` un `redirects()` de `/servicios` a `/#servicios` (`permanent: false`).

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni warnings de tipos.
- [ ] `npm run lint` termina sin errores.
- [ ] El build prerenderiza `/servicios/desarrollo-web`, `/servicios/sistemas-a-medida`, `/servicios/desarrollo-saas` y `/servicios/inteligencia-artificial`.
- [ ] Las 4 páginas cargan sin errores en la consola del navegador.
- [ ] `/servicios/no-existe` responde 404.
- [ ] `/servicios` redirige a `/#servicios`.
- [ ] Cada página muestra, en orden: hero, Qué incluye, Cómo trabajamos, ¿Es para vos?, CTA y Otros servicios.
- [ ] A 1440px de ancho, cada página coincide visualmente con su artboard (layout, copys, colores, íconos y fuentes), salvo el header.
- [ ] El hero es oscuro y las secciones de abajo tienen fondo claro, como en el artboard.
- [ ] A 375px de ancho no hay scroll horizontal en ninguna de las 4 páginas.
- [ ] El header y el footer son los mismos de la home.
- [ ] El número de la card del hero es `01` en web, `02` en sistemas, `03` en SaaS y `04` en IA.
- [ ] "Otros servicios" muestra los 3 servicios restantes y cada card lleva a su página.
- [ ] "Qué incluye" del hero hace scroll a `#incluye`.
- [ ] "Quiero este servicio" y "Pedí tu presupuesto" llevan a `/?servicio={slug}#contacto`.
- [ ] Al llegar desde ese link, el select del formulario muestra el servicio de origen.
- [ ] `/?servicio=no-existe#contacto` deja el select en su valor por defecto, sin errores.
- [ ] El breadcrumb "Servicios" lleva a `/#servicios`.
- [ ] La pestaña muestra "{título} · Courroux Digital" en cada página.
- [ ] Cada página tiene `<meta name="description">` con la bajada del hero y `<link rel="canonical">` con su URL.
- [ ] Con `prefers-reduced-motion: reduce` emulado, las páginas de servicio no tienen animaciones.
- [ ] No aparece ningún texto "[Tu marca]", "[tu@email.com]", "[Ciudad]" ni "[9 a 18 h]".

## Decisiones

- **Sí:** una ruta dinámica `[slug]` con `generateStaticParams`. Las 4 páginas son la misma plantilla y salen estáticas.
- **No:** 4 páginas sueltas. Cuatro copias del mismo layout para mantener.
- **Sí:** `notFound()` para slugs desconocidos. `dynamicParams` no existe con `cacheComponents: true`.
- **Sí:** header compartido de SPEC 01. Queda igual en todo el sitio y la hamburguesa ya funciona.
- **No:** la variante "Volver al inicio" del artboard. Obliga a tener dos headers y a que el layout elija cuál mostrar.
- **Sí:** respetar las secciones claras del artboard. Es el diseño. No es un tema claro, son fondos claros fijos.
- **No:** pasar todo a oscuro. Se aparta del diseño.
- **Sí:** el contenido extiende `lib/services.ts`. Una sola fuente por servicio, y la home sigue usando `title` y `description`.
- **No:** un archivo aparte `lib/service-pages.ts`. Dos archivos indexados por slug que hay que mantener sincronizados.
- **Sí:** `processSteps` como constante compartida. Los 4 artboards tienen los mismos pasos.
- **No:** pasos por servicio. Repetir lo mismo 4 veces; se cambia si algún servicio lo necesita.
- **Sí:** los CTA van a `/?servicio={slug}#contacto` con el servicio ya elegido. El usuario no repite lo que ya eligió, y se reutiliza el formulario de SPEC 01.
- **No:** WhatsApp directo desde la página de servicio. Saltea el formulario y pierde nombre y email.
- **Sí:** leer `servicio` con `window.location.search` al montar. Con `cacheComponents: true`, `useSearchParams` en la home prerenderizada obliga a envolver el form en `<Suspense>`.
- **Sí:** el breadcrumb y `/servicios` llevan a `/#servicios`. No hay página índice diseñada.
- **No:** crear `/servicios`. No está en el diseño; va en otro spec si hace falta.
- **Sí:** redirect temporal (`permanent: false`). Si después aparece una página índice, no queda cacheado en los navegadores.
- **Sí:** SEO con title, description, canonical y Open Graph. Alcanza para indexar 4 páginas.
- **No:** JSON-LD y sitemap. Beneficio chico ahora; el sitemap toca todo el sitio y va en otro spec.
- **Sí:** el número `01`–`04` sale del orden del array. Un campo extra se desincronizaría al reordenar.

## Riesgos

| Riesgo                                                                                                                                                      | Mitigación                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Si el usuario ya está en la home, el link `/?servicio=…#contacto` puede hacer una navegación del cliente sin remontar el form, y el select no se actualiza. | Los CTA solo están en las páginas de servicio, que son otra ruta. Probar el caso en el paso 9; si falla, escuchar el cambio de URL. |
| El redirect a `/#servicios` depende de que el navegador respete el `#` del header `Location`.                                                               | Los navegadores actuales lo respetan. Si alguno no, cae en `/`, que sigue funcionando.                                              |
| `generateStaticParams` con `cacheComponents: true` falla en el build si devuelve un array vacío.                                                            | Sale de `services`, que siempre tiene 4 elementos.                                                                                  |
| Los artboards de Sistemas y SaaS no se revisaron en detalle al escribir este spec.                                                                          | Leerlos en el paso 3. Si su estructura difiere de Web e IA, actualizar el spec antes de seguir.                                     |
| Las secciones claras pueden heredar colores del `body` oscuro (texto blanco sobre fondo blanco).                                                            | Cada sección clara define su fondo y su color de texto con los tokens del paso 1.                                                   |

## Qué **no** incluye este spec

- Variante de header "Volver al inicio".
- Página índice `/servicios`.
- JSON-LD, sitemap y robots.
- Imágenes Open Graph por servicio.
- Precios, casos de éxito, testimonios y portfolio.
- Pasos de proceso distintos por servicio.
- Tema claro completo.
- Blog y artículos (SPEC 03).

Cada uno de estos, si llega, va en su propio spec.
