# SPEC 16 — Estructura del CMS: shell del panel de administración

> **Estado:** Implementado
> **Depende de:** SPEC 07, SPEC 10
> **Fecha:** 2026-11-17
> **Objetivo:** Que el panel `/admin` tenga su propio layout claro del canvas "CMS Courroux Digital" (barra lateral, barra superior con la cuenta e inicio con accesos directos), con Usuarios y Medios migrados adentro, Artículos como página vacía y todas las Server Actions en `actions/`, separadas de los componentes.

## Por qué existe este spec

Hoy `/admin` (tabla de usuarios) y `/admin/medios` viven en `app/(site)/admin/`. Usan el header y el footer públicos y el tema oscuro del sitio.
El canvas [CMS Courroux Digital](https://claude.ai/artifact/QnCCtdB9JaPEQ7nf84dVgA) define otro lenguaje para el panel: barra lateral oscura `#0B1020`, contenido sobre fondo claro `#E3E9F7`, paneles blancos con borde `#AEBBDD` y botones de píldora.
Este spec arma esa estructura para que los specs siguientes (gestión de artículos, editor, categorías, métricas) solo sumen páginas.

Además, las Server Actions viven hoy en `app/`, mezcladas con las páginas y los componentes (`app/cuenta/actions.ts`, `app/(site)/admin/medios/actions.ts`, `app/(site)/blog/actions.ts` y `app/(site)/blog/community-actions.ts`).
Como este spec ya mueve Medios, aprovecha para pasar las cuatro a una carpeta `actions/` en la raíz. Así los specs siguientes del CMS nacen con la convención nueva.

**Referencias:**

- Canvas, artboards "Artículos" (`Main.dc.html`) y "Editor de artículo" (`Editor.dc.html`): barra lateral, barra superior, encabezado de página, paneles, tablas e inputs.
- `node_modules/next/dist/docs/01-app/` sobre route groups y layouts, y sobre Cache Components (lo dinámico dentro de `<Suspense>`).
- `lib/auth/dal.ts` (`getCurrentUser`, `requireAdmin`), `app/cuenta/actions.ts` (`signOutAction`), `components/auth/user-avatar.tsx` y `lib/auth/avatar.ts` (`avatarSrc`).

## Alcance

**Incluye:**

- **Grupo de rutas nuevo `app/(admin)/`**, con su propio `layout.tsx`, sin `SiteHeader` ni `SiteFooter`. Las URLs no llevan el grupo:

  | Ruta               | Página                                            | Antes                      |
  | ------------------ | ------------------------------------------------- | -------------------------- |
  | `/admin`           | Inicio: saludo y accesos directos                 | tabla de usuarios          |
  | `/admin/articulos` | Artículos: encabezado y estado vacío              | no existía                 |
  | `/admin/medios`    | Medios, misma funcionalidad, re-estilada en claro | `app/(site)/admin/medios/` |
  | `/admin/usuarios`  | Usuarios, la tabla de hoy, re-estilada en claro   | `/admin`                   |

  Se borra `app/(site)/admin/` completo.

- **Layout (`app/(admin)/layout.tsx`):**
  - `metadata`: `robots: { index: false, follow: false }` y `title.template` `"%s · Panel"`.
  - Raíz con `bg-cms-canvas text-cms-ink` y `color-scheme: light`, para que `select`, `checkbox` y la barra de scroll nativos se vean claros (el sitio fija `color-scheme: dark` en `html`).
  - Desde 1024 px (`lg`): barra lateral fija a la izquierda de 264 px y el contenido a la derecha, con `padding` 40/48 px como el canvas.
  - Debajo de 1024 px: la barra lateral se oculta y la barra superior suma, a la izquierda, el botón "Abrir menú" y el logo.
  - Un enlace "Saltar al contenido" como primer elemento enfocable, que lleva a `<main id="contenido">`.
- **Barra lateral (`components/admin/admin-sidebar.tsx`, servidor, y `components/admin/admin-nav.tsx`, cliente):**
  - Logo del canvas (hexágono con el acento) y "Courroux Digital", con enlace a `/admin`.
  - Ítems, en `components/admin/nav-items.ts`:

    | Grupo              | Ítem      | Ruta               |
    | ------------------ | --------- | ------------------ |
    | —                  | Inicio    | `/admin`           |
    | Contenido del blog | Artículos | `/admin/articulos` |
    | Contenido del blog | Medios    | `/admin/medios`    |
    | Administración     | Usuarios  | `/admin/usuarios`  |

  - Cada ítem tiene su ícono de trazo (`components/icons.tsx`). Los del canvas para Artículos y Medios; para Inicio y Usuarios, nuevos del mismo estilo.
  - El ítem activo tiene fondo `accent`, texto blanco y `aria-current="page"`. `Inicio` es activo solo en `/admin` exacto. Los demás, en su ruta y en sus subrutas.
  - Abajo, separado: "Ver el blog", enlace a `/blog` con borde, como el canvas.
  - `<nav aria-label="Navegación del panel">`.

- **Cajón móvil (`components/admin/admin-drawer.tsx`, cliente):**
  - Botón "Abrir menú" (`aria-expanded`, `aria-controls`) de 44 × 44 px.
  - Abre un panel desde la izquierda con la misma `AdminNav` y un botón "Cerrar menú".
  - Fondo oscurecido detrás. Clic en el fondo, `Escape` o elegir un ítem lo cierra.
  - Mientras está abierto, el foco queda atrapado en el panel y el `body` no scrollea. Al cerrar, el foco vuelve al botón "Abrir menú".
- **Barra superior (`components/admin/admin-topbar.tsx`):**
  - A la derecha, el menú de cuenta. Sin campana de notificaciones.
  - Línea inferior `border-cms-line`, como el canvas.
- **Menú de cuenta (`components/admin/account-menu.tsx`, servidor, y `components/admin/account-menu-dropdown.tsx`, cliente):**
  - El servidor llama a `getCurrentUser()` dentro de un `<Suspense>` con un esqueleto de píldora de 48 px de alto.
  - Botón de píldora blanco: `UserAvatar` en un círculo de 36 px, nombre, y debajo "Administrador". `aria-label` "Cuenta: {nombre}, administrador", `aria-expanded` y `aria-controls`.
  - Al abrir: "Mi perfil" (`/cuenta/perfil`), "Ver el sitio" (`/`) y "Cerrar sesión" (`signOutAction`).
  - Se cierra con `Escape` y con clic afuera, como `UserMenuDropdown`.
  - Sin usuario (base caída) no muestra nada.
- **Encabezado de página (`components/admin/page-header.tsx`):** `AdminPageHeader({ title, description?, actions? })`. `h1` en Space Grotesk 700, `clamp(30px, 3vw, 40px)`, bajada en `text-cms-text` y acciones a la derecha que bajan en móvil.
- **Inicio (`app/(admin)/admin/page.tsx`):**
  - `AdminPageHeader` con título "Inicio" y bajada "Gestioná el contenido y los usuarios del sitio.".
  - "Hola, {nombre}" con el primer nombre del usuario, dentro del `<Suspense>` que llama a `requireAdmin()`.
  - Tres tarjetas en grilla (1 columna en móvil, 3 desde `lg`), cada una un enlace entero con ícono, título y una línea:

    | Tarjeta   | Ruta               | Texto                                       |
    | --------- | ------------------ | ------------------------------------------- |
    | Artículos | `/admin/articulos` | "Creá, editá y publicá las notas del blog." |
    | Medios    | `/admin/medios`    | "Subí y organizá las imágenes del blog."    |
    | Usuarios  | `/admin/usuarios`  | "Mirá quién se registró y con qué rol."     |

  - Sin números ni gráficos.

- **Artículos (`app/(admin)/admin/articulos/page.tsx`):**
  - `AdminPageHeader` con título "Artículos" y bajada "Creá, editá y publicá las notas del blog.", sin acciones.
  - Panel blanco con estado vacío: "La gestión de artículos llega en el próximo spec.".
  - Llama a `requireAdmin()` dentro de su `<Suspense>`.
- **Usuarios (`app/(admin)/admin/usuarios/page.tsx`):** la consulta y las columnas de hoy (Nombre, Email, Rol, Verificado, Alta) y el contador "N usuarios registrados", dentro de un panel blanco como la tabla del canvas: cabecera `bg-cms-head` en mayúsculas de 12 px, filas con línea `border-cms-line-soft`. En móvil cada fila se apila con `data-label`, como hoy.
- **Server Actions en `actions/` (carpeta nueva en la raíz):**
  - Cada archivo `"use server"` se mueve a `actions/<ruta>/index.ts`, donde `<ruta>` replica la URL de la página que lo usa, sin route groups:

    | Antes                                  | Después                           | Import                     |
    | -------------------------------------- | --------------------------------- | -------------------------- |
    | `app/(site)/admin/medios/actions.ts`   | `actions/admin/medios/index.ts`   | `@/actions/admin/medios`   |
    | `app/cuenta/actions.ts`                | `actions/cuenta/index.ts`         | `@/actions/cuenta`         |
    | `app/(site)/blog/actions.ts`           | `actions/blog/index.ts`           | `@/actions/blog`           |
    | `app/(site)/blog/community-actions.ts` | `actions/blog/comunidad/index.ts` | `@/actions/blog/comunidad` |

  - Se mueven sin cambios: mismas funciones, mismos nombres, mismas validaciones, mismos `revalidatePath` y `updateTag`, y mismos tipos exportados.
  - Se actualizan los imports de todos los que las usan: `app/(admin)/admin/medios/*.tsx`, `components/account/` (`my-comments.tsx`, `sign-out-button.tsx`), `components/auth/` (`auth-form.tsx`, `form-message.tsx`, `login-form.tsx`, `new-password-view.tsx`, `recover-form.tsx`, `register-form.tsx`, `social-buttons.tsx`, `user-menu-dropdown.tsx`, `user-menu.tsx`, `verify-view.tsx`) y `components/blog/` (`post-list.tsx`, `reviews-section.tsx`), más el menú de cuenta nuevo del panel.
  - No quedan archivos `actions.ts` ni `*-actions.ts` en `app/`, ni ningún `"use server"` fuera de `actions/`.
  - `actions/` solo tiene archivos `.ts`, nunca `.tsx`.

- **Medios (`app/(admin)/admin/medios/`):** se mueven los archivos de la página (`page.tsx`, `card-item.ts`, `media-card.tsx`, `media-grid.tsx`, `styles.ts`, `upload-form.tsx`). `actions.ts` no viaja con ellos: va a `actions/admin/medios/index.ts`. La lógica, los textos y los `aria-*` no cambian. Las clases pasan a los tokens `cms-*`: paneles blancos, bordes `cms-line`, inputs con borde `cms-control`, botones secundarios de píldora blanca y principal en `accent`. `revalidatePath("/admin/medios")` sigue igual. El enlace "Administración" de arriba se va: la navegación la da la barra lateral.
- **Tokens (`app/globals.css`, dentro de `@theme inline`):**

  | Token                   | Valor     | Uso                                            |
  | ----------------------- | --------- | ---------------------------------------------- |
  | `--color-cms-canvas`    | `#E3E9F7` | fondo del panel                                |
  | `--color-cms-panel`     | `#FFFFFF` | tarjetas, tablas, menú de cuenta               |
  | `--color-cms-panel-alt` | `#F6F8FD` | barras de filtros y pie de tablas              |
  | `--color-cms-head`      | `#EDF1FB` | cabecera de tablas                             |
  | `--color-cms-line`      | `#AEBBDD` | bordes de paneles y separadores                |
  | `--color-cms-line-soft` | `#CFD8EE` | líneas entre filas                             |
  | `--color-cms-control`   | `#8794B8` | borde de inputs, selects y botones secundarios |
  | `--color-cms-ink`       | `#0B1020` | texto principal                                |
  | `--color-cms-text`      | `#3D4760` | texto secundario y etiquetas                   |
  | `--color-cms-muted`     | `#55607A` | ayudas y metadatos                             |
  | `--color-cms-chip`      | `#E8EEFF` | chips y badges suaves                          |
  | `--color-cms-link`      | `#1D4ED8` | enlaces de texto sobre claro                   |
  | `--color-cms-nav`       | `#0B1020` | fondo de la barra lateral y el cajón           |
  | `--color-cms-nav-text`  | `#C5CEE6` | ítems inactivos                                |
  | `--color-cms-nav-label` | `#8FA0C8` | títulos de grupo                               |
  | `--color-cms-nav-line`  | `#2A3557` | borde de "Ver el blog"                         |
  - El acento es el del sitio (`accent` `#1A66F5`, `accent-hover` `#0F4FC7`).
  - Foco visible sobre claro: `.bg-cms-canvas :focus-visible { outline-color: var(--color-accent); }`. En la barra lateral y el cajón sigue `accent-light`.

- **Diseño:** el layout, la barra lateral, el cajón, el menú de cuenta, el encabezado, el inicio, el estado vacío y el re-estilo de Usuarios y Medios se hacen con `/frontend-design`, siguiendo el canvas. Todos los controles miden 44 px o más.
- **Tests (casos en los criterios de aceptación):**
  - Vitest `client`: `__tests__/client/admin-nav.test.tsx` y `__tests__/client/admin-drawer.test.tsx`, nuevos, con `usePathname` mockeado. `media-grid.test.tsx` cambia los imports a `@/app/(admin)/admin/medios/…`.
  - Los tests que importan o mockean actions cambian la ruta del `import` y del `vi.mock` a `@/actions/…`: `login-form`, `media-grid`, `my-comments`, `post-list`, `reviews-section` y `social-buttons` (`client`), y `blog-actions` y `community-actions` (`db`). Sus casos no cambian.
  - Playwright: `e2e/admin.spec.ts`, nuevo. `e2e/auth.spec.ts` y `e2e/medios.spec.ts` se ajustan a las rutas nuevas.

**Fuera de alcance (para specs futuros):**

- Login propio del panel (`/admin/ingresar`, artboard "Ingreso"). Se sigue usando `/cuenta/login?volver=/admin`.
- La tabla de artículos con pestañas, filtros, orden y paginación, y el botón "Nuevo artículo".
- El editor de artículos.
- Categorías, SEO y Ajustes.
- Métricas en el inicio y conteos en las tarjetas.
- Notificaciones (la campana del canvas).
- Exportar artículos.
- Cambiar el rol de un usuario desde el panel.
- Barra lateral colapsable en desktop.
- Modo oscuro del panel.

## Modelo de datos

No hay tablas, columnas, migraciones ni consultas nuevas. Usuarios y Medios usan las consultas que ya tienen.

```ts
// components/admin/nav-items.ts
export type AdminNavItem = {
  label: string;
  href: "/admin" | "/admin/articulos" | "/admin/medios" | "/admin/usuarios";
  icon: (props: { className?: string }) => React.ReactNode;
  exact?: boolean; // true solo en Inicio
};
export type AdminNavGroup = { label: string | null; items: AdminNavItem[] };
export const adminNav: AdminNavGroup[];
export function isActive(item: AdminNavItem, pathname: string): boolean;

// components/admin/admin-nav.tsx ("use client")
export function AdminNav({
  onNavigate,
}: {
  onNavigate?: () => void;
}): React.ReactNode;

// components/admin/admin-drawer.tsx ("use client")
export function AdminDrawer(): React.ReactNode;

// components/admin/account-menu-dropdown.tsx ("use client")
export function AccountMenuDropdown(props: {
  name: string;
  image: string | null; // ya pasó por avatarSrc
}): React.ReactNode;

// components/admin/page-header.tsx
export function AdminPageHeader(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}): React.ReactNode;
```

Convenciones:

- Cada página del panel llama a `requireAdmin()` dentro de su propio `<Suspense>`, como hoy. El layout no lee la sesión fuera del `<Suspense>` del menú de cuenta.
- La barra lateral, el cajón y el encabezado no tienen datos: son parte del shell estático.
- Las clases de color del panel usan solo tokens `cms-*` y `accent*`, sin hex sueltos.
- Toda Server Action nueva va en `actions/<ruta>/index.ts`, con `<ruta>` igual a la URL de la página que la usa. Por ejemplo, la gestión de artículos irá en `actions/admin/articulos/index.ts`.

## Plan de implementación

1. **Actions a `actions/`.** Mover los cuatro archivos según la tabla del alcance y actualizar los imports de componentes, páginas y tests (incluidos los `vi.mock`). Medios todavía está en `app/(site)/admin/medios/` y solo cambia su import. Prueba: `npx tsc --noEmit`, `npm run test:run` y `npm run test:db` pasan, y `grep -rl '"use server"' app components lib db` no devuelve nada.
2. **Tokens.** Sumar los `cms-*` y la regla de foco a `app/globals.css`. Prueba: `npm run build` pasa y el sitio público se ve igual.
3. **Grupo y layout.** Crear `app/(admin)/layout.tsx` con barra lateral, `nav-items.ts`, `AdminNav`, barra superior sin menú de cuenta y `AdminPageHeader`. Mover la página de usuarios a `app/(admin)/admin/usuarios/page.tsx` y crear `/admin` y `/admin/articulos`. Borrar `app/(site)/admin/page.tsx`. Revisar con `/frontend-design`. Prueba: `npm run build` sin `DATABASE_URL` pasa y las tres rutas cargan con la barra lateral.
4. **Medios.** Mover `app/(site)/admin/medios/` a `app/(admin)/admin/medios/`, actualizar los imports de `media-grid.test.tsx` y borrar `app/(site)/admin/`. Prueba: `npm run test:run` pasa.
5. **Menú de cuenta.** `AccountMenu` y `AccountMenuDropdown` en la barra superior, en su `<Suspense>`, con `signOutAction` de `@/actions/cuenta`. Revisar con `/frontend-design`. Prueba: `npm run build` sin `DATABASE_URL` pasa.
6. **Cajón móvil.** `AdminDrawer` debajo de `lg`. Crear `admin-nav.test.tsx` y `admin-drawer.test.tsx`. Prueba: `npm run test:run` pasa.
7. **Re-estilo.** Usuarios y Medios con tokens `cms-*`, y el contenido del Inicio y del estado vacío de Artículos. Revisar con `/frontend-design`. Prueba: `npm run test:run` pasa y no quedan clases `text-white`, `bg-background` ni `border-border-*` en `app/(admin)/`.
8. **E2E.** Crear `e2e/admin.spec.ts` y ajustar `auth.spec.ts` y `medios.spec.ts`. Prueba: `npm run test:e2e` pasa, incluidos `blog.spec.ts`, `comunidad.spec.ts`, `cuenta.spec.ts` y `oauth.spec.ts`, que usan las actions movidas.

## Criterios de aceptación

- [x] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [x] `npm run test:db` pasa con Docker levantado.
- [x] `npm run test:e2e` pasa, incluidos `auth.spec.ts` y `medios.spec.ts` ajustados.
- [x] No existe `app/(site)/admin/`.
- [x] Existen `actions/admin/medios/index.ts`, `actions/cuenta/index.ts`, `actions/blog/index.ts` y `actions/blog/comunidad/index.ts`, y cada uno empieza con `"use server"`.
- [x] `grep -rl '"use server"' app components lib db` no devuelve ningún archivo.
- [x] No hay archivos `actions.ts` ni `*-actions.ts` dentro de `app/`.
- [x] `actions/` no tiene archivos `.tsx`.
- [x] Ningún archivo importa de `@/app/cuenta/actions`, `@/app/(site)/blog/actions`, `@/app/(site)/blog/community-actions` ni `@/app/(site)/admin/medios/actions`, y ningún `vi.mock` apunta a esas rutas.
- [x] Login, registro, recuperar contraseña, cerrar sesión, cargar más artículos, valorar, comentar y subir imágenes funcionan igual que antes (E2E existentes).
- [x] `/admin`, `/admin/articulos`, `/admin/medios` y `/admin/usuarios` no muestran el header ni el footer del sitio.
- [x] Sin sesión, las cuatro rutas redirigen a `/cuenta/login` con `volver` igual a la ruta pedida (por ejemplo `?volver=%2Fadmin%2Fmedios`).
- [x] Con un lector, las cuatro rutas responden 404.
- [x] Las cuatro rutas tienen `<meta name="robots" content="noindex, nofollow">` y su título termina en "· Panel".
- [x] `AdminNav` en `/admin` marca "Inicio" con `aria-current="page"` y ningún otro ítem.
- [x] `AdminNav` en `/admin/medios` marca "Medios" y no marca "Inicio".
- [x] La barra lateral tiene, en orden, Inicio, Artículos, Medios, Usuarios y "Ver el blog", y no tiene Categorías, SEO ni Ajustes.
- [x] A 1280 px la barra lateral se ve y no hay botón "Abrir menú".
- [x] A 390 px la barra lateral no se ve, "Abrir menú" la abre, `Escape` la cierra y el foco vuelve al botón.
- [x] `AdminDrawer`: con el panel abierto, `Tab` desde el último elemento vuelve al primero.
- [x] `AdminDrawer`: elegir un ítem cierra el panel.
- [x] A 390 px ninguna de las cuatro rutas tiene scroll horizontal de página.
- [x] El menú de cuenta muestra el nombre del admin y "Administrador", y abre "Mi perfil", "Ver el sitio" y "Cerrar sesión".
- [x] "Cerrar sesión" desde el menú de cuenta termina la sesión y `/admin` vuelve a redirigir al login.
- [x] `/admin` muestra "Inicio", "Hola, {primer nombre}" y tres tarjetas que llevan a `/admin/articulos`, `/admin/medios` y `/admin/usuarios`.
- [x] `/admin/articulos` muestra "Artículos" y "La gestión de artículos llega en el próximo spec.", y no tiene botón "Nuevo artículo".
- [x] `/admin/usuarios` muestra la tabla con las columnas Nombre, Email, Rol, Verificado y Alta y el contador de usuarios.
- [x] `/admin/medios` sube, edita el texto alternativo y borra imágenes igual que antes (`medios.spec.ts`).
- [x] Después de iniciar sesión con `volver=/admin`, el admin llega al Inicio del panel.
- [x] El enlace "Administración" del menú de usuario del sitio sigue llevando a `/admin`.
- [ ] El texto del panel cumple 4.5:1 de contraste sobre su fondo (revisado con `/frontend-design`).

## Decisiones

- **Sí:** este spec es el shell más la migración de Usuarios y Medios. La tabla de artículos y el editor van en specs propios. Elegido por el usuario.
- **No:** incluir el listado real de artículos. Duplica el tamaño del spec y mezcla estructura con funcionalidad.
- **Sí:** grupo de rutas `app/(admin)/` con layout propio, sin header ni footer del sitio. Elegido por el usuario.
- **No:** layout anidado dentro de `(site)`. El header y el footer públicos seguirían rodeando el panel.
- **Sí:** tokens `cms-*` en `@theme inline` con los valores del canvas. Elegido por el usuario.
- **No:** reusar `paper` e `ink`. Los colores no coinciden con el canvas y mezclan el tema público con el del panel.
- **Sí:** el acento del sitio (`#1A66F5`) en lugar del `#2563EB` del canvas. Un solo azul de marca. Elegido por el usuario.
- **Sí:** el login del panel queda fuera. Se usa `/cuenta/login?volver=/admin`. Elegido por el usuario.
- **Sí:** `/admin` es el Inicio del panel, donde después van las métricas. Usuarios pasa a `/admin/usuarios`. Elegido por el usuario.
- **Sí:** el Inicio tiene saludo y tres accesos directos, sin números. Elegido por el usuario.
- **No:** conteos en las tarjetas. Suma consultas a un spec de estructura y se pisa con el de métricas.
- **Sí:** `/admin/articulos` existe con encabezado y estado vacío, sin "Nuevo artículo" hasta que funcione. Elegido por el usuario.
- **Sí:** la barra lateral solo tiene lo que existe. Categorías, SEO y Ajustes se suman con su spec. Elegido por el usuario.
- **No:** ítems deshabilitados con "Próximamente". Son ruido y enlaces muertos.
- **Sí:** la barra superior solo tiene el menú de cuenta. Elegido por el usuario.
- **No:** la campana. No hay notificaciones en la base.
- **Sí:** cajón deslizante debajo de 1024 px. Elegido por el usuario.
- **No:** apilar la barra lateral arriba en móvil, como el canvas. Empuja el contenido una pantalla hacia abajo.
- **Sí:** Medios y Usuarios se re-estilan en claro. Elegido por el usuario.
- **No:** dejar Medios con los estilos oscuros dentro del panel claro.
- **Sí:** cada página sigue llamando a `requireAdmin()` en su `<Suspense>`, y el layout no lee la sesión fuera del menú de cuenta. Es el patrón actual y respeta Cache Components.
- **Sí:** menú de cuenta propio del panel en lugar de `UserMenuDropdown`. El del sitio está pensado para fondo oscuro y no muestra nombre ni rol.
- **Sí:** tests `client` y E2E. Elegido por el usuario.
- **Sí:** las Server Actions van en una carpeta `actions/` en la raíz, separadas de los `.tsx`. Elegido por el usuario.
- **Sí:** se mueven las cuatro, no solo la de Medios. Queda una sola convención en todo el proyecto. Elegido por el usuario.
- **No:** mover solo las del panel. Dejaría dos convenciones conviviendo hasta otro spec.
- **Sí:** una carpeta por área con `index.ts` (`actions/<ruta>/index.ts`). Elegido por el usuario.
- **Sí:** la carpeta replica la URL de la página que usa las actions (`admin/medios`, `cuenta`, `blog`, `blog/comunidad`), sin route groups. Da una regla única para ubicar las actions nuevas y separa las del panel de las públicas.
- **No:** archivos sueltos `actions/<área>.ts`. Elegido por el usuario.
- **Sí:** las actions se mueven sin cambiar su código. Este spec cambia dónde viven, no qué hacen.

## Riesgos

| Riesgo                                                                                                             | Mitigación                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| El shell estático (barra lateral y encabezado) se envía antes de que `requireAdmin()` decida el 404 o el redirect. | El shell no tiene datos, solo enlaces. Los criterios de redirect y 404 verifican las cuatro rutas.                             |
| `color-scheme: dark` del `html` hace oscuros los `select` y `checkbox` nativos del panel.                          | La raíz del panel fija `color-scheme: light`.                                                                                  |
| Mover Medios rompe imports en tests o en otros módulos.                                                            | El paso 4 actualiza `media-grid.test.tsx` y `npx tsc --noEmit` detecta cualquier otro import.                                  |
| Un `vi.mock` que sigue apuntando a la ruta vieja no falla al compilar y el test usa la action real.                | El paso 1 cambia cada `vi.mock` junto con su `import`, y un criterio verifica que ninguno apunte a las rutas viejas.           |
| Un import dinámico o en un string (por ejemplo, en un E2E) no lo detecta `tsc`.                                    | El criterio de `grep` sobre las rutas viejas cubre todo el repo, y los E2E existentes recorren cada action movida.             |
| Los tests E2E que esperan la tabla de usuarios en `/admin` fallan.                                                 | El paso 7 los mueve a `/admin/usuarios` y el enlace a Medios pasa a la barra lateral.                                          |
| El cajón deja el foco o el scroll del `body` bloqueados si se navega con el panel abierto.                         | Elegir un ítem cierra el panel y el efecto restaura el scroll al desmontar. Un criterio verifica que elegir un ítem lo cierra. |

## Qué **no** incluye este spec

- Login propio del panel.
- Tabla de artículos, editor y "Nuevo artículo".
- Categorías, SEO y Ajustes.
- Métricas y conteos en el Inicio.
- Notificaciones.
- Exportar artículos y cambiar roles.
- Barra lateral colapsable en desktop y modo oscuro del panel.

Cada uno de estos, si llega, va en su propio spec.
