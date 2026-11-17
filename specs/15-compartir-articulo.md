# SPEC 15 — Compartir el artículo en cualquier red

> **Estado:** Implementado
> **Depende de:** SPEC 03, SPEC 13
> **Fecha:** 2026-11-17
> **Objetivo:** Que el lector pueda compartir un artículo en las redes principales desde cualquier navegador, y que la vista previa en esas redes muestre título, bajada y portada.

## Por qué existe este spec

El botón "Compartir" de SPEC 03 usa `navigator.share` y, si no existe, solo copia el link.
En desktop (Chrome y Firefox en Linux o Windows) `navigator.share` no está, así que no se podía compartir en ninguna red.
Además, el `openGraph` del artículo no llevaba la portada y reemplazaba al del layout, así que la vista previa salía sin imagen.

## Alcance

**Incluye:**

- **`components/blog/share-button.tsx`:** `ShareButtons({ title, url })` (client) reemplaza a `ShareButton`.
  - Enlaces de ícono a WhatsApp, LinkedIn, X, Facebook, Telegram y email, con `aria-label` "Compartir por {red}". Los web abren en otra pestaña con `noopener noreferrer`.
  - "Copiar link": copia la URL y muestra "Link copiado" o "No se pudo copiar" durante 2 segundos.
  - "Más opciones para compartir": abre el panel del sistema con `navigator.share`. Solo se muestra si existe (cubre Instagram, Slack y cualquier app instalada en mobile).
  - `shareLinks(title, url)`: función pura con las URLs de cada red, con `encodeURIComponent`.
- **`components/icons.tsx`:** íconos `LinkedIn`, `XLogo`, `Facebook`, `Telegram`, `LinkIcon` y `Share`.
- **`app/(site)/blog/[slug]/page.tsx`:**
  - La URL compartida es la canónica y absoluta, `new URL("/blog/<slug>", site.url)`. No depende de `window.location`, así que no arrastra hash ni query.
  - `generateMetadata` suma `openGraph.url`, `siteName`, `locale`, la portada en `openGraph.images` (o la imagen por defecto del sitio) y `twitter` (`summary_large_image` con portada, `summary` sin ella).

**Fuera de alcance:** contadores de compartidos y una imagen OG generada por artículo (`opengraph-image`).

## Criterios de aceptación

- [x] Cada red tiene su enlace con título y URL canónica codificados (`__tests__/client/share-buttons.test.tsx`).
- [x] "Copiar link" copia la URL canónica, sin el hash de la barra, y muestra "Link copiado" (`e2e/blog.spec.ts`).
- [x] "Más opciones" solo aparece con `navigator.share` y lo llama con título y URL.
- [x] El `<head>` del artículo tiene `og:url` canónica, `og:image` de la portada y `twitter:card` `summary_large_image`.
