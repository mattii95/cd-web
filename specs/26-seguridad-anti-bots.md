# SPEC 26 — Seguridad contra ataques y bots

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 07, SPEC 08, SPEC 14
> **Fecha:** 2026-11-21
> **Objetivo:** Endurecer el sitio con headers de seguridad, Cloudflare Turnstile en los formularios de cuenta y rate limit por IP real en las acciones públicas y de comunidad.

## Por qué existe este spec

Hoy el sitio tiene una sola defensa: el rate limit de `lib/auth/rate-limit.ts` en login, registro, envío de enlaces y creación de comentarios. Le faltan tres cosas:

- **Headers de seguridad.** No hay CSP, HSTS ni `frame-ancestors`. El sitio se puede meter en un iframe ajeno (clickjacking) y un XSS no tiene ningún freno del navegador.
- **Nada distingue a una persona de un bot.** Un script puede crear cuentas, mandar mails de verificación o de recuperación a terceros y probar contraseñas filtradas a la velocidad que le permita el rate limit. Peor: `/api/auth/sign-up/email` y los demás endpoints HTTP de email siguen abiertos aunque los formularios usen Server Actions, así que cualquier captcha que se ponga en el formulario se puede saltear por ahí.
- **La IP es falsificable o compartida.** `isRateLimited` lee el primer valor de `x-forwarded-for`, que el cliente controla, y sin proxy todos caen en el bucket `"local"`. El hosting todavía no está decidido.

Tres decisiones marcan el diseño:

- **CSP estática en `next.config.ts`, sin nonce.** Con `cacheComponents` y `partialPrefetching`, una CSP con nonce obliga a renderizar todas las páginas por request y se pierde el HTML prerenderizado. Se acepta `'unsafe-inline'` en scripts a cambio de mantener el modelo de caché.
- **Turnstile se verifica en las Server Actions, no con el plugin `captcha` de Better Auth.** El plugin actúa solo en `onRequest` del handler HTTP, y las actions llaman a `auth.api` directo, así que no lo atraviesan. Los endpoints HTTP de email se cierran con `disabledPaths`, que también actúa solo en el router HTTP y no afecta a `auth.api`.
- **La IP sale de un header configurable.** `TRUSTED_IP_HEADER` nombra el único header confiable según el hosting que se elija. La misma regla la usan nuestras actions y Better Auth.

**Referencias:**

- `lib/auth/rate-limit.ts` (`RULES`, `hit`, `isRateLimited`, `isUserRateLimited`), `lib/auth/auth.ts` (opciones de Better Auth), `lib/auth/env.ts` (patrón de env perezoso con Zod).
- `actions/cuenta/index.ts` (`signInAction`, `signUpAction`, `requestResetAction`, `resendVerificationAction`, `limited`, `MSG`), `actions/blog/index.ts`, `actions/blog/comunidad/index.ts`.
- `components/auth/auth-form.tsx`, `login-form.tsx`, `register-form.tsx`, `recover-form.tsx`, `verify-view.tsx`.
- `proxy.ts`, `next.config.ts`.
- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` (CSP sin nonce, `'unsafe-eval'` en desarrollo).
- `node_modules/better-auth/dist/api/index.mjs` (`disabledPaths` en `onRequest`), `node_modules/@better-auth/core/dist/utils/ip.mjs` (`advanced.ipAddress.ipAddressHeaders`).
- Documentación de Cloudflare Turnstile (render explícito, `siteverify`, claves de prueba).

## Alcance

**Incluye:**

- **Headers de seguridad (`lib/security/headers.ts` + `headers()` en `next.config.ts`):** se aplican a todas las rutas (`source: "/:path*"`).
  - `Content-Security-Policy`:
    - `default-src 'self'`
    - `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`, más `'unsafe-eval'` solo en desarrollo.
    - `style-src 'self' 'unsafe-inline'` (los gráficos y varios componentes usan `style={…}`).
    - `img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com`
    - `font-src 'self'`, `connect-src 'self'`, `frame-src https://challenges.cloudflare.com`
    - `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`
    - `form-action 'self' https://accounts.google.com https://github.com https://login.microsoftonline.com` (los formularios de OAuth sin JavaScript redirigen al proveedor).
    - `upgrade-insecure-requests` solo en producción.
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` solo en producción. Sin `preload`.
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`.
  - `poweredByHeader: false` en `next.config.ts`.
  - La política se arma en una función pura `securityHeaders(isProd: boolean)` para poder testearla.

- **IP real del cliente (`lib/security/client-ip.ts`):**
  - `getClientIp(headers: Headers): string` lee el header de `TRUSTED_IP_HEADER` (`x-forwarded-for`, `x-real-ip` o `cf-connecting-ip`).
  - Para `x-forwarded-for` toma el **último** valor de la lista (el que agregó el proxy propio), no el primero.
  - Sin `TRUSTED_IP_HEADER`, o sin valor en el header, devuelve `"local"`.
  - Sin `TRUSTED_IP_HEADER` en producción, se loguea una sola vez `console.warn("TRUSTED_IP_HEADER no está configurado: el rate limit por IP comparte un único bucket")`. La app arranca igual.
  - `isRateLimited` en `lib/auth/rate-limit.ts` pasa a usar `getClientIp`.
  - En `lib/auth/auth.ts`, si hay `TRUSTED_IP_HEADER`, se pasa como `advanced.ipAddress.ipAddressHeaders: [TRUSTED_IP_HEADER]`.

- **Turnstile (servidor, `lib/security/turnstile.ts` y `lib/security/env.ts`):**
  - Variables: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`.
  - Fuera de producción, si faltan, se usan las claves de prueba oficiales que siempre pasan (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`).
  - En producción, si falta alguna, `getTurnstileEnv()` lanza un error claro en la primera verificación. Es perezoso como `getAuthEnv`, así que el build no las necesita.
  - `verifyTurnstile(token: string, ip: string): Promise<boolean>` hace `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` con `secret`, `response` y `remoteip` (este último se omite si la IP es `"local"`).
    - Timeout de 5 s con `AbortSignal.timeout`.
    - **Falla cerrado:** un token vacío, un `success: false`, un timeout, un error de red o un status distinto de 200 devuelven `false`. Los errores de red y de timeout se loguean con `console.error`.

- **Turnstile (cliente, `components/auth/turnstile.tsx`):**
  - Componente cliente que carga `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` una sola vez y renderiza el widget con `turnstile.render` dentro del `<form>`.
  - El widget agrega el input oculto `cf-turnstile-response`, que viaja en el `FormData`.
  - Avisa a `AuthForm` cuándo hay token (`callback`) y cuándo deja de haberlo (`expired-callback`, `error-callback`).
  - Expone `reset()`. `AuthForm` lo llama cada vez que la action devuelve `status: "error"`, porque un token se puede usar una sola vez.
  - Tema oscuro (`theme: "dark"`), tamaño `flexible`, idioma `es`.

- **Turnstile en los formularios:**
  - `AuthForm` recibe una prop `captcha?: boolean`. Si es `true`, monta `<Turnstile>` antes de `FormMessage` y deshabilita el botón de submit mientras no haya token.
  - Llevan `captcha`: login (`login-form.tsx`), registro (`register-form.tsx`), recuperar contraseña (`recover-form.tsx`) y reenviar verificación (`verify-view.tsx`).
  - En `actions/cuenta/index.ts`, `signInAction`, `signUpAction` y `sendLink` (usada por `requestResetAction` y `resendVerificationAction`) verifican el token **después** del rate limit y **antes** de validar con Zod. Si falla, devuelven `error(MSG.captcha)` con `MSG.captcha = "No pudimos verificar que no sos un bot. Probá de nuevo."`.
  - Login con proveedores, nueva contraseña, comentarios y respuestas **no** llevan Turnstile.

- **Endpoints HTTP de email cerrados (`lib/auth/auth.ts`):**
  - `disabledPaths: ["/sign-in/email", "/sign-up/email", "/request-password-reset", "/send-verification-email"]`. Responden 404 por HTTP y siguen funcionando desde `auth.api`.
  - Las entradas de esos paths en `rateLimit.customRules` se quitan, porque nadie llega a ellos por HTTP. Se queda `/sign-in/social`.

- **Rate limit nuevo (`RULES` en `lib/auth/rate-limit.ts`):**
  - Por usuario, en `actions/blog/comunidad/index.ts`:
    - `rate` 20 / 60 s en `rateAction`
    - `vote` 60 / 60 s en `toggleVoteAction`
    - `reply` 10 / 600 s en `saveReplyAction`
    - `delete-content` 20 / 60 s en `deleteCommentAction` y `deleteReplyAction`
  - Por IP, en `actions/blog/index.ts` y `loadMoreUserCommentsAction`:
    - `load-more` 60 / 60 s en `loadMorePostsAction`, `loadMoreCommentsAction` y `loadMoreUserCommentsAction`.
  - Al pasarse, cada action devuelve su `{ status: "error", message }` de siempre con el mensaje `"Demasiadas acciones seguidas. Probá de nuevo en un minuto."`.
  - Si la base falla al contar, se deja pasar, como ya hace `limited` en `actions/cuenta`.

- **`app/robots.ts`:** `User-agent: *` con `Allow: /` y `Disallow: /admin`, `/cuenta`, `/api`. Sin sitemap.

- **Documentación:** `.env.example` suma `TRUSTED_IP_HEADER`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`, con un comentario sobre qué valor de IP corresponde a cada hosting y sobre las claves de prueba.

- **Tests:** `server`, `db`, `client` y E2E (detalle en los criterios de aceptación).

**Fuera de alcance (para specs futuros):**

- 2FA para admins, chequeo de contraseñas filtradas (HIBP) y bloqueo de cuenta tras N fallos ("endurecer cuentas").
- CSP con nonce o con hashes (SRI) y `report-uri` / `report-to`.
- HSTS `preload`.
- Rate limit en las acciones de admin y en `/media/[id]`.
- Turnstile en comentarios, respuestas y login con proveedores.
- Bloquear crawlers de IA en `robots.txt` y el sitemap (spec de SEO).
- WAF, bot fight mode y configuración del hosting o del reverse proxy.
- Limpieza periódica de filas viejas de la tabla `rate_limit`.
- Cerrar `/reset-password` y `/sign-in/social` por HTTP.

## Modelo de datos

Este spec no agrega tablas ni migraciones. Reusa `rate_limit` (SPEC 07) con claves nuevas.

```ts
// lib/auth/rate-limit.ts
const RULES = {
  "sign-in": { max: 5, window: 60 },
  "sign-up": { max: 3, window: 60 },
  "request-reset": { max: 3, window: 60 },
  "send-verification": { max: 3, window: 60 },
  "sign-in-social": { max: 10, window: 60 },
  comment: { max: 5, window: 600 },
  // nuevas
  rate: { max: 20, window: 60 },
  vote: { max: 60, window: 60 },
  reply: { max: 10, window: 600 },
  "delete-content": { max: 20, window: 60 },
  "load-more": { max: 60, window: 60 },
} as const;
// Claves: `actions|{ip}|{regla}` y `actions|user:{userId}|{regla}` (sin cambios).

// lib/security/env.ts
const TRUSTED_IP_HEADERS = [
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
] as const;
type TrustedIpHeader = (typeof TRUSTED_IP_HEADERS)[number];

type TurnstileEnv = { siteKey: string; secretKey: string };
export const TURNSTILE_TEST_KEYS: TurnstileEnv = {
  siteKey: "1x00000000000000000000AA",
  secretKey: "1x0000000000000000000000000000000AA",
};

// lib/security/turnstile.ts — respuesta de siteverify (solo lo que se lee)
type SiteverifyResponse = { success: boolean; "error-codes"?: string[] };
```

Variables de entorno nuevas:

| Variable                         | Obligatoria en producción | Fuera de producción               |
| -------------------------------- | ------------------------- | --------------------------------- |
| `TRUSTED_IP_HEADER`              | No (advierte si falta)    | Opcional; sin ella IP = `"local"` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Sí                        | Clave de prueba si falta          |
| `TURNSTILE_SECRET_KEY`           | Sí                        | Clave de prueba si falta          |

Un `TRUSTED_IP_HEADER` con un valor que no está en `TRUSTED_IP_HEADERS` hace fallar `getClientIp` con un error claro en la primera llamada.

## Plan de implementación

1. **Headers.** Crear `lib/security/headers.ts` con `securityHeaders(isProd)` y conectarlo en `next.config.ts` (`headers()` + `poweredByHeader: false`). Test `server` de la política. Prueba manual: `npm run dev`, recorrer home, blog, artículo, login y `/admin` (gráficos, editor, medios) sin violaciones de CSP en la consola.
2. **IP real.** Crear `lib/security/env.ts` (parte de IP) y `lib/security/client-ip.ts`. `isRateLimited` pasa a usar `getClientIp`, y `lib/auth/auth.ts` suma `advanced.ipAddress`. Tests `server`.
3. **Verificación de Turnstile.** Completar `lib/security/env.ts` (claves) y crear `lib/security/turnstile.ts`. Tests `server` con `fetch` mockeado. Todavía nada lo usa.
4. **Widget.** Crear `components/auth/turnstile.tsx` y la prop `captcha` en `AuthForm` (reset en error, botón deshabilitado sin token). Test `client` con `window.turnstile` stubeado.
5. **Formularios de cuenta.** Activar `captcha` en los cuatro formularios y verificar el token en `signInAction`, `signUpAction` y `sendLink` con `MSG.captcha`. Prueba manual con las claves de prueba: login y registro siguen funcionando.
6. **Cerrar endpoints HTTP.** `disabledPaths` en `lib/auth/auth.ts` y limpieza de `customRules`. Prueba manual: `curl -X POST /api/auth/sign-up/email` → 404; el login con Google sigue andando.
7. **Rate limit de comunidad.** Reglas `rate`, `vote`, `reply` y `delete-content`, aplicadas en `actions/blog/comunidad/index.ts`. Test `db`.
8. **Rate limit de cargar más.** Regla `load-more` en las tres actions. Test `db`.
9. **`app/robots.ts`** y `.env.example`.
10. **E2E.** `e2e/seguridad.spec.ts` y ajustes en `auth.spec.ts` / `cuenta.spec.ts` si esperan el botón habilitado de entrada.

## Criterios de aceptación

**Headers (`server` + E2E)**

- [ ] `securityHeaders(true)` incluye `Strict-Transport-Security` y `upgrade-insecure-requests`. `securityHeaders(false)` no los incluye y su `script-src` tiene `'unsafe-eval'`.
- [ ] La CSP de producción no tiene `'unsafe-eval'` y tiene `frame-ancestors 'none'`, `object-src 'none'` y `https://challenges.cloudflare.com` en `script-src` y `frame-src`.
- [ ] En E2E, la respuesta de `/`, `/blog` y `/cuenta/login` trae `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`, y no trae `X-Powered-By`.
- [ ] En E2E, home, un artículo, login, `/admin`, el editor de artículos y la galería de medios cargan sin mensajes `Content Security Policy` en la consola.

**IP real (`server`)**

- [ ] Con `TRUSTED_IP_HEADER=x-forwarded-for` y `x-forwarded-for: 1.1.1.1, 2.2.2.2`, `getClientIp` devuelve `2.2.2.2`.
- [ ] Con `TRUSTED_IP_HEADER=cf-connecting-ip`, ignora `x-forwarded-for` y devuelve el valor de `cf-connecting-ip`.
- [ ] Sin `TRUSTED_IP_HEADER` devuelve `"local"` aunque venga `x-forwarded-for`.
- [ ] Sin `TRUSTED_IP_HEADER` y con `NODE_ENV=production`, `console.warn` se llama una sola vez en dos llamadas seguidas.
- [ ] `TRUSTED_IP_HEADER=x-foo` hace lanzar a `getClientIp` un error que nombra la variable.

**Turnstile (`server`)**

- [ ] `verifyTurnstile` devuelve `true` con `{ success: true }` y manda `secret`, `response` y `remoteip` al endpoint de `siteverify`.
- [ ] Con IP `"local"` no manda `remoteip`.
- [ ] Devuelve `false` con token vacío (sin llamar a `fetch`), con `{ success: false }`, con status 500, con `fetch` que lanza y con timeout.
- [ ] Sin claves y con `NODE_ENV=test` usa las claves de prueba. Sin claves y con `NODE_ENV=production`, `getTurnstileEnv()` lanza un error que nombra las dos variables.
- [ ] `signUpAction` con `verifyTurnstile` mockeado a `false` devuelve el mensaje "No pudimos verificar que no sos un bot. Probá de nuevo." y no llama a `auth.api.signUpEmail`.
- [ ] `signInAction`, `requestResetAction` y `resendVerificationAction` tampoco llaman a `auth.api` si el captcha falla.

**Widget (`client`)**

- [ ] `LoginForm`, `RegisterForm`, `RecoverForm` y `VerifyView` llaman a `turnstile.render` con la site key.
- [ ] El botón de submit está deshabilitado hasta que el widget llama a `callback` con un token, y vuelve a deshabilitarse con `expired-callback`.
- [ ] Cuando la action devuelve `status: "error"`, se llama a `turnstile.reset` del widget.

**Endpoints cerrados (E2E)**

- [ ] `POST /api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/request-password-reset` y `/api/auth/send-verification-email` responden 404.
- [ ] `GET /api/auth/get-session` sigue respondiendo 200.
- [ ] Con las claves de prueba, un usuario se registra, verifica el email desde Mailpit e inicia sesión desde los formularios.

**Rate limit (`db`)**

- [ ] El voto número 61 de un usuario dentro de 60 s devuelve "Demasiadas acciones seguidas. Probá de nuevo en un minuto." y no cambia el voto.
- [ ] La valoración número 21 de un usuario en 60 s se rechaza, y la de otro usuario en el mismo momento pasa.
- [ ] La respuesta número 11 en 600 s se rechaza. El borrado número 21 de comentarios o respuestas en 60 s se rechaza.
- [ ] La llamada número 61 a `loadMorePostsAction` desde una misma IP en 60 s devuelve error. `loadMoreCommentsAction` y `loadMoreUserCommentsAction` comparten ese contador.
- [ ] Pasada la ventana, la acción vuelve a funcionar.

**robots**

- [ ] `GET /robots.txt` devuelve `Disallow: /admin`, `Disallow: /cuenta` y `Disallow: /api`, y no incluye `Sitemap`.

## Decisiones

- **Sí:** headers de seguridad, Turnstile en formularios y rate limit ampliado en este spec. Elegido por el usuario.
- **No:** endurecer cuentas (2FA, HIBP, bloqueo por fallos). Elegido por el usuario. Toca el modelo de usuario y el flujo de login, y va en su propio spec.
- **Sí:** CSP estática en `next.config.ts`, sin nonce. Elegido por el usuario. Mantiene el prerender y PPR de `cacheComponents`.
- **No:** CSP con nonce en `proxy.ts`. Obliga a renderizar todo por request y a que el proxy corra en todas las rutas.
- **No:** CSP en modo `Report-Only`. Sin endpoint de reportes no aporta, y el E2E ya detecta violaciones en la consola.
- **Sí:** `'unsafe-inline'` en `style-src`. Recharts y varios componentes usan `style={…}`, y sacarlo implica reescribirlos.
- **Sí:** HSTS sin `preload`. `preload` es difícil de revertir y el dominio de producción no está decidido.
- **Sí:** Cloudflare Turnstile. Elegido por el usuario. Gratis, casi siempre invisible y sin cookies de rastreo.
- **No:** honeypot, reCAPTCHA y hCaptcha. Un honeypot solo frena bots triviales, y reCAPTCHA rastrea al usuario.
- **Sí:** Turnstile en login, registro, recuperar contraseña y reenviar verificación. Elegido por el usuario.
- **No:** Turnstile en comentarios y respuestas. Ya exigen sesión con email verificado y tienen rate limit por usuario.
- **Sí:** verificar el token en las Server Actions. El plugin `captcha` de Better Auth solo actúa en el handler HTTP, y las actions llaman a `auth.api` directo.
- **Sí:** cerrar con 404 los endpoints HTTP de email mediante `disabledPaths`. Elegido por el usuario. Si no, un bot saltea el captcha llamando a la API. `disabledPaths` no afecta a `auth.api`.
- **Sí:** el captcha se verifica después del rate limit. Un bot que ya se pasó del límite no gasta llamadas a Cloudflare.
- **Sí:** fallar cerrado si Cloudflare no responde. Elegido por el usuario. Una caída de Cloudflare no puede abrirle la puerta a los bots.
- **Sí:** claves de prueba de Cloudflare fuera de producción. Elegido por el usuario. El E2E recorre el flujo real del widget sin claves verdaderas.
- **No:** variable para desactivar Turnstile. El E2E no probaría el flujo real.
- **Sí:** `TRUSTED_IP_HEADER` configurable, con advertencia y no error si falta en producción. Elegido por el usuario. El hosting no está decidido.
- **Sí:** de `x-forwarded-for` se toma el último valor. El primero lo controla el cliente, y el último es el que agregó el proxy propio.
- **Sí:** rate limit por usuario en valorar, votar, responder y borrar, y por IP en "cargar más". Elegido por el usuario. Los valores (20, 60, 10/600 s, 20 y 60 por minuto) son iniciales y se ajustan en `RULES`.
- **No:** rate limit en acciones de admin y en `/media/[id]`. Elegido por el usuario. `/media` ya responde con caché `immutable`.
- **Sí:** si la base falla al contar, se deja pasar. Es el mismo criterio que `limited` en `actions/cuenta`: el rate limit no puede tumbar la acción.
- **Sí:** `app/robots.ts` básico, sin sitemap ni bloqueo de crawlers de IA. Elegido por el usuario. El SEO va en otro spec.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.

## Riesgos

| Riesgo                                                                                                                       | Mitigación                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La CSP rompe algo que no se recorrió (Tiptap, Recharts, previews `blob:` de medios, HMR en dev).                             | `img-src` incluye `data:` y `blob:`, y dev suma `'unsafe-eval'`. El E2E revisa la consola en las pantallas más pesadas.                                      |
| `TRUSTED_IP_HEADER` mal elegido: un header que el cliente puede mandar deja falsificar la IP y saltear el rate limit por IP. | `.env.example` explica qué valor va con cada hosting. Se toma el último valor de `x-forwarded-for`. El captcha y el límite por usuario no dependen de la IP. |
| Better Auth lee `x-forwarded-for` a su manera (puede tomar el primer valor).                                                 | Solo afecta a `/sign-in/social`, el único endpoint con límite que queda abierto por HTTP. Los flujos de email usan `getClientIp`.                            |
| Cloudflare caído bloquea login y registro.                                                                                   | Falla cerrado por decisión. El error es claro, el widget se resetea y el usuario puede reintentar. El login con proveedores sigue funcionando.               |
| Bloqueadores de contenido o redes que bloquean `challenges.cloudflare.com` dejan el botón deshabilitado.                     | Queda aceptado. Si aparece en la práctica, se agrega un texto de ayuda en otro spec.                                                                         |
| Tests existentes esperan el botón de submit habilitado de entrada.                                                           | Las claves de prueba resuelven el token en milisegundos. El paso 10 ajusta los E2E que fallen.                                                               |
| La tabla `rate_limit` crece con una fila por IP y regla.                                                                     | Fuera de alcance. Va en un spec de mantenimiento.                                                                                                            |

## Qué **no** entra en este spec

- 2FA, HIBP y bloqueo de cuentas.
- CSP con nonce, hashes o reportes, y HSTS `preload`.
- Rate limit en admin y en `/media/[id]`.
- Turnstile en comentarios, respuestas y OAuth.
- Bloqueo de crawlers de IA y sitemap.
- Configuración del hosting, WAF o reverse proxy.
- Limpieza de la tabla `rate_limit`.
