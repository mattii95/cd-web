# SPEC 25 — Inicio del panel con estadísticas

> **Estado:** Aprobado
> **Depende de:** SPEC 09, SPEC 14, SPEC 16, SPEC 21, SPEC 23, SPEC 24
> **Fecha:** 2026-11-21
> **Objetivo:** Que el Inicio de `/admin` muestre, para los últimos 7, 30 o 90 días, números clave, gráficos y listas sobre usuarios, comentarios, artículos y valoraciones.

## Por qué existe este spec

Hoy `/admin` es un saludo y cuatro tarjetas que repiten la barra lateral. El admin no tiene dónde ver si el blog crece, cuántos comentarios esperan moderación o qué artículos generan conversación, aunque todo eso ya está en la base.

Tres decisiones marcan el diseño:

- **Solo datos que ya existen.** No se registran visitas. Las estadísticas salen de `user`, `comment`, `post_rating`, `post` y `category` tal cual, sin migraciones.
- **Recharts en componentes cliente, consultas en el servidor.** Cada sección consulta la base en un componente de servidor y le pasa los números ya agregados a un gráfico cliente. Recharts es la única dependencia nueva.
- **Un `<Suspense>` por sección y sin caché.** Cada tarjeta, gráfico y lista carga por su cuenta, como el resto del panel. Los números están siempre al día.

**Referencias:**

- `db/schema/blog.ts` (`post`, `comment`, `post_rating`, `category`, `commentStatus`), `db/schema/auth.ts` (`user`), `db/schema/columns.ts` (`timestamp` sin zona, en UTC).
- `db/admin-users.ts`, `db/admin-comments.ts` (`countPendingComments`) y `lib/admin/comment-params.ts` como modelo de consultas y parámetros.
- `app/(admin)/admin/page.tsx` (actual), `app/(admin)/admin/articles/status-tabs.tsx` como modelo de pestañas, `components/admin/page-header.tsx`, `components/auth/user-avatar.tsx`, `lib/format-date.ts` (zona `America/Argentina/Buenos_Aires`).
- `node_modules/next/dist/docs/01-app/` sobre `searchParams` como promesa y Cache Components.
- Documentación de Recharts 3 (`ResponsiveContainer`, `LineChart`, `PieChart`, `BarChart`).

## Alcance

**Incluye:**

- **Página (`app/(admin)/admin/page.tsx`, reescrita):**
  - `AdminPageHeader` "Inicio" con la descripción "Cómo vienen el blog y la comunidad.". El saludo "Hola, {nombre}" se queda.
  - Se quitan las cuatro tarjetas de accesos (Artículos, Medios, Comentarios, Usuarios).
  - Orden: selector de período, fila de 4 KPIs, gráfico de actividad (ancho completo), fila con "Comentarios por estado" y "Distribución de estrellas", fila con "Artículos por categoría" y "Top artículos", fila con "Pendientes más viejos" y "Últimos registrados".
  - `requireAdmin()` antes de leer la base. Cada sección lee `searchParams` y la base dentro de su propio `<Suspense>` con un esqueleto del mismo alto que el contenido final.

- **Selector de período (`period-tabs.tsx`, como `status-tabs.tsx`):**
  - Enlaces "7 días", "30 días" y "90 días", con `aria-current="page"` en el activo.
  - Estado en la URL: `/admin?periodo=7`. "30 días" es el valor por defecto y no va en la URL. Un `periodo` inválido cae a 30.
  - **Rango del período:** desde las 00:00 (hora de Buenos Aires) de hace `periodo − 1` días hasta ahora. **Período anterior:** los `periodo` días completos justo antes.
  - Los KPIs de total ("Usuarios", "Publicados"), los pendientes, "Artículos por categoría" y las listas de pendientes y registrados no dependen del período; su encabezado lo dice ("En total", "Ahora").

- **KPIs (`kpi-cards.tsx`, servidor):**

  | Tarjeta      | Número grande                                 | Debajo                                                                         | Enlace            |
  | ------------ | --------------------------------------------- | ------------------------------------------------------------------------------ | ----------------- |
  | Usuarios     | Total de usuarios                             | "+{N} en el período" y la variación de altas                                   | `/admin/users`    |
  | Comentarios  | Comentarios creados en el período             | Variación y "{N} pendientes" (en total, enlace a `/admin/comments`)            | `/admin/comments` |
  | Artículos    | Publicados en total                           | "+{N} publicados en el período" (`published_at`), variación y "{N} borradores" | `/admin/articles` |
  | Valoraciones | Promedio del período con un decimal ("4,3 ★") | "{N} valoraciones" en el período y su variación                                | Sin enlace        |
  - **Variación** contra el período anterior: `round((actual − anterior) / anterior × 100)`.
    - Mayor a 0: "↑ {pct} %"; menor: "↓ {pct} %"; igual: "Sin cambios"; anterior 0 y actual > 0: "Nuevo"; ambos 0: "Sin cambios".
    - Nombre accesible: "{pct} % más que los {periodo} días anteriores" / "menos" / "Sin cambios respecto de los {periodo} días anteriores" / "Sin datos en los {periodo} días anteriores".
    - Sube = verde y baja = gris neutro (no rojo: menos comentarios no es un error).
  - Sin valoraciones en el período, el promedio es "—" y debajo "Sin valoraciones en el período".

- **Gráficos (Recharts, componentes cliente en `app/(admin)/admin/_inicio/charts/`):**
  - Cada gráfico es un `<figure>` con `<figcaption>` (el título) y una tabla `sr-only` con los mismos datos. El SVG lleva `aria-hidden`.
  - Altura fija (280 px; 240 por debajo de `md`) dentro de `ResponsiveContainer`, para que no salte el layout.
  - Tooltip al pasar el mouse o tocar, con los valores del punto.
  - Colores desde los tokens `cms-*` (series nuevas en `app/globals.css` si hace falta), con 3:1 contra el fondo del panel.
  - Sin datos en el período, en lugar del gráfico se muestra el texto de la tabla de estados vacíos.

  | Gráfico                     | Componente                 | Tipo                         | Datos                                                                                                    |
  | --------------------------- | -------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
  | "Actividad"                 | `activity-chart.tsx`       | Líneas, 3 series con leyenda | Altas de usuarios, comentarios creados (todo estado) y valoraciones creadas, por tramo del período.      |
  | "Comentarios por estado"    | `comment-status-chart.tsx` | Dona con el total al centro  | Comentarios creados en el período por estado: Pendientes, Aprobados, Ocultos. Leyenda con cantidades.    |
  | "Distribución de estrellas" | `rating-chart.tsx`         | Barras horizontales 5★ a 1★  | Valoraciones creadas en el período por estrella.                                                         |
  | "Artículos por categoría"   | `category-chart.tsx`       | Barras horizontales          | Publicados por categoría, en total (no depende del período). Todas las categorías por `position`, con 0. |
  - **Tramos de "Actividad":** con 7 y 30 días, un punto por día (etiqueta "21 nov"). Con 90 días, un punto por semana que empieza el lunes; la primera y la última pueden ser parciales (etiqueta "Sem. 17 nov"). Los tramos sin datos van con 0.
  - Los días y semanas se cortan en hora de Buenos Aires.

- **Listas (servidor):**
  - **"Top artículos" (`top-posts.tsx`):** los 5 artículos `publicado` con más comentarios `aprobado` + valoraciones creados en el período. Desempata el promedio de estrellas del período (más alto primero) y después el título. Se excluyen los de suma 0. Columnas: título (enlace a `/admin/articles/{id}/edit`), comentarios, valoraciones y promedio ("—" sin valoraciones). Por debajo de `md` cada fila pasa a tarjeta.
  - **"Pendientes más viejos" (`oldest-pending.tsx`):** los 5 comentarios `pendiente` más viejos, de cualquier fecha. Nombre del autor, título del artículo, texto recortado a 120 caracteres con "…" (texto plano) y `formatDate(createdAt)`. Pie "Ver todos los pendientes" → `/admin/comments`.
  - **"Últimos registrados" (`newest-users.tsx`):** los 5 usuarios más nuevos. `UserAvatar`, nombre, email y `formatDate(createdAt)`; cada fila enlaza a `/admin/users?q={email}`. Pie "Ver todos los usuarios" → `/admin/users`.

- **Estados vacíos:**

  | Sección                   | Texto                                                               |
  | ------------------------- | ------------------------------------------------------------------- |
  | Actividad                 | "No hubo actividad en este período."                                |
  | Comentarios por estado    | "No hubo comentarios en este período."                              |
  | Distribución de estrellas | "No hubo valoraciones en este período."                             |
  | Artículos por categoría   | "Todavía no hay artículos publicados."                              |
  | Top artículos             | "Ningún artículo tuvo comentarios ni valoraciones en este período." |
  | Pendientes más viejos     | "No hay comentarios pendientes."                                    |
  | Últimos registrados       | "Todavía no hay usuarios."                                          |

- **Errores:** si la consulta de una sección falla, esa sección muestra "No pudimos cargar estos datos." y el resto de la página sigue funcionando (un `error.tsx` no alcanza: el fallo se atrapa en el componente de la sección y se registra con `console.error`).

- **Consultas (`db/admin-dashboard.ts`, nuevo, `server-only`, sin caché):** firmas en el modelo de datos. Agregan en SQL (`count`, `avg`, `date_trunc` con `AT TIME ZONE`), nunca traen filas sueltas para contar en JS.

- **Diseño:** selector, KPIs, gráficos, listas, esqueletos y estados vacíos se hacen con `/frontend-design`, siguiendo los tokens `cms-*` del panel. Todos los controles miden 44 px o más y los textos cumplen 4.5:1 de contraste. A 390 px no hay scroll horizontal: las filas de dos columnas pasan a una.

- **Dependencia:** `recharts` en versión exacta `3.10.1` (no `^`).

- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `__tests__/server/dashboard-params.test.ts`, nuevo.
  - Vitest `db`: `__tests__/db/admin-dashboard.test.ts`, nuevo.
  - Vitest `client`: `__tests__/client/kpi-cards.test.tsx`, `__tests__/client/period-tabs.test.tsx` y `__tests__/client/dashboard-charts.test.tsx`, nuevos.
  - Playwright: `e2e/inicio.spec.ts`, nuevo; `admin.spec.ts` borra el caso "Inicio: saludo y cuatro accesos directos".

**Fuera de alcance (para specs futuros):**

- Visitas, páginas vistas, fuentes de tráfico y cualquier medición en el blog público.
- Rango de fechas libre, comparar contra el mismo período del año anterior y períodos mayores a 90 días.
- Exportar datos (CSV, PDF) e imprimir.
- Estadísticas por artículo en su propia página o en el editor.
- Métricas de medios (espacio en disco, imágenes sin usar).
- Gráficos en tiempo real o con refresco automático.
- Accesos rápidos a acciones ("Nuevo artículo", "Subir medio").
- Caché de las consultas y tablas de agregados precalculados.

## Modelo de datos

No hay tablas, columnas, índices ni migraciones nuevas. Se usan `user`, `comment`, `post_rating`, `post` y `category` tal cual.

```ts
// lib/admin/dashboard-params.ts (nuevo)
export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];
export const DEFAULT_PERIOD: DashboardPeriod = 30;
export const DASHBOARD_TIME_ZONE = "America/Argentina/Buenos_Aires";
export type DashboardQuery = { periodo: DashboardPeriod };
export function parseDashboardParams(
  params: Record<string, string | string[] | undefined>,
): DashboardQuery;
export function dashboardHref(query: DashboardQuery): string; // "/admin" o "/admin?periodo=7"

export type DashboardRange = {
  period: DashboardPeriod;
  from: Date; // 00:00 Buenos Aires de hace period − 1 días
  to: Date; // ahora
  prevFrom: Date; // from − period días; el anterior es [prevFrom, from)
  bucket: "day" | "week"; // "week" solo con 90
};
export function dashboardRange(
  period: DashboardPeriod,
  now?: Date,
): DashboardRange;
export function bucketKeys(range: DashboardRange): string[]; // "YYYY-MM-DD" de cada día o lunes, en orden
export function bucketLabel(key: string, bucket: "day" | "week"): string; // "21 nov" / "Sem. 17 nov"

export type Change =
  | { kind: "up" | "down"; pct: number }
  | { kind: "same" }
  | { kind: "new" };
export function percentChange(current: number, previous: number): Change;

// db/admin-dashboard.ts (nuevo, "server-only", sin caché)
export type PeriodCount = { current: number; previous: number };
export type DashboardKpis = {
  users: { total: number; signups: PeriodCount };
  comments: { created: PeriodCount; pending: number };
  posts: { published: number; drafts: number; publishedInPeriod: PeriodCount };
  ratings: { count: PeriodCount; average: number | null }; // average del período actual
};
export async function getDashboardKpis(
  range: DashboardRange,
): Promise<DashboardKpis>;

export type ActivityPoint = {
  key: string;
  users: number;
  comments: number;
  ratings: number;
};
export async function getActivitySeries(
  range: DashboardRange,
): Promise<ActivityPoint[]>;
// un punto por cada bucketKeys(range), con 0 donde no hubo datos

export async function getCommentStatusBreakdown(
  range: DashboardRange,
): Promise<Record<CommentStatus, number>>;
export async function getRatingDistribution(
  range: DashboardRange,
): Promise<{ stars: 1 | 2 | 3 | 4 | 5; count: number }[]>; // siempre 5 filas, de 5 a 1
export async function getPublishedByCategory(): Promise<
  { id: string; label: string; count: number }[]
>; // todas las categorías, por position

export type TopPost = {
  id: string;
  title: string;
  comments: number; // aprobados en el período
  ratings: number; // creadas en el período
  average: number | null;
};
export async function getTopPosts(
  range: DashboardRange,
  limit?: number,
): Promise<TopPost[]>; // 5

export type PendingPreview = {
  id: string;
  text: string; // ya recortado a 120 + "…"
  createdAt: Date;
  author: { name: string };
  post: { title: string };
};
export async function getOldestPendingComments(
  limit?: number,
): Promise<PendingPreview[]>; // 5

export type NewUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
};
export async function getNewestUsers(limit?: number): Promise<NewUser[]>; // 5
```

Archivos nuevos:

- `app/(admin)/admin/_inicio/`: `period-tabs.tsx`, `kpi-cards.tsx`, `top-posts.tsx`, `oldest-pending.tsx`, `newest-users.tsx`, `section-card.tsx` (marco común con título, error y vacío) y `skeletons.tsx`.
- `app/(admin)/admin/_inicio/charts/`: `activity-chart.tsx`, `comment-status-chart.tsx`, `rating-chart.tsx`, `category-chart.tsx` (cliente) y `chart-figure.tsx` (`<figure>` + tabla `sr-only`).
- `db/admin-dashboard.ts`, `lib/admin/dashboard-params.ts`.

Archivos que cambian: `app/(admin)/admin/page.tsx`, `app/globals.css` (colores de series, si hacen falta), `package.json` y `package-lock.json` (`recharts`), `e2e/admin.spec.ts`.

Convenciones:

- Las columnas `timestamp` guardan UTC. Para agrupar por día o semana se usa `date_trunc(…, col AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')`.
- Los límites del período se calculan una vez en `dashboardRange` y se pasan a todas las consultas; ninguna consulta llama a `now()`.
- Los gráficos reciben datos planos y serializables (sin `Date`); las fechas viajan como claves `"YYYY-MM-DD"`.
- El texto de los comentarios se muestra como texto plano.

## Plan de implementación

1. **Parámetros y rango.** `lib/admin/dashboard-params.ts` con `dashboard-params.test.ts`. Prueba: `npm run test:run` pasa.
2. **Consultas.** `db/admin-dashboard.ts` con las ocho funciones y `admin-dashboard.test.ts` (datos con `createdAt` controlado). Prueba: `npm run test:db` pasa.
3. **Esqueleto de la página.** `page.tsx` reescrita con cabecera, saludo, `period-tabs.tsx`, `section-card.tsx`, `skeletons.tsx` y un `<Suspense>` por sección con su esqueleto; se quitan los accesos y el caso de `admin.spec.ts`. Diseño con `/frontend-design`. `period-tabs.test.tsx`. Prueba: `npm run test:run` pasa y `npm run build` sin `DATABASE_URL` pasa.
4. **KPIs.** `kpi-cards.tsx` con variaciones y enlaces. Diseño con `/frontend-design`. `kpi-cards.test.tsx`. Prueba: `npm run test:run` pasa y a mano los números coinciden con el seed.
5. **Gráficos.** Instalar `recharts@3.10.1`, `chart-figure.tsx` y los cuatro gráficos con tabla `sr-only`, tooltip y estado vacío. Diseño con `/frontend-design`. `dashboard-charts.test.tsx`. Prueba: `npm run test:run` y `npm run build` pasan, y a mano se ven los gráficos con 7, 30 y 90 días.
6. **Listas.** `top-posts.tsx`, `oldest-pending.tsx` y `newest-users.tsx` con estados vacíos y manejo de error por sección. Diseño con `/frontend-design`. Prueba: `npm run test:run` pasa y a mano las listas enlazan bien.
7. **E2E.** `e2e/inicio.spec.ts`. Prueba: `npm run test:e2e` pasa completo.

## Criterios de aceptación

**General**

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa completo.
- [ ] No hay migraciones nuevas: `npm run db:generate` no crea archivos.
- [ ] `package.json` suma solo `recharts` con la versión exacta `3.10.1`.

**Parámetros (`dashboard-params.test.ts`)**

- [ ] `parseDashboardParams({})` devuelve `{ periodo: 30 }`; `"7"` y `"90"` se respetan; `"15"`, `"abc"` y `["7", "90"]` caen a 30.
- [ ] `dashboardHref({ periodo: 30 })` devuelve `/admin`; `{ periodo: 7 }`, `/admin?periodo=7`.
- [ ] `dashboardRange(7, new Date("2026-11-21T15:00:00Z"))` da `from` = `2026-11-15T03:00:00Z`, `prevFrom` = `2026-11-08T03:00:00Z` y `bucket: "day"`.
- [ ] `dashboardRange(30, new Date("2026-11-21T01:00:00Z"))` (20/11 a las 22:00 en Buenos Aires) toma el 20/11 como último día.
- [ ] `bucketKeys` devuelve 7 claves con 7, 30 con 30, y con 90 una clave por lunes, la primera ≤ `from`.
- [ ] `bucketLabel("2026-11-21", "day")` es "21 nov"; `bucketLabel("2026-11-17", "week")` es "Sem. 17 nov".
- [ ] `percentChange(12, 10)` es `{ kind: "up", pct: 20 }`; `(5, 10)` es `{ kind: "down", pct: 50 }`; `(3, 3)` y `(0, 0)` son `same`; `(4, 0)` es `new`.

**Consultas (`admin-dashboard.test.ts`)**

- [ ] `getDashboardKpis` cuenta altas, comentarios y valoraciones dentro de `[from, to]` en `current` y dentro de `[prevFrom, from)` en `previous`; un dato justo en `from` cuenta en el actual y uno 1 ms antes, en el anterior.
- [ ] `posts.publishedInPeriod` usa `published_at`; `posts.published` y `posts.drafts` cuentan todo, sin período.
- [ ] `comments.pending` cuenta todos los `pendiente`, de cualquier fecha.
- [ ] `ratings.average` es el promedio del período actual, y `null` sin valoraciones.
- [ ] `getActivitySeries` devuelve un punto por cada `bucketKeys(range)`, con 0 en los vacíos, y suma comentarios de los tres estados.
- [ ] Un comentario creado `2026-11-21T02:00:00Z` cae en el día `2026-11-20` (hora de Buenos Aires).
- [ ] Con 90 días, dos comentarios del lunes y del domingo de la misma semana caen en el mismo punto.
- [ ] `getCommentStatusBreakdown` devuelve las tres claves, con 0 en las que no hay, y solo cuenta el período.
- [ ] `getRatingDistribution` devuelve siempre 5 filas de 5 a 1.
- [ ] `getPublishedByCategory` devuelve todas las categorías por `position`, con 0 en las vacías, y no cuenta borradores.
- [ ] `getTopPosts` ordena por comentarios aprobados + valoraciones del período, desempata por promedio y título, excluye borradores, comentarios no aprobados y artículos con suma 0, y devuelve como máximo 5.
- [ ] `getOldestPendingComments` devuelve los 5 pendientes más viejos y recorta el texto a 120 caracteres con "…".
- [ ] `getNewestUsers` devuelve los 5 usuarios más nuevos.

**Componentes (`client`)**

- [ ] `PeriodTabs` con `periodo: 30` marca "30 días" con `aria-current="page"`; "7 días" enlaza a `/admin?periodo=7` y "30 días" a `/admin`.
- [ ] `KpiCards` muestra "↑ 20 %" con el nombre accesible "20 % más que los 30 días anteriores", "Nuevo" con anterior 0, y "—" de promedio sin valoraciones.
- [ ] `KpiCards` muestra "{N} pendientes" con enlace a `/admin/comments`.
- [ ] Cada gráfico renderiza un `figure` con su `figcaption` y una tabla con los mismos valores que recibió.
- [ ] Cada gráfico sin datos muestra su texto de estado vacío y no renderiza la tabla.

**Inicio (E2E, `inicio.spec.ts`)**

- [ ] Como admin, `/admin` muestra "Hola, {nombre}", el selector con "30 días" activo, las 4 tarjetas de KPI, los 4 gráficos por su título y las 3 listas; ya no están las tarjetas de accesos.
- [ ] Elegir "7 días" deja la URL en `/admin?periodo=7` con "7 días" activo; recargar lo mantiene. `/admin?periodo=15` muestra "30 días" activo.
- [ ] Un lector comenta un artículo; al volver a `/admin`, el KPI de pendientes sube en 1.
- [ ] "Ver todos los pendientes" lleva a `/admin/comments`; una fila de "Últimos registrados" lleva a `/admin/users?q={email}`; un título de "Top artículos" lleva a su editor.
- [ ] Sin sesión, `/admin` redirige a `/cuenta/login`; con un lector, da 404.
- [ ] A 390 px no hay scroll horizontal y las secciones quedan en una columna.
- [ ] El selector, los KPIs, las leyendas y las listas cumplen 4.5:1 de contraste y sus controles miden 44 px o más (revisado con `/frontend-design`).

## Decisiones

- **Sí:** KPIs de usuarios, comentarios, artículos y valoraciones. Elegido por el usuario.
- **No:** visitas. Elegido por el usuario. Hoy no se registran; medirlas abre privacidad, bots y volumen, y va en su propio spec.
- **Sí:** Recharts. Elegido por el usuario. Tooltips, leyendas y escalas sin escribirlas a mano.
- **No:** SVG propio. Menos dependencias, pero cada gráfico (dona, ejes, tooltip) se reescribiría desde cero.
- **Sí:** `recharts` en versión exacta. Una actualización menor puede cambiar el render de los gráficos sin que nadie lo note.
- **Sí:** selector de 7, 30 y 90 días en la URL, 30 por defecto, con variación contra el período anterior del mismo largo. Elegido por el usuario.
- **Sí:** los cuatro gráficos: actividad, comentarios por estado, estrellas y artículos por categoría. Elegido por el usuario.
- **Sí:** con 90 días, actividad por semana. Elegido por el usuario. 90 puntos diarios son ruido.
- **Sí:** cortar días y semanas en hora de Buenos Aires. Es la zona de `formatDate`; cortar en UTC corre 3 horas los comentarios de la noche.
- **Sí:** listas de top artículos, pendientes más viejos y últimos registrados. Elegido por el usuario.
- **Sí:** el top ordena por comentarios aprobados + valoraciones del período. Elegido por el usuario. Los comentarios ocultos o pendientes no reflejan interés real.
- **Sí:** se quitan las tarjetas de accesos. Elegido por el usuario. La barra lateral y los KPIs ya llevan a cada sección.
- **Sí:** un `<Suspense>` por sección. Elegido por el usuario. Lo rápido aparece primero y un fallo no tumba la página.
- **Sí:** sin caché, como el resto del panel. Elegido por el usuario. Los volúmenes son chicos y los números quedan al día después de moderar.
- **Sí:** tabla `sr-only` en cada gráfico. Un SVG no es legible para lectores de pantalla, y la tabla deja testear los datos sin depender del tamaño del SVG en jsdom.
- **Sí:** bajar en un KPI se pinta neutro, no rojo. Menos actividad en una semana no es un error.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.

## Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                                        |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leer `searchParams` o la base fuera de `<Suspense>` rompe el build con Cache Components.    | Cada sección lee dentro de su `<Suspense>`; el build sin `DATABASE_URL` lo prueba.                                                                |
| `ResponsiveContainer` mide 0 en jsdom y en el render del servidor, y el gráfico no aparece. | Los tests de cliente verifican la tabla `sr-only`, no el SVG. El contenedor tiene altura fija y el E2E chequea que el SVG se vea en el navegador. |
| La sesión de Postgres no está en UTC y los días se corren.                                  | Se convierte con `AT TIME ZONE 'UTC' AT TIME ZONE '…'` explícito; test `db` con un comentario de las 02:00 UTC.                                   |
| Recharts suma peso al JS del panel.                                                         | Solo se importa en los componentes de `_inicio/charts/`, que cargan únicamente en `/admin`.                                                       |
| Recharts no es compatible con React 19.3 o rompe con una versión nueva.                     | Su `peerDependencies` acepta React 19; versión exacta `3.10.1`; el build y el E2E lo validan.                                                     |
| Las consultas de agregados se vuelven lentas con mucho historial.                           | Los volúmenes son chicos y cada consulta filtra por período. Índices o agregados precalculados irían en otro spec.                                |
| El texto de un comentario con HTML rompe la lista de pendientes.                            | Se muestra como texto plano y recortado, como en `/admin/comments`.                                                                               |
| El E2E depende de números exactos del seed y falla cuando el seed cambia.                   | El E2E compara diferencias (el KPI de pendientes sube en 1), no valores absolutos.                                                                |

## Qué **no** incluye este spec

- Visitas y analítica del blog público.
- Rango de fechas libre y períodos mayores a 90 días.
- Exportar o imprimir.
- Estadísticas por artículo.
- Métricas de medios.
- Refresco automático.
- Accesos rápidos a acciones.
- Caché y agregados precalculados.

Cada uno de estos, si llega, va en su propio spec.
