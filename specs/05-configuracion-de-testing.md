# SPEC 05 — Configuración de testing

> **Estado:** Aprobado
> **Depende de:** SPEC 03, SPEC 04
> **Fecha:** 2026-11-14
> **Objetivo:** Configurar Vitest (proyectos `client` en jsdom y `server` en node), Playwright para E2E y un workflow de GitHub Actions, con tests de la lógica que ya existe.

## Por qué existe este spec

El proyecto no tiene tests. Los specs 01 a 04 se verificaron a mano.
Lo que viene (cuentas, base de datos y email) suma código de servidor y reglas de seguridad que conviene probar desde el primer commit.
Este spec deja la infraestructura lista y cubre la lógica que ya existe. Así cada spec siguiente solo agrega sus tests.

Next 16 documenta que Vitest no soporta los Server Components `async`, y recomienda E2E para ellos.
Por eso "server" tiene dos capas:

- El proyecto `server` de Vitest (entorno node) para el código de servidor puro: hoy `lib/`, y más adelante server actions, route handlers y acceso a datos.
- Playwright contra `next build` + `next start` para las páginas y el prerender real con `cacheComponents`.

**Referencia:** `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` y `playwright.md`.

## Alcance

**Incluye:**

- Dependencias de desarrollo:
  - `vitest`, `@vitest/coverage-v8`, `@vitejs/plugin-react` y `vite-tsconfig-paths`.
  - `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom` y `@testing-library/user-event`.
  - `@playwright/test`.
- `vitest.config.mts` en la raíz, con dos proyectos (`test.projects`):
  - `client`: entorno `jsdom`, incluye `__tests__/client/**/*.test.{ts,tsx}` y usa el setup `vitest.setup.ts`.
  - `server`: entorno `node`, incluye `__tests__/server/**/*.test.ts`.
  - Los dos usan `vite-tsconfig-paths` para resolver `@/` y `@vitejs/plugin-react` para JSX.
- `vitest.setup.ts`: importa `@testing-library/jest-dom/vitest` y llama a `cleanup()` de Testing Library en `afterEach`.
- `playwright.config.ts` en la raíz:
  - `testDir: "e2e"`, `baseURL: "http://localhost:3100"`.
  - `webServer`: `npm run build && npm run start -- -p 3100`, con `reuseExistingServer: !process.env.CI` y `timeout: 180_000`.
  - Dos proyectos, los dos en Chromium: `desktop` (`devices["Desktop Chrome"]`) y `mobile` (viewport 375×812).
  - `retries: 2` y `forbidOnly: true` en CI. `trace: "on-first-retry"`.
- Scripts en `package.json`:
  - `"test": "vitest"` (modo watch).
  - `"test:run": "vitest run"`.
  - `"test:coverage": "vitest run --coverage"`.
  - `"test:e2e": "playwright test"`.
- Cobertura con `@vitest/coverage-v8`: incluye `lib/**` y `components/**`, reportes `text` y `html` en `/coverage`. Sin umbral mínimo.
- Refactor chico: la validación de `?volver=` sale de `components/auth/back-link.tsx` a `lib/back-href.ts`, como `resolveBackHref`. `BackLink` la usa y su comportamiento no cambia.
- Tests del proyecto `server` (`__tests__/server/`):
  - `back-href.test.ts`: `resolveBackHref` con un slug válido, `null`, URL absoluta, `//otro.com`, `/blog/no-existe` y `/blog/../cuenta`.
  - `blog-posts.test.ts`: `getPost`, `getRatingSummary` (incluido el caso sin reseñas), `formatAverage`, `getRelatedPosts` (misma categoría primero, sin el post actual, respeta `n`) y `formatPostDate`.
  - `services.test.ts`: `getService` con un slug que existe y con uno que no.
- Tests del proyecto `client` (`__tests__/client/`):
  - `password-strength.test.tsx`: `getScore` por cada regla, y `PasswordStrength` con la etiqueta y la cantidad de segmentos activos.
  - `password-input.test.tsx`: el botón alterna el `type` y el `aria-label`.
  - `login-form.test.tsx`: completar email y contraseña y enviar muestra el aviso con `role="status"`. Antes de enviar, el aviso no está.
- Tests E2E (`e2e/`):
  - `navegacion.spec.ts`: home → `/blog` → `/blog/senales-sistema-a-medida` → "Ingresar" de comentarios → `/cuenta/login?volver=/blog/senales-sistema-a-medida` → "Volver al blog" vuelve al artículo.
  - `cuenta.spec.ts`: `/cuenta` redirige a `/cuenta/login`; enviar vacío no muestra el aviso; enviar un login válido muestra el aviso y la URL no cambia; las tres páginas de cuenta tienen `noindex`.
  - `responsive.spec.ts` (solo en el proyecto `mobile`): la home y `/cuenta/login` no tienen scroll horizontal.
  - Cada E2E falla si la página emite un error en la consola.
- `.github/workflows/ci.yml`, en `pull_request` a `main` y en `push` a `main`, con Node 26 y `npm ci`:
  - Job `checks`: `npm run lint`, `npm run test:run` y `npx tsc --noEmit`.
  - Job `e2e`: `npx playwright install --with-deps chromium` y `npm run test:e2e`. Si falla, sube `playwright-report/` como artifact.
- `.gitignore` suma `/playwright-report`, `/test-results` y `/blob-report`. `eslint.config.mjs` los suma a `globalIgnores`, junto con `coverage/**`.
- `README.md` suma una sección "Tests" con los cuatro scripts.

**Fuera de alcance (para specs futuros):**

- Tests de integración contra el Postgres de `docker-compose.yaml`: base de test, variables de entorno y reseteo. Van con el spec de cuentas.
- Tests de envío de email contra Mailpit.
- Firefox y WebKit en Playwright.
- Umbral mínimo de cobertura que haga fallar el CI.
- Tests de regresión visual (screenshots comparados con los artboards).
- Tests de accesibilidad automáticos (axe).
- Tests de los componentes que solo muestran contenido (heros, cards, secciones de la home).
- Mocks de `server-only`, de `next/headers` o de la base: no hay código que los use todavía.
- Deploy desde el CI.

## Modelo de datos

Este spec no agrega datos de dominio ni persistencia.
Solo cambia de lugar una función:

```ts
// lib/back-href.ts
// Solo acepta /blog/{slug} de un artículo que existe: evita un open redirect.
export function resolveBackHref(volver: string | null): string; // "/blog/{slug}" o "/blog"
```

La regla es la misma de SPEC 04: `^/blog/[a-z0-9-]+$` y `getPost(slug)` existe. Cualquier otro valor devuelve `"/blog"`.

Convenciones de los tests:

- `__tests__/client/*.test.tsx` corre en jsdom. Se usa para componentes con `"use client"` o con estado.
- `__tests__/server/*.test.ts` corre en node. Se usa para `lib/` y, más adelante, para actions y route handlers.
- `e2e/*.spec.ts` corre en Playwright contra el build de producción.
- Los tests importan `describe`, `it` y `expect` desde `vitest`. No se activan los `globals`.
- Las consultas de Testing Library usan roles y textos visibles (`getByRole`, `getByLabelText`), no clases de Tailwind.

## Plan de implementación

1. **Vitest base.** Instalar `vitest`, `@vitejs/plugin-react` y `vite-tsconfig-paths`. Crear `vitest.config.mts` con el proyecto `server` y los scripts `test` y `test:run`. Escribir `__tests__/server/services.test.ts`. Prueba: `npm run test:run` pasa.
2. **Refactor de `?volver=`.** Crear `lib/back-href.ts` con `resolveBackHref` y usarla en `components/auth/back-link.tsx`. Escribir `__tests__/server/back-href.test.ts`. Prueba: los tests pasan y `/cuenta/login?volver=/blog/senales-sistema-a-medida` sigue volviendo al artículo.
3. **Tests de `lib/blog-posts.ts`.** Escribir `__tests__/server/blog-posts.test.ts`.
4. **Proyecto `client`.** Instalar `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom` y `@testing-library/user-event`. Crear `vitest.setup.ts` y sumar el proyecto `client` a `vitest.config.mts`. Escribir `__tests__/client/password-strength.test.tsx`. Prueba: `npm run test:run` corre los dos proyectos.
5. **Tests de formularios.** Escribir `__tests__/client/password-input.test.tsx` y `__tests__/client/login-form.test.tsx`.
6. **Cobertura.** Instalar `@vitest/coverage-v8`, configurar `coverage` en `vitest.config.mts` y sumar el script `test:coverage`. Prueba: genera `coverage/index.html`.
7. **Playwright.** Instalar `@playwright/test` y Chromium. Crear `playwright.config.ts`, el script `test:e2e` y `e2e/cuenta.spec.ts`. Sumar las carpetas de reportes a `.gitignore` y a `eslint.config.mjs`. Prueba: `npm run test:e2e` levanta el build y pasa.
8. **E2E de navegación y responsive.** Escribir `e2e/navegacion.spec.ts` y `e2e/responsive.spec.ts`.
9. **CI.** Crear `.github/workflows/ci.yml` con los jobs `checks` y `e2e`.
10. **README.** Sumar la sección "Tests" con los scripts y cómo instalar Chromium (`npx playwright install chromium`).

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores.
- [ ] `npx tsc --noEmit` termina sin errores, incluidos los archivos de test y de configuración.
- [ ] `npm run build` termina sin errores y sigue prerenderizando `/cuenta/login`, `/cuenta/registro` y `/cuenta/recuperar`.
- [ ] `npm run test:run` corre los proyectos `client` y `server`, y todos los tests pasan.
- [ ] Un test de `__tests__/server/` que usa `document` falla con `document is not defined`. Confirma que corre en node.
- [ ] Los tests de `__tests__/client/` usan `toBeInTheDocument` sin importar nada extra.
- [ ] Los imports con `@/` funcionan en los dos proyectos.
- [ ] `npm test` arranca en modo watch.
- [ ] `npm run test:coverage` genera `coverage/index.html` y muestra un resumen en la terminal.
- [ ] `resolveBackHref("/blog/senales-sistema-a-medida")` devuelve esa misma ruta.
- [ ] `resolveBackHref` devuelve `"/blog"` para `null`, `"https://otro.com"`, `"//otro.com"`, `"/blog/no-existe"` y `"/blog/../cuenta"`.
- [ ] `components/auth/back-link.tsx` ya no tiene la regex. Usa `resolveBackHref`.
- [ ] Hay tests de `getPost`, `getRatingSummary`, `formatAverage`, `getRelatedPosts`, `formatPostDate` y `getService`, y pasan.
- [ ] `getScore("abcdefgh")` es 1 y `getScore("Abcdef1!")` es 4 en los tests. `PasswordStrength` vacío muestra "Escribí una contraseña".
- [ ] El test de `PasswordInput` verifica que el `type` pasa de `password` a `text` y el `aria-label` de "Mostrar contraseña" a "Ocultar contraseña".
- [ ] El test de `LoginForm` verifica que el aviso con `role="status"` aparece solo después de enviar.
- [ ] `npm run test:e2e` levanta `next build` + `next start` en el puerto 3100 y corre los proyectos `desktop` y `mobile`.
- [ ] Los E2E de navegación, cuenta y responsive pasan.
- [ ] Un E2E falla si se agrega un `console.error` a una de las páginas que visita.
- [ ] `/playwright-report`, `/test-results` y `/blob-report` están en `.gitignore`, y `git status` queda limpio después de correr todos los scripts.
- [ ] `.github/workflows/ci.yml` corre en un PR a `main`, y los jobs `checks` y `e2e` pasan.
- [ ] Si el job `e2e` falla, el run tiene un artifact con `playwright-report/`.
- [ ] `README.md` explica los cuatro scripts.

## Decisiones

- **Sí:** Vitest. Lo documenta la guía de Next 16, es ESM nativo y resuelve `@/` con `vite-tsconfig-paths`.
- **No:** Jest. Necesita `next/jest` y su soporte de ESM es peor.
- **Sí:** "server" son dos capas: el proyecto `server` de Vitest (node) para código puro, y Playwright para las páginas. Vitest no soporta Server Components `async`.
- **No:** testear Server Components `async` con Vitest. La guía de Next recomienda E2E para eso.
- **Sí:** un solo `vitest.config.mts` con `test.projects`. Un solo comando corre los dos entornos.
- **No:** dos archivos de config de Vitest. Duplica plugins y scripts.
- **Sí:** tests en `__tests__/client/` y `__tests__/server/`, y E2E en `e2e/`. Elegido por el usuario. El entorno sale de la carpeta, sin depender del sufijo.
- **No:** tests al lado del código. Mezcla tests con componentes en `components/` y `lib/`.
- **Sí:** extraer `resolveBackHref` a `lib/back-href.ts`. Es una regla de seguridad contra el open redirect, y como función pura se prueba barato en node.
- **No:** testear `BackLink` mockeando `useSearchParams`. El test queda atado a la API de Next y es más frágil.
- **Sí:** Playwright contra `next build` + `next start`. Prueba el prerender real con `cacheComponents`, que `next dev` no reproduce.
- **No:** Playwright contra `next dev`. Arranca más rápido, pero no prueba el build de producción.
- **Sí:** solo Chromium, con un viewport de escritorio y uno de 375px. Cubre el responsive de los specs anteriores con una sola descarga.
- **No:** Firefox y WebKit. Suman unos 500MB y tiempo de CI sin un problema concreto que resolver.
- **Sí:** puerto 3100 para los E2E. No choca con `next dev` en el 3000.
- **Sí:** `@testing-library/jest-dom` y `user-event`. Los matchers y los clicks realistas hacen los tests más legibles.
- **No:** `globals: true` en Vitest. Los imports explícitos dejan claro de dónde sale cada función y no ensucian los tipos globales.
- **Sí:** cobertura con `@vitest/coverage-v8`, sin umbral. Sirve para ver qué falta, sin bloquear PRs con una cantidad de tests todavía chica.
- **Sí:** GitHub Actions con dos jobs. Lint, tipos y Vitest dan feedback rápido. Los E2E van aparte porque tardan más.
- **Sí:** `npx tsc --noEmit` en CI en lugar de `npm run build` en `checks`. El job `e2e` ya corre el build.
- **Sí:** Node 26 en CI. Coincide con la versión local y es LTS.
- **Sí:** los E2E fallan ante errores de consola. Hace automático el criterio "sin errores en la consola" de los specs 01 a 04.
- **No:** tests contra Postgres ahora. No hay código que use la base. Van con el spec de cuentas.
- **No:** tests de los componentes que solo muestran contenido. Romperían con cada cambio de texto y no prueban lógica.
- **Sí:** nombres de scripts `test`, `test:run`, `test:coverage` y `test:e2e`. Siguen la convención más común con Vitest y Playwright.

## Riesgos

| Riesgo                                                                                               | Mitigación                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `next/link` o `next/navigation` fallan en jsdom sin el router de la app.                             | `LoginForm` solo usa `Link`, que renderiza un `<a>` sin router. Si falla, se mockea `next/navigation` en `vitest.setup.ts`.  |
| jsdom no aplica la validación nativa al enviar, y el test de "enviar vacío" daría un falso positivo. | En Vitest solo se prueba el envío válido. El envío vacío se prueba en Playwright, con un navegador real.                     |
| `npm run build` de los E2E pisa el `.next` de un `next dev` que está corriendo.                      | Next 16 separa `next dev` en `.next/dev`. Si hay conflicto, se usa `distDir` por variable de entorno solo en los E2E.        |
| El build en el `webServer` hace lentos los E2E en local.                                             | `reuseExistingServer` fuera de CI: se puede dejar `next start -p 3100` corriendo y repetir los tests sin rebuild.            |
| Un futuro `import "server-only"` rompe el proyecto `server` de Vitest.                               | Fuera de este spec. El spec que lo agregue suma un alias de `server-only` a un módulo vacío en `vitest.config.mts`.          |
| `formatPostDate` usa `Intl` con `es-AR`, y el formato puede variar entre versiones de ICU de Node.   | El CI usa la misma versión de Node que en local. Si cambia, el test compara contra el formato de esa versión y se documenta. |
| Los tests de `lib/blog-posts.ts` dependen del contenido actual de los posts.                         | Se prueban propiedades (orden por categoría, tamaño, exclusión del post actual) y no textos completos de los posts.          |

## Qué **no** incluye este spec

- Tests contra Postgres y contra Mailpit.
- Firefox y WebKit.
- Umbral mínimo de cobertura.
- Regresión visual y tests de accesibilidad automáticos.
- Tests de componentes que solo muestran contenido.
- Mocks de `server-only`, `next/headers` o la base de datos.
- Deploy desde el CI.

Cada uno de estos, si llega, va en su propio spec.
