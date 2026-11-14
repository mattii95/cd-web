# SPEC 01 — Base del sitio y landing page

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-11-13
> **Objetivo:** Reemplazar el template de create-next-app por la base visual de Courroux Digital (tokens, fuentes, header y footer compartidos) y la home completa según el artboard `Main` del diseño de Claude Design.

## Por qué existe este spec

El diseño en Claude Design tiene 7 pantallas: la landing, 4 páginas de servicio, el índice del blog y un artículo.
Construirlas todas juntas mezcla rutas, contenido y plantillas distintas.
Este spec arma los cimientos que las demás pantallas van a reutilizar (tokens, fuentes, layout, datos del sitio) y la home, que es la pantalla que más elementos comparte con el resto.

**Fuente del diseño:** el canvas https://claude.ai/artifact/C2LN5ysoCWnCeBgrekb5bw, artboard `project/Main.dc.html` (1440 × 5200, fluido).
Se lee con la herramienta Artifact (`action: "read"`, `path: "project/Main.dc.html"`).
Es la referencia de layout, espaciados, colores, copys y animaciones.
Ante cualquier duda visual, gana el artboard.

## Alcance

**Incluye:**

- Tokens de diseño en `app/globals.css`: fondo `#050B1C`, acento `#1A66F5` (hover `#0F4FC7`, claro `#4D8BFF`), y los demás colores y superficies del artboard. Solo tema oscuro.
- Fuentes con `next/font/google`: Space Grotesk (500/600/700, títulos), Inter (400/500/600, texto) y JetBrains Mono (500/700, etiquetas tipo código). Reemplazan a Geist.
- Todas las animaciones del artboard (`gridpan`, `drift1/2`, `spin`, `spinr`, `floaty`, `rise`, `slidein`, `shine`, `beam`, `pulse`, `fill`, `pop`, `scan`, `glowtext`) como keyframes y clases `fx-*` en CSS. Se desactivan con `prefers-reduced-motion: reduce`.
- Header compartido: logo (`public/cd-sin-fondo.png` + texto "Courroux Digital"), navegación (Nosotros, Servicios, Blog, Contacto) y el CTA "Pedí tu presupuesto". En mobile, menú hamburguesa con un panel desplegable.
- Footer compartido: marca y bajada, "Disponibles para nuevos proyectos", redes (solo Instagram y WhatsApp), columnas `// servicios`, `// empresa` y `// contacto`, CTA, copyright, Términos, Privacidad y "volver_arriba".
- Home (`/`) con las secciones del artboard en orden: `#inicio` (hero), `#nosotros`, `#servicios`, `#blog`, `#contacto`.
- Hero con el texto que se escribe solo, rotando "desarrollo web", "sistemas a medida", "productos SaaS" y "agentes de IA". Con reduced-motion muestra la primera palabra fija.
- Las 4 cards de servicio con sus mini-mockups (marcos 1440/768/375px, "Sincronizando", gráfico SaaS, chat del asistente IA).
- Sección blog con 3 cards de artículo, leídas de `lib/blog-posts.ts`.
- Formulario de contacto (nombre, email, servicio, mensaje) que al enviarse abre WhatsApp (`wa.me`) con el mensaje ya armado.
- Datos del sitio centralizados en `lib/site.ts`.
- SEO básico: `lang="es-AR"`, `title` y `description` reales, Open Graph con el logo, y favicon de CD en lugar del de Next.
- Limpieza del template: se borran `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg` y `window.svg`, y `app/favicon.ico`.

**Fuera de alcance (para specs futuros):**

- Páginas de servicio `/servicios/[slug]` (artboards `Servicio-*`): SPEC 02.
- Blog `/blog` y artículo `/blog/[slug]` (artboards `Blog` y `Articulo`): SPEC 03.
- Páginas de Términos y condiciones y Política de privacidad.
- Envío real del formulario por email (Server Action + proveedor como Resend).
- Tema claro.
- Facebook, LinkedIn y GitHub en el footer (no existen todavía).
- Ciudad, horario de atención y tiempo de respuesta ("Respondemos en menos de [X] horas"): no se muestran hasta tener los datos.
- Analytics, cookies y CMS.

## Modelo de datos

```ts
// lib/site.ts
export const site = {
  name: "Courroux Digital",
  description:
    "Desarrollo web, sistemas a medida, productos SaaS e inteligencia artificial para negocios que quieren crecer.",
  url: "https://courrouxdigital.com", // dominio a confirmar; se usa en metadataBase
  email: "courrouxdigital@gmail.com",
  whatsapp: "543573436193", // sin "+", formato wa.me
  whatsappDisplay: "+54 3573 436193",
  instagram: "courrouxdigital", // sin "@"
  foundedYear: 0, // 0 = no se muestra
  projectsDelivered: 0, // 0 = no se muestra
} as const;
```

```ts
// lib/services.ts
export type Service = {
  slug:
    | "desarrollo-web"
    | "sistemas-a-medida"
    | "desarrollo-saas"
    | "inteligencia-artificial";
  title: string; // "Desarrollo web"
  description: string; // copy de la card del artboard
  isNew?: boolean; // badge "Nuevo" (solo IA)
};
// href = `/servicios/${slug}`
```

```ts
// lib/blog-posts.ts
export type BlogPost = {
  slug: string; // "senales-sistema-a-medida"
  category: string; // "Sistemas"
  categoryTag: string; // "sistemas" → se muestra como "// sistemas"
  readingMinutes: number;
  title: string;
  excerpt: string;
};
// Los 3 posts del artboard: sistemas (6 min), ia (5 min), desarrollo-web (4 min).
// href = `/blog/${slug}`
```

Convenciones:

- Los valores en `0` de `site.ts` ocultan el elemento que los usa, en vez de mostrar "+0" o "desde 0".
- Los links internos usan rutas finales aunque todavía den 404: `/servicios/[slug]`, `/blog`, `/blog/[slug]`, `/terminos`, `/privacidad`.
- Las anclas de la home son `#inicio`, `#nosotros`, `#servicios`, `#blog` y `#contacto`, como en el artboard.

## Plan de implementación

1. **Tokens y fuentes.** Reescribir `app/globals.css` con los tokens del artboard en `@theme inline` (colores y `--font-display`/`--font-sans`/`--font-mono`). Quitar el switch por `prefers-color-scheme`. En `app/layout.tsx`, cambiar Geist por Space Grotesk, Inter y JetBrains Mono, y poner `lang="es-AR"`. Prueba: `npm run dev` levanta y el fondo es `#050B1C`.
2. **Animaciones.** Agregar a `app/globals.css` los keyframes y las clases `fx-*` del `<helmet>` del artboard, más el bloque `@media (prefers-reduced-motion: reduce)` que las desactiva.
3. **Datos.** Crear `lib/site.ts`, `lib/services.ts` y `lib/blog-posts.ts` con el contenido del modelo de datos y los copys exactos del artboard.
4. **Íconos.** Crear `components/icons.tsx` con los SVG inline del artboard (flechas, check, redes, contacto). Los decorativos llevan `aria-hidden="true"`.
5. **Header.** Crear `components/site-header.tsx` (logo, nav y CTA) y `components/mobile-menu.tsx` (client component: botón hamburguesa con `aria-expanded`, panel que se cierra al tocar un link o con Escape). Montarlo en `app/layout.tsx`.
6. **Footer.** Crear `components/site-footer.tsx` con el contenido de la sección Alcance, leyendo de `site.ts` y `services.ts`. Montarlo en `app/layout.tsx`.
7. **SEO.** Completar `metadata` en `app/layout.tsx` (title con template `%s · Courroux Digital`, description, `metadataBase`, `openGraph` con el logo). Crear `app/icon.png` a partir del logo y borrar `app/favicon.ico`.
8. **Hero.** Crear `components/home/hero.tsx` (fondo con grilla, orbes, anillos, mockup "tumarca.com" con tráfico y badge de mobile) y `components/home/typed-text.tsx` (client component con el efecto de escritura del script del artboard, respetando reduced-motion). Reemplazar `app/page.tsx` por la home con el hero.
9. **Nosotros.** Crear `components/home/about.tsx`: bloque `nosotros.js`, texto y los 4 diferenciales. En el bloque de código, `desde` se omite si `foundedYear` es 0, y `base` muestra `"Argentina"`. El badge "[+X] proyectos entregados" no se renderiza si `projectsDelivered` es 0. El párrafo `[Contá acá la historia…]` queda como placeholder visible.
10. **Servicios.** Crear `components/home/services.tsx` con las 4 cards y sus mini-mockups, cada una con link a `/servicios/[slug]`.
11. **Blog.** Crear `components/home/blog-preview.tsx` con las 3 cards de `blog-posts.ts` y el link "Ver todos los artículos" a `/blog`.
12. **Contacto.** Crear `components/home/contact.tsx` (texto y canales: WhatsApp, email e Instagram desde `site.ts`) y `components/home/contact-form.tsx` (client component). El form tiene `<label>` en cada campo, y nombre, email y mensaje son `required`. Al enviar, hace `preventDefault`, arma el texto y abre `https://wa.me/${site.whatsapp}?text=...` en una pestaña nueva.
13. **Limpieza.** Borrar los SVG del template en `public/`. Verificar que no quedan referencias a Geist ni a "Create Next App".

## Criterios de aceptación

- [x] `npm run build` termina sin errores ni warnings de tipos.
- [x] `npm run lint` termina sin errores.
- [x] `/` carga sin errores en la consola del navegador.
- [x] La home muestra, en orden, las secciones `#inicio`, `#nosotros`, `#servicios`, `#blog` y `#contacto`, y cada link del header lleva a su ancla.
- [ ] A 1440px de ancho, la home coincide visualmente con el artboard `Main` (layout, copys, colores y fuentes).
- [x] A 375px de ancho no hay scroll horizontal, y el header muestra la hamburguesa en lugar de los links.
- [x] La hamburguesa abre el panel, `aria-expanded` cambia a `true`, y tocar un link o apretar Escape lo cierra.
- [x] El texto del hero rota entre las 4 palabras escribiendo y borrando.
- [x] Con `prefers-reduced-motion: reduce` emulado, no hay animaciones y el hero muestra "desarrollo web" fijo.
- [x] No aparece ningún texto "+0", "desde 0", "[año]", "[Ciudad]", "[X] horas" ni "[Tu marca]".
- [x] El footer solo muestra Instagram y WhatsApp como redes.
- [x] Enviar el formulario completo abre `wa.me/543573436193` con nombre, email, servicio y mensaje en el texto.
- [x] Enviar el formulario con un campo requerido vacío no abre WhatsApp y el navegador marca el campo.
- [x] Las cards de servicio apuntan a `/servicios/desarrollo-web`, `/servicios/sistemas-a-medida`, `/servicios/desarrollo-saas` y `/servicios/inteligencia-artificial`.
- [x] Las cards de blog apuntan a `/blog/[slug]`, y "Ver todos los artículos" apunta a `/blog`.
- [x] La pestaña del navegador muestra el ícono de CD y un título con "Courroux Digital".
- [x] El `<html>` tiene `lang="es-AR"`.
- [x] `public/` ya no contiene `file.svg`, `globe.svg`, `next.svg`, `vercel.svg` ni `window.svg`.

## Decisiones

- **Sí:** spec separado para la base + la home. Servicios (SPEC 02) y blog (SPEC 03) tienen rutas y plantillas propias.
- **No:** las 7 pantallas en un spec. Demasiado grande para revisarlo y commitearlo por pasos.
- **Sí:** datos del sitio en `lib/site.ts`. Los placeholders del diseño se completan en un solo lugar.
- **Sí:** `foundedYear` y `projectsDelivered` en `0` ocultan sus elementos. El emprendimiento es nuevo, y "+0 proyectos" o "desde 0" se ven mal.
- **Sí:** ciudad, horario y tiempo de respuesta no se muestran. Todavía no hay datos.
- **No:** dejar los placeholders `[...]` del diseño en producción, salvo el párrafo de la historia de "Nosotros".
- **Sí:** el formulario abre WhatsApp con el mensaje armado. Cero backend, y es el canal principal.
- **No:** Server Action + email. Necesita proveedor, API key y estados de error. Va en otro spec.
- **No:** dos botones (WhatsApp y email). Se aparta del diseño.
- **Sí:** links a rutas finales aunque den 404. Funcionan solos cuando lleguen SPEC 02 y 03.
- **No:** anclas provisorias para servicios y blog. Habría que cambiarlas después.
- **Sí:** solo tema oscuro. Es lo único diseñado.
- **Sí:** todas las animaciones, con soporte de reduced-motion. Son parte de la identidad del diseño.
- **Sí:** logo PNG + texto "Courroux Digital". Es el logo que ya está en el repo, y el texto ayuda al SEO.
- **Sí:** menú hamburguesa en mobile. El artboard no define el header en celular.
- **Sí:** las cards de blog salen de `lib/blog-posts.ts`. SPEC 03 reutiliza el mismo archivo.
- **Sí:** solo Instagram y WhatsApp en el footer. Facebook, LinkedIn y GitHub no existen todavía.
- **Sí:** CSS de animaciones en `globals.css` y layout con clases de Tailwind. Así se evitan los estilos inline del artboard.

## Riesgos

| Riesgo                                                                                                                     | Mitigación                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `wa.me/543573436193` puede no abrir el chat: para celulares de Argentina WhatsApp suele exigir el `9` (`5493573436193`).   | Probar el link real en el paso 12. Si falla, cambiar `site.whatsapp` a `5493573436193`.                                             |
| Con `cacheComponents: true`, usar `new Date()` en un Server Component para el año del copyright puede romper el prerender. | Revisar `node_modules/next/dist/docs/` en el paso 6. Si molesta, mover el año a un client component o a un valor fijo en `site.ts`. |
| El dominio de `metadataBase` (`courrouxdigital.com`) no está confirmado.                                                   | Valor en un solo lugar (`site.url`). Si el dominio cambia, se cambia esa línea.                                                     |
| Las animaciones (orbes con `blur(90px)`, grilla animada) pueden pesar en celulares de gama baja.                           | Animar solo `transform`/`opacity`, que corren en la GPU. Reduced-motion las apaga.                                                  |
| `@property --a` (animación `beam`) no existe en navegadores viejos.                                                        | Es decorativa: si no se soporta, el borde queda estático.                                                                           |

## Qué **no** incluye este spec

- Páginas de servicio (SPEC 02).
- Blog y artículos (SPEC 03).
- Términos y Privacidad.
- Envío del formulario por email.
- Tema claro.
- Facebook, LinkedIn y GitHub.
- Ciudad, horario y tiempo de respuesta.
- Analytics, cookies y CMS.

Cada uno de estos, si llega, va en su propio spec.
