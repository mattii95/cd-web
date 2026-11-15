# SPEC 07 — Autenticación y autorización

> **Estado:** Implementado
> **Depende de:** SPEC 04, SPEC 05, SPEC 06
> **Fecha:** 2026-11-14
> **Objetivo:** Dar cuentas reales con Better Auth sobre Drizzle: registro, verificación de email, login, logout y recuperación de contraseña, con roles `lector` y `admin` que protegen `/cuenta/perfil` y `/admin`.

## Por qué existe este spec

SPEC 04 maquetó `/cuenta/login`, `/cuenta/registro` y `/cuenta/recuperar`, que al enviarse muestran "Las cuentas todavía no están disponibles".
SPEC 06 dejó Postgres y Drizzle listos, sin tablas, a la espera del proveedor de auth.
Este spec elige el proveedor, crea las primeras tablas de dominio y conecta los formularios existentes sin cambiar su diseño, salvo lo que se indica abajo.

Con `cacheComponents`, leer la sesión es una lectura del request.
Todo lo que depende del usuario (el menú del header, el perfil y el admin) se renderiza dentro de `<Suspense>`.
Las páginas de login, registro y recuperar se siguen prerenderizando.

**Referencias:**

- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` (DAL, Server Actions y chequeos optimistas con Proxy).
- `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` (sesión dentro de `<Suspense>`).
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (`proxy.ts`, el reemplazo de `middleware.ts`).
- La documentación de Better Auth para Next.js, el adaptador de Drizzle, `emailVerification`, `requestPasswordReset`, `rateLimit` y `nextCookies`.

## Alcance

**Incluye:**

- Dependencias: `better-auth` y `nodemailer`. De desarrollo: `@types/nodemailer`.
- Variables de entorno nuevas en `.env.example`, `.env.local` y `.env.test.local`:
  - `BETTER_AUTH_SECRET` (32 caracteres o más) y `BETTER_AUTH_URL` (`http://localhost:3000` en desarrollo).
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`. En desarrollo apuntan a Mailpit (`localhost`, `1025`, sin usuario ni contraseña).
- `lib/auth/env.ts` y `lib/mail/env.ts`: validan las variables con Zod al llamar la función, no al importar, como `db/env.ts`.
- Esquema `db/schema/auth.ts` con las tablas que pide Better Auth (`user`, `session`, `account`, `verification`, `rate_limit`), reexportado desde `db/schema/index.ts`. La tabla `user` suma `role` (`lector` | `admin`, por defecto `lector`).
- Migración `db/migrations/0001_auth.sql`, generada con `npm run db:generate -- --name auth`.
- Configuración de Better Auth en `lib/auth/auth.ts` (`import "server-only"`), con una función `getAuth()` que crea la instancia la primera vez que se llama:
  - `drizzleAdapter(getDb(), { provider: "pg", schema })`.
  - `emailAndPassword`: habilitado, `minPasswordLength: 8`, `requireEmailVerification: true`, `revokeSessionsOnPasswordReset: true`, `resetPasswordTokenExpiresIn: 3600`, `sendResetPassword` con el mailer y `onExistingUserSignUp`, que manda el email "Ya tenés una cuenta" a la cuenta existente.
  - `emailVerification`: `sendOnSignUp: true`, `sendOnSignIn: true`, `autoSignInAfterVerification: false`, `expiresIn: 86400` y `sendVerificationEmail` con el mailer.
  - `session`: `expiresIn` de 30 días y `updateAge` de 1 día.
  - `user.additionalFields.role`: `input: false`, así el registro no puede elegir el rol.
  - `rateLimit` habilitado, con `storage: "database"` y reglas propias (ver Modelo de datos).
- `lib/auth/rate-limit.ts` (`server-only`): `isRateLimited(regla)` aplica en las Server Actions las mismas reglas del rate limit, sobre la tabla `rate_limit`, con la IP de `x-forwarded-for` o `x-real-ip`. Better Auth solo limita su handler HTTP y las actions llaman a `auth.api` directo.
  - Plugin `nextCookies()`, para que las Server Actions puedan escribir la cookie de sesión.
- `app/api/auth/[...all]/route.ts`: `GET` y `POST` que llaman a `getAuth()` dentro del handler y delegan en `toNextJsHandler`.
- Mailer en `lib/mail/`:
  - `lib/mail/transport.ts` (`server-only`): `sendMail({ to, subject, html, text })` con un transporte SMTP de Nodemailer creado una sola vez.
  - `lib/mail/templates.ts`: funciones puras `verificationEmail(name, url)`, `resetPasswordEmail(name, url)` y `existingAccountEmail(name, url)` (con el link a `/cuenta/login`) que devuelven `{ subject, html, text }` en español.
- Data Access Layer en `lib/auth/dal.ts` (`server-only`):
  - `getCurrentUser()`: lee la sesión con `auth.api.getSession({ headers: await headers() })` y devuelve un `CurrentUser` o `null`. Envuelta en `cache` de React para leer una sola vez por request.
  - `requireUser(volver)`: si no hay usuario, redirige a `/cuenta/login?volver={volver}`.
  - `requireAdmin()`: llama a `requireUser("/admin")` y, si el rol no es `admin`, llama a `notFound()`.
- `proxy.ts` en la raíz: chequeo optimista con `getSessionCookie` de `better-auth/cookies`. Con `matcher` `/cuenta/perfil` y `/admin/:path*`. Sin cookie, redirige a `/cuenta/login?volver={ruta}`. No consulta la base.
- Server Actions en `app/cuenta/actions.ts` (`"use server"`), cada una valida su entrada con Zod y llama a `getAuth().api`:
  - `signInAction`: email, contraseña, `rememberMe` y `volver`. Si sale bien, redirige al destino resuelto por `resolveAfterLogin`.
  - `signUpAction`: nombre, email y contraseña. Si sale bien, redirige a `/cuenta/verificar`.
  - `requestResetAction`: email. Siempre devuelve el mismo mensaje, exista o no la cuenta.
  - `resetPasswordAction`: token y contraseña nueva. Si sale bien, redirige a `/cuenta/login?estado=contrasena-actualizada`.
  - `resendVerificationAction`: email. Siempre devuelve el mismo mensaje.
  - `signOutAction`: cierra la sesión y redirige a `/`.
- Formularios existentes (SPEC 04), sin cambiar el layout:
  - `components/auth/auth-form.tsx` pasa a usar `useActionState` con la action que recibe por prop. Mientras envía, el botón queda `disabled` con `aria-busy="true"`.
  - El recuadro `UnavailableNotice` se borra. Lo reemplaza `components/auth/form-message.tsx`, en el mismo lugar: `role="alert"` para errores y `role="status"` para confirmaciones.
  - Se mantiene la validación nativa de HTML. Zod en el servidor es la fuente de verdad.
  - Login: se sacan "Continuar con Google" y el separador "o con tu email". "Recordarme" pasa a ser real (`name="rememberMe"`). Un input oculto `volver` toma el `?volver=` de la URL con `useSearchParams` dentro de `<Suspense>`.
  - Login con `?estado=contrasena-actualizada` muestra con `role="status"`: "Tu contraseña se actualizó. Ya podés iniciar sesión.".
  - Registro: se sacan "Continuar con Google" y el separador. El checkbox de términos sigue `required` y no se guarda.
  - `components/auth/google-button.tsx` se borra.
- Páginas nuevas con el `AuthLayout` de SPEC 04 y panel propio:
  - `/cuenta/verificar`. Lee `?estado` y `?error` en el cliente dentro de `<Suspense>` y tiene tres estados:
    - Sin parámetros: "Revisá tu email", con un formulario para reenviar el link.
    - `?estado=ok`: "Tu email está verificado", con un link a `/cuenta/login`.
    - `?error=…`: "El link venció o no es válido", con el formulario para reenviar.
  - `/cuenta/nueva-contrasena`. Lee `?token` en el cliente. Tiene el campo de contraseña con mostrar u ocultar y el medidor de SPEC 04. Sin `token`, o con `?error=INVALID_TOKEN`, muestra "El link venció o no es válido" y un link a `/cuenta/recuperar`.
- Páginas nuevas dentro de `(site)`, con header y footer, diseñadas con `/frontend-design` sobre los tokens de `app/globals.css`:
  - `app/(site)/cuenta/perfil/page.tsx` (`/cuenta/perfil`): nombre, email, rol, fecha de alta y el botón "Cerrar sesión". Solo lectura.
  - `app/(site)/admin/page.tsx` (`/admin`): tabla de usuarios con nombre, email, rol, verificado y fecha de alta, ordenada por fecha de alta descendente. Solo lectura.
  - Las dos con `robots: { index: false, follow: false }` y el contenido del usuario dentro de `<Suspense>`.
- Header:
  - `components/auth/user-menu.tsx`: con sesión, un botón con la inicial del nombre y un menú con "Mi perfil", "Administración" (solo `admin`) y "Cerrar sesión". Sin sesión, el link "Ingresar" de hoy.
  - `components/site-header.tsx` y `components/mobile-menu.tsx` lo montan dentro de `<Suspense>`, con fallback igual al link "Ingresar".
- Redirección después del login, en `lib/back-href.ts`, con una función nueva `resolveAfterLogin(volver)`:
  - Acepta `/blog/{slug}` con un slug que existe (la regla de SPEC 04), `/cuenta/perfil` y `/admin`.
  - Cualquier otro valor va a `/cuenta/perfil`.
- Script `scripts/make-admin.ts` y `"auth:make-admin": "tsx --conditions=react-server scripts/make-admin.ts"`. `npm run auth:make-admin -- usuario@email.com` cambia el rol a `admin`. Si el usuario no existe, termina con código 1 y un mensaje.
- Tests:
  - Vitest `server`: `resolveAfterLogin`, `lib/auth/env.ts`, `lib/mail/env.ts` y las plantillas de email.
  - Vitest `client`: se actualizan `login-form.test.tsx` y `password-input.test.tsx` a la versión sin Google y sin aviso de "no disponible".
  - Vitest `db`: `__tests__/db/auth.test.ts` contra la base de test, con las tablas de auth vaciadas antes de cada test.
  - Playwright: `e2e/auth.spec.ts` con el flujo completo, que lee los emails de la API de Mailpit (`GET http://localhost:8025/api/v1/messages`). `e2e/cuenta.spec.ts` se actualiza.
- CI: el job `e2e` suma los services `postgres:18` y `axllent/mailpit`, las variables de auth y SMTP, y `npm run db:migrate` antes de `npm run test:e2e`. El job `db` suma `BETTER_AUTH_SECRET`.
- `README.md`: las variables nuevas, Mailpit en `http://localhost:8025` y `auth:make-admin`.

**Fuera de alcance (para specs futuros):**

- Login con Google u otro OAuth.
- Comentar y puntuar con la cuenta: la sección de comentarios del blog no cambia.
- Editar el perfil, cambiar el email o la contraseña desde el perfil, y borrar la cuenta.
- Gestionar usuarios desde `/admin`: cambiar roles, banear, impersonar o borrar.
- Permisos finos por recurso.
- Redirigir a un usuario con sesión que entra a `/cuenta/login` o `/cuenta/registro`.
- Proveedor de email de producción y dominio de envío (SPF, DKIM).
- Páginas de Términos y condiciones y de Política de privacidad.
- Newsletter.
- Autenticación de dos factores y passkeys.
- Mantener `?volver=` al pasar de login a registro o a recuperar.

## Modelo de datos

```ts
// db/schema/auth.ts (generado con el CLI de Better Auth y ajustado a mano)
export const userRole = pgEnum("user_role", ["lector", "admin"]);

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: userRole().notNull().default("lector"),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});
// session, account, verification y rate_limit: las columnas que pide Better Auth, sin cambios.
// session y account tienen userId con onDelete: "cascade".
```

```ts
// lib/auth/dal.ts
export type Role = "lector" | "admin";
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}; // DTO: nunca expone tokens ni el hash de la contraseña
export function getCurrentUser(): Promise<CurrentUser | null>;
export function requireUser(volver: string): Promise<CurrentUser>;
export function requireAdmin(): Promise<CurrentUser>;

// app/cuenta/actions.ts
export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

// lib/back-href.ts
export function resolveAfterLogin(volver: string | null): string; // por defecto "/cuenta/perfil"
```

Mensajes de error en el recuadro `role="alert"`:

| Caso                                     | Mensaje                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| Email o contraseña incorrectos           | "El email o la contraseña no son correctos."                           |
| Email sin verificar al iniciar sesión    | "Tenés que verificar tu email. Te mandamos un link nuevo."             |
| Datos inválidos según Zod                | "Revisá los datos e intentá de nuevo."                                 |
| Límite de intentos superado              | "Demasiados intentos. Probá de nuevo en un minuto."                    |
| Token de recuperación vencido o inválido | "El link venció o no es válido. Pedí uno nuevo."                       |
| Error inesperado o base caída            | "No pudimos completar la operación. Intentá de nuevo en unos minutos." |

Mensaje de recuperar y de reenviar verificación (`role="status"`), exista o no la cuenta: "Si el email tiene una cuenta, te enviamos un link.".

Registro con un email que ya existe: Better Auth, con `requireEmailVerification`, responde igual que a un registro nuevo para no revelar qué emails tienen cuenta. El formulario redirige a `/cuenta/verificar` y la cuenta existente recibe el email "Ya tenés una cuenta", sin crear otro usuario.

Límites de intentos (por IP, guardados en `rate_limit`):

| Ruta de Better Auth        | Máximo | Ventana |
| -------------------------- | ------ | ------- |
| `/sign-in/email`           | 5      | 60 s    |
| `/sign-up/email`           | 3      | 60 s    |
| `/request-password-reset`  | 3      | 60 s    |
| `/send-verification-email` | 3      | 60 s    |

Tiempos:

- Sesión con "Recordarme": 30 días, renovada cada día de uso.
- Sesión sin "Recordarme": cookie de sesión del navegador.
- Link de verificación: 24 horas.
- Link de recuperación: 1 hora.

Variables de entorno nuevas:

| Variable             | Dónde                                | Ejemplo                                 |
| -------------------- | ------------------------------------ | --------------------------------------- |
| `BETTER_AUTH_SECRET` | `.env.local`, `.env.test.local` y CI | salida de `openssl rand -base64 32`     |
| `BETTER_AUTH_URL`    | `.env.local`, `.env.test.local` y CI | `http://localhost:3000`                 |
| `SMTP_HOST`          | `.env.local` y CI                    | `localhost`                             |
| `SMTP_PORT`          | `.env.local` y CI                    | `1025`                                  |
| `SMTP_USER`          | `.env.local` (vacío con Mailpit)     |                                         |
| `SMTP_PASS`          | `.env.local` (vacío con Mailpit)     |                                         |
| `MAIL_FROM`          | `.env.local` y CI                    | `Courroux Digital <no-reply@localhost>` |

Convenciones:

- Solo el código de servidor importa `lib/auth/auth.ts`, `lib/auth/dal.ts` y `lib/mail/transport.ts`, todos con `server-only`.
- La autorización real se decide en la DAL, cerca de los datos. `proxy.ts` y el menú del header solo mejoran la experiencia.
- Cada Server Action vuelve a validar su entrada con Zod, aunque el formulario tenga validación nativa.

## Plan de implementación

1. **Entorno y dependencias.** Instalar `better-auth`, `nodemailer` y `@types/nodemailer`. Sumar las variables a `.env.example`. Crear `lib/auth/env.ts` y `lib/mail/env.ts` con sus tests. Prueba: `npm run test:run` pasa.
2. **Esquema y migración.** Generar `db/schema/auth.ts` con el CLI de Better Auth, sumar `role` y reexportarlo. Correr `npm run db:generate -- --name auth`. Prueba: `npm run db:migrate` crea las cinco tablas y el enum `user_role` en `DB_CD26`.
3. **Mailer.** Crear `lib/mail/templates.ts` con sus tests y `lib/mail/transport.ts`. Prueba: un envío de prueba aparece en Mailpit.
4. **Better Auth.** Crear `lib/auth/auth.ts` con `getAuth()` y `app/api/auth/[...all]/route.ts`. Prueba: `npm run build` pasa sin `DATABASE_URL` y `GET /api/auth/ok` responde 200 con la base levantada.
5. **DAL y tests de base.** Crear `lib/auth/dal.ts` y `__tests__/db/auth.test.ts`. Prueba: `npm run test:db` pasa.
6. **Server Actions y formularios.** Crear `app/cuenta/actions.ts`, `components/auth/form-message.tsx` y `resolveAfterLogin`. Conectar login, registro y recuperar. Borrar `unavailable-notice.tsx` y `google-button.tsx`. Actualizar los tests de `client`. Prueba: registrarse manda el email a Mailpit y redirige a `/cuenta/verificar`.
7. **Verificar y nueva contraseña.** Crear `app/cuenta/verificar/page.tsx` y `app/cuenta/nueva-contrasena/page.tsx` con sus paneles. Prueba: el link de Mailpit verifica la cuenta y el link de recuperar permite cambiar la contraseña.
8. **Perfil, admin y proxy.** Crear `app/(site)/cuenta/perfil/page.tsx`, `app/(site)/admin/page.tsx`, `proxy.ts` y `scripts/make-admin.ts`. Prueba: un `lector` ve su perfil y recibe 404 en `/admin`, y después de `auth:make-admin` ve la tabla.
9. **Header.** Crear `components/auth/user-menu.tsx` y montarlo en el header y el menú mobile dentro de `<Suspense>`. Prueba: con sesión el header muestra la inicial y el menú, y "Cerrar sesión" vuelve a mostrar "Ingresar".
10. **E2E y CI.** Escribir `e2e/auth.spec.ts`, actualizar `e2e/cuenta.spec.ts` y sumar Postgres y Mailpit al job `e2e`. Prueba: `npm run test:e2e` pasa en local con Docker levantado.
11. **README.** Documentar las variables, Mailpit y `auth:make-admin`.

## Criterios de aceptación

- [x] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `npm run build` termina sin errores con Docker apagado y sin `DATABASE_URL`.
- [x] El build sigue prerenderizando `/cuenta/login`, `/cuenta/registro`, `/cuenta/recuperar`, `/cuenta/verificar`, `/cuenta/nueva-contrasena`, la home, `/blog` y los artículos.
- [x] `npm run test:run` pasa con Docker apagado.
- [x] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa con Docker levantado, y los jobs `checks`, `db` y `e2e` del CI pasan en un PR a `main`.
- [x] `npm run db:migrate` crea `user`, `session`, `account`, `verification`, `rate_limit` y el enum `user_role`.
- [x] Ninguna página muestra "Las cuentas todavía no están disponibles", "Continuar con Google" ni "o con tu email".
- [x] Registrarse con datos válidos crea un usuario con `role = 'lector'` y `email_verified = false`, redirige a `/cuenta/verificar` y deja un email en Mailpit.
- [x] Mandar `role: "admin"` en el body de `/api/auth/sign-up/email` crea igual un usuario `lector`.
- [x] Registrarse con un email existente redirige igual a `/cuenta/verificar`, no crea otro usuario, y deja en Mailpit un email "Ya tenés una cuenta" para la cuenta existente.
- [x] Iniciar sesión sin verificar muestra "Tenés que verificar tu email. Te mandamos un link nuevo." y manda un email nuevo.
- [x] Abrir el link de verificación lleva a `/cuenta/verificar?estado=ok` y pone `email_verified = true`.
- [x] Abrir un link de verificación alterado lleva a `/cuenta/verificar` con el estado "El link venció o no es válido".
- [x] Iniciar sesión verificado, sin `?volver=`, lleva a `/cuenta/perfil` y muestra nombre, email, rol y fecha de alta.
- [x] Iniciar sesión desde `/cuenta/login?volver=/blog/senales-sistema-a-medida` lleva a ese artículo.
- [x] Con `?volver=https://otro.com`, `//otro.com` o `/blog/no-existe`, el login lleva a `/cuenta/perfil`.
- [x] Una contraseña incorrecta muestra "El email o la contraseña no son correctos.", igual que un email que no existe.
- [x] El sexto intento de login fallido en un minuto desde la misma IP muestra "Demasiados intentos. Probá de nuevo en un minuto.".
- [x] Sin "Recordarme", la cookie de sesión no tiene `Expires` ni `Max-Age`. Con "Recordarme", vence en 30 días.
- [x] La cookie de sesión es `HttpOnly` y `SameSite=Lax`, y en producción es `Secure`.
- [x] Pedir recuperar con un email existente y con uno inexistente muestra el mismo mensaje. Solo el existente recibe un email.
- [x] El link de recuperar lleva a `/cuenta/nueva-contrasena`, permite poner una contraseña nueva y redirige a `/cuenta/login?estado=contrasena-actualizada`, que muestra el aviso.
- [x] Después de cambiar la contraseña, las sesiones abiertas de ese usuario dejan de ser válidas y la contraseña vieja no sirve.
- [x] Usar dos veces el mismo link de recuperar falla la segunda vez con "El link venció o no es válido. Pedí uno nuevo.".
- [x] Sin sesión, `/cuenta/perfil` y `/admin` redirigen a `/cuenta/login?volver=/cuenta/perfil` y `/cuenta/login?volver=/admin`.
- [x] Con una cookie de sesión inventada, `/cuenta/perfil` redirige igual a login (la DAL rechaza lo que el proxy deja pasar).
- [x] Un `lector` que entra a `/admin` ve la página 404.
- [x] `npm run auth:make-admin -- usuario@email.com` cambia el rol a `admin`, y después ese usuario ve en `/admin` la tabla de usuarios.
- [x] `npm run auth:make-admin -- noexiste@email.com` termina con código 1.
- [x] Con sesión, el header (desktop y mobile) muestra la inicial del nombre y el menú con "Mi perfil" y "Cerrar sesión". Solo un `admin` ve "Administración".
- [x] "Cerrar sesión" lleva a `/`, el header vuelve a mostrar "Ingresar" y `/cuenta/perfil` redirige a login.
- [x] Ninguna respuesta de `/cuenta/perfil` ni de `/admin` incluye el hash de la contraseña ni tokens de sesión.
- [x] `/cuenta/perfil`, `/admin`, `/cuenta/verificar` y `/cuenta/nueva-contrasena` tienen `<meta name="robots">` con `noindex`.
- [x] A 375px de ancho no hay scroll horizontal en las cuatro páginas nuevas.
- [x] Mientras un formulario envía, su botón está `disabled` y no se puede enviar dos veces.

## Decisiones

- **Sí:** Better Auth. Es self-hosted, tiene adaptador de Drizzle, sesiones en base, verificación, recuperación y rate limit. Elegido por el usuario.
- **No:** auth propia siguiendo la guía de Next. Más superficie de seguridad para escribir y mantener.
- **No:** Auth.js. Su soporte de email y contraseña es limitado y está desaconsejado.
- **Sí:** sesiones en base (tabla `session`). Se pueden revocar al cambiar la contraseña o al cerrar sesión.
- **No:** sesiones sin estado en una cookie firmada. No se pueden revocar.
- **Sí:** verificación obligatoria antes de iniciar sesión. Evita cuentas con emails ajenos. Elegido por el usuario.
- **Sí:** `sendOnSignIn` para reenviar el link al intentar entrar sin verificar. El usuario no se queda trabado sin un botón extra en el login.
- **No:** `autoSignInAfterVerification`. Iniciar sesión queda como un paso explícito, y el link de verificación no abre una sesión por sí solo.
- **Sí:** Nodemailer por SMTP. En desarrollo usa Mailpit y en producción solo cambian las variables. Elegido por el usuario.
- **No:** el SDK de un proveedor como Resend. Ata el proyecto a un servicio y no usa Mailpit.
- **Sí:** plantillas de email como funciones puras en `lib/mail/templates.ts`. Se testean sin SMTP.
- **No:** React Email u otra librería de plantillas. Son dos emails cortos.
- **Sí:** roles `lector` y `admin` como enum en `user.role`. Alcanza para proteger `/admin`. Elegido por el usuario.
- **No:** el plugin `admin` de Better Auth. Suma baneos, impersonación y endpoints de gestión que este spec no usa.
- **No:** permisos finos por recurso. No hay recursos que los necesiten todavía.
- **Sí:** `role` con `input: false`. El registro no puede elegir su rol.
- **Sí:** el primer admin se crea con `npm run auth:make-admin`. No hay credenciales en el repo ni una lista de emails en la configuración. Elegido por el usuario.
- **No:** `ADMIN_EMAILS` en el entorno ni un admin en el seed.
- **Sí:** DAL en `lib/auth/dal.ts` como fuente de verdad, con un DTO `CurrentUser`. Es lo que pide la guía de autenticación de Next.
- **Sí:** `proxy.ts` solo como chequeo optimista de la cookie. Redirige rápido sin consultar la base.
- **No:** autorizar solo en el proxy. Una cookie inventada pasaría.
- **Sí:** `notFound()` para un `lector` en `/admin`. No revela que la ruta existe.
- **No:** `forbidden()`. Necesita `authInterrupts`, que es experimental.
- **Sí:** Server Actions que llaman a `auth.api` con el plugin `nextCookies()`. La validación con Zod y los mensajes en español quedan en el servidor, y los formularios siguen andando sin JavaScript.
- **No:** el cliente de Better Auth (`createAuthClient`) en los formularios. Los mensajes de error saldrían del cliente y habría que traducir los códigos ahí.
- **Sí:** `getAuth()` perezoso, también en el route handler. `npm run build` no exige `DATABASE_URL` ni `BETTER_AUTH_SECRET`, como en SPEC 06.
- **Sí:** se sacan "Continuar con Google" y el separador. Un botón que no anda, al lado de cuentas reales, confunde. Elegido por el usuario.
- **Sí:** "Recordarme" real con `rememberMe` de Better Auth. Elegido por el usuario.
- **Sí:** errores en un recuadro `role="alert"` en el lugar del aviso de SPEC 04. Cambia poco el diseño. Elegido por el usuario.
- **No:** errores por campo. Más cambios visuales sobre el artboard.
- **Sí:** el mismo mensaje en recuperar y en reenviar verificación, exista o no la cuenta. No permite averiguar qué emails tienen cuenta.
- **Sí:** registro con email existente indistinguible de uno nuevo, más un email "Ya tenés una cuenta" a la cuenta existente. Es el comportamiento de Better Auth con `requireEmailVerification`, y no permite averiguar qué emails tienen cuenta. Elegido por el usuario al implementar.
- **No:** consultar la tabla `user` en `signUpAction` para mostrar "Ya existe una cuenta con ese email.". Revela qué emails tienen cuenta.
- **Sí:** después del login, `?volver=` validado o `/cuenta/perfil`. Mantiene el contexto del artículo. Elegido por el usuario.
- **Sí:** `resolveAfterLogin` en `lib/back-href.ts`, al lado de `resolveBackHref`. Reusa la regla contra open redirect de SPEC 04.
- **Sí:** rate limit de Better Auth con `storage: "database"`. Sobrevive reinicios y varias instancias. Elegido por el usuario.
- **Sí:** un limitador propio en las Server Actions, con las mismas reglas y la misma tabla. `auth.api` no pasa por el rate limit de Better Auth, que vive en su router HTTP. Elegido por el usuario al implementar.
- **No:** llamar al handler HTTP desde las actions para heredar el límite. Obliga a reenviar a mano las cookies `Set-Cookie`.
- **No:** rate limit en memoria. Se pierde al reiniciar.
- **Sí:** 30 días con "Recordarme", 24 horas para verificar y 1 hora para recuperar. La hora la promete el panel de SPEC 04. Elegido por el usuario.
- **Sí:** `revokeSessionsOnPasswordReset`. Si alguien robó la sesión, cambiar la contraseña la corta.
- **Sí:** `/cuenta/verificar` y `/cuenta/nueva-contrasena` con el `AuthLayout` y panel propio. Siguen el flujo de las otras páginas de cuenta. Elegido por el usuario.
- **Sí:** `/cuenta/perfil` y `/admin` dentro de `(site)`, con header y footer. Son páginas de uso, no de entrada. Elegido por el usuario.
- **Sí:** `?estado`, `?error` y `?token` se leen en el cliente con `useSearchParams` dentro de `<Suspense>`. Las páginas se prerenderizan, como `back-link.tsx` en SPEC 04.
- **Sí:** el menú de usuario dentro de `<Suspense>`, con fallback "Ingresar". El header sigue en el shell estático.
- **No:** `"use cache: private"` para la sesión. Se suma cuando haga falta prefetch de UI con sesión.
- **Sí:** la sección de comentarios del blog no cambia. Comentar con la cuenta necesita sus propias tablas y su propio spec.
- **Sí:** E2E con Postgres y Mailpit en el CI. Prueba el flujo real de punta a punta. Elegido por el usuario.
- **Sí:** tablas `user`, `session`, `account` y `verification` en singular, los nombres por defecto de Better Auth. Evita mapear nombres en el adaptador.

## Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Importar la configuración de Better Auth durante el build exige `DATABASE_URL` y el secret.    | `getAuth()` perezoso, llamado dentro de cada handler y action. El criterio "build sin `DATABASE_URL`" lo verifica.      |
| El rate limit corta los tests E2E, que comparten IP.                                           | Cada test usa un email distinto y hace pocos intentos por ruta. La tabla `rate_limit` se vacía al empezar la suite E2E. |
| El fallback "Ingresar" del header parpadea antes del menú en usuarios con sesión.              | Es el costo del shell estático. Si molesta, un spec posterior suma `"use cache: private"`.                              |
| El esquema que genera el CLI de Better Auth cambia entre versiones.                            | Se fija la versión de `better-auth` en `package.json` y el esquema se versiona en `db/schema/auth.ts` con su migración. |
| `getSession` lanza si la base está caída, y rompe el header de todo el sitio.                  | `getCurrentUser()` atrapa el error y devuelve `null`. El header muestra "Ingresar".                                     |
| `proxy.ts` corre en todas las rutas y suma latencia.                                           | `matcher` limitado a `/cuenta/perfil` y `/admin/:path*`.                                                                |
| Mailpit o el SMTP no responden y el registro queda a medias.                                   | El usuario se crea igual. Puede pedir el link de nuevo desde `/cuenta/verificar` o al intentar iniciar sesión.          |
| Los emails de producción caen en spam sin SPF ni DKIM.                                         | Fuera de este spec. Solo cambian las variables `SMTP_*` y `MAIL_FROM`.                                                  |
| La IP detrás de un proxy inverso es la del proxy, y el rate limit agrupa a todos los usuarios. | Configurar `advanced.ipAddress.ipAddressHeaders` al definir el hosting. En desarrollo y CI no aplica.                   |

## Qué **no** incluye este spec

- Login con Google u otro OAuth.
- Comentar y puntuar con la cuenta.
- Editar el perfil, cambiar el email o la contraseña desde el perfil, y borrar la cuenta.
- Gestión de usuarios y roles desde `/admin`.
- Permisos finos, dos factores y passkeys.
- Proveedor de email de producción.
- Páginas de Términos y condiciones y de Política de privacidad.
- Newsletter.

Cada uno de estos, si llega, va en su propio spec.
