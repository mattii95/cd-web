# SPEC 08 — Login con proveedores OAuth

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 07
> **Fecha:** 2026-11-15
> **Objetivo:** Sumar "Continuar con Google, GitHub y Microsoft" en login y registro con los `socialProviders` de Better Auth, vinculando cuentas por email de forma segura y mostrando la foto y los métodos de acceso del usuario.

## Por qué existe este spec

SPEC 04 maquetó un botón "Continuar con Google" que SPEC 07 sacó porque no andaba.
SPEC 07 dejó Better Auth con email y contraseña, la tabla `account` y el login por Server Actions.
Este spec suma tres proveedores gratuitos sobre esa base, sin tablas nuevas: cada proveedor vinculado es una fila más en `account`.

Dos decisiones de seguridad marcan el diseño:

- La vinculación automática por email abre un robo de cuenta previo: alguien registra con contraseña un email ajeno, que queda sin verificar, y cuando la dueña real entra con un proveedor las cuentas se unen. Este spec borra esa contraseña al vincular.
- Microsoft no siempre garantiza que el email esté verificado (el problema conocido como nOAuth). Solo Google y GitHub vinculan sin condiciones.

**Referencias:**

- La documentación de Better Auth: `socialProviders` (Google, GitHub, Microsoft), `account.accountLinking`, `trustedProviders`, `signInSocial`, `errorCallbackURL` y `databaseHooks`.
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` (`remotePatterns`).
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md` (leer el entorno en cada request y no en el build).
- SPEC 07, secciones de Server Actions, DAL y rate limit.

## Alcance

**Incluye:**

- Variables de entorno nuevas en `.env.example`, `.env.local`, `.env.test.local` y CI:
  - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
  - `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`.
  - `MICROSOFT_CLIENT_ID` y `MICROSOFT_CLIENT_SECRET`.
  - Todas opcionales. En `.env.test.local` y CI llevan valores falsos (`test-google-id`, etc.).
- `lib/auth/providers.ts`:
  - `getEnabledProviders()`: devuelve, en orden fijo `google`, `github`, `microsoft`, los proveedores que tienen client ID y secret.
  - `getSocialProvidersConfig()`: arma el objeto `socialProviders` de Better Auth solo con los habilitados.
  - Valida con Zod al llamar, no al importar. Si un proveedor tiene solo una de sus dos variables, lanza un error que nombra la que falta.
  - Microsoft con `tenantId: "common"` y `disableProfilePhoto: true`.
- `lib/auth/auth.ts`:
  - `socialProviders: getSocialProvidersConfig()`.
  - `account.accountLinking`: `enabled: true`, `trustedProviders: ["google", "github"]`.
  - `databaseHooks.account.create.before`: si la cuenta nueva no es `credential` y el usuario existente tiene `emailVerified = false`, borra sus filas `credential` de `account` antes de vincular. La lógica vive en `lib/auth/link-guard.ts` como `removeUnverifiedPassword(userId)`.
  - `rateLimit.customRules` suma `"/sign-in/social": { max: 10, window: 60 }`.
- `lib/auth/rate-limit.ts`: la regla `"sign-in-social"` (10 por 60 s) en `RULES`.
- `app/cuenta/actions.ts`: `signInSocialAction(formData)`:
  - Valida con Zod `provider` (uno de los habilitados) y `volver`.
  - Si `isRateLimited("sign-in-social")`, devuelve el error "Demasiados intentos. Probá de nuevo en un minuto.".
  - Llama a `getAuth().api.signInSocial` con `callbackURL` y `newUserCallbackURL` = `resolveAfterLogin(volver)` y `errorCallbackURL: "/cuenta/login"`.
  - Hace `redirect` a la URL del proveedor que devuelve Better Auth.
- `components/auth/social-section.tsx`, Server Component `async`:
  - Llama a `await connection()` y después a `getEnabledProviders()`. Así la lista sale del entorno del servidor en cada request y no del build.
  - Recibe `variant: "login" | "registro"`. Renderiza `SocialButtons` con la lista y, en `registro`, el texto legal debajo.
  - Si la lista está vacía, no renderiza nada.
- `components/auth/social-buttons.tsx` (`"use client"`), diseñado con `/frontend-design` sobre los tokens de `app/globals.css` y el estilo del botón de Google de SPEC 04:
  - Recibe `providers: SocialProvider[]`. Si está vacío, no renderiza nada, ni el separador.
  - Un `<form>` por proveedor con `signInSocialAction`, un input oculto `provider` y el `volver` de `LoginContext`.
  - Etiquetas "Continuar con Google", "Continuar con GitHub" y "Continuar con Microsoft", con el logo en SVG inline.
  - El separador "o con tu email" debajo de los botones.
  - Mientras envía, el botón queda `disabled` con `aria-busy="true"`.
- Páginas:
  - `app/cuenta/login/page.tsx` y `app/cuenta/registro/page.tsx` pasan `<Suspense fallback={null}><SocialSection variant="…" /></Suspense>` a `LoginForm` y `RegisterForm` por una prop nueva `social: ReactNode`. Los formularios la montan arriba de los campos. `RegisterForm` es Client Component y no puede importar `SocialSection`, por eso llega por prop.
  - El resto de las dos páginas se sigue prerenderizando como shell estático. Solo los botones llegan en streaming.
  - Registro: debajo de los botones, en texto plano, "Al continuar con un proveedor aceptás los términos y la política de privacidad.". El checkbox de términos sigue `required` para email y contraseña.
  - `components/auth/login-context.tsx`: con cualquier `?error=` en la URL, muestra con `role="alert"` "No pudimos iniciar sesión con ese proveedor. Probá de nuevo o usá tu email.".
- Perfil (`app/(site)/cuenta/perfil/page.tsx`): una fila "Métodos de acceso" con "Email y contraseña", "Google", "GitHub" o "Microsoft", según las filas de `account`. Solo lectura.
- DAL (`lib/auth/dal.ts`):
  - `CurrentUser` suma `image: string | null`.
  - `getLoginMethods(userId)` devuelve los `providerId` del usuario, en el orden fijo `credential`, `google`, `github`, `microsoft`.
- Header:
  - `lib/auth/avatar.ts`: función pura `avatarSrc(image)` que devuelve la URL solo si es `https:` y su host es `lh3.googleusercontent.com` o `avatars.githubusercontent.com`. Si no, devuelve `null`.
  - `components/auth/user-menu-dropdown.tsx`: con `avatarSrc` no nulo, el botón muestra la foto con `next/image` (32×32, `alt=""`). Si es `null` o la imagen falla al cargar, muestra la inicial de hoy.
  - `next.config.ts`: `images.remotePatterns` para esos dos hosts.
- Tests:
  - Vitest `server`: `getEnabledProviders`, `getSocialProvidersConfig` (ninguno, todos, uno con una sola variable) y `avatarSrc`.
  - Vitest `client`: `SocialButtons` sin proveedores, con uno y con tres. `login-form.test.tsx` y el test de registro se actualizan con la prop `social`.
  - Vitest `db`: `removeUnverifiedPassword` borra la fila `credential` de un usuario sin verificar y no toca la de uno verificado. `getLoginMethods` devuelve los métodos en orden.
  - Playwright `e2e/oauth.spec.ts`: con los client IDs falsos, cada botón redirige a la URL `authorize` de su proveedor con el `client_id` y el `redirect_uri` correctos. La request al proveedor se intercepta con `page.route` y se aborta. `/cuenta/login?error=access_denied` muestra el mensaje.
- CI: el job `e2e` suma las seis variables con valores falsos.
- `README.md`: cómo crear la app en cada consola, la URL de callback (`{BETTER_AUTH_URL}/api/auth/callback/{google|github|microsoft}`) y que el login completo con proveedores se prueba a mano.

**Fuera de alcance (para specs futuros):**

- Apple (exige la cuenta paga de desarrollador), Facebook (pide verificación de negocio), Discord, X, LinkedIn y otros proveedores.
- Vincular o desvincular proveedores desde el perfil.
- Crear o cambiar la contraseña desde el perfil. Un usuario solo OAuth la crea con "Recuperar".
- Elegir el nombre o la foto después del primer login, y editar el perfil.
- Foto de Microsoft.
- Login con un toque (One Tap de Google) y passkeys.
- Un servidor OIDC simulado para probar el flujo completo en CI.
- Páginas de Términos y condiciones y de Política de privacidad.
- Redirigir a un usuario con sesión que entra a `/cuenta/login` o `/cuenta/registro`.

## Modelo de datos

Este spec no agrega tablas ni migraciones.
Cada proveedor vinculado es una fila de `account` con `providerId` `google`, `github` o `microsoft`, que Better Auth ya maneja.
`user.image` guarda la URL de la foto que manda Google o GitHub.

```ts
// lib/auth/providers.ts
export type SocialProvider = "google" | "github" | "microsoft";
export function getEnabledProviders(): SocialProvider[];
export function getSocialProvidersConfig(): Partial<
  Record<SocialProvider, object>
>;

// lib/auth/link-guard.ts (server-only)
export function removeUnverifiedPassword(userId: string): Promise<void>;

// lib/auth/dal.ts
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  createdAt: Date;
};
export type LoginMethod = "credential" | SocialProvider;
export function getLoginMethods(userId: string): Promise<LoginMethod[]>;

// lib/auth/avatar.ts
export function avatarSrc(image: string | null): string | null;
```

Mensajes nuevos:

| Caso                                             | Mensaje                                                                           | Rol     |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | ------- |
| Cancelar en el proveedor o cualquier error OAuth | "No pudimos iniciar sesión con ese proveedor. Probá de nuevo o usá tu email."     | `alert` |
| Límite de intentos superado                      | "Demasiados intentos. Probá de nuevo en un minuto."                               | `alert` |
| Texto legal en registro                          | "Al continuar con un proveedor aceptás los términos y la política de privacidad." | texto   |

Etiquetas de "Métodos de acceso" en el perfil:

| `providerId` | Etiqueta             |
| ------------ | -------------------- |
| `credential` | "Email y contraseña" |
| `google`     | "Google"             |
| `github`     | "GitHub"             |
| `microsoft`  | "Microsoft"          |

Vinculación al entrar con un proveedor y un email que ya tiene cuenta:

| Proveedor       | Cuenta existente                                 | Resultado                                                    |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| Google o GitHub | verificada                                       | Vincula. La contraseña sigue sirviendo.                      |
| Google o GitHub | sin verificar                                    | Borra la contraseña, vincula y marca `emailVerified = true`. |
| Microsoft       | cualquiera, con email verificado según Microsoft | Igual que las dos filas de arriba.                           |
| Microsoft       | cualquiera, sin email verificado según Microsoft | No vincula. Va a `/cuenta/login?error=…`.                    |

Un email sin cuenta crea un usuario nuevo con `role = 'lector'`, el nombre del proveedor y `emailVerified` según el proveedor.

Límites de intentos (por IP, en `rate_limit`):

| Ruta o regla                         | Máximo | Ventana |
| ------------------------------------ | ------ | ------- |
| `/sign-in/social` y `sign-in-social` | 10     | 60 s    |

Variables de entorno nuevas:

| Variable                  | Dónde                                | Ejemplo en test y CI    |
| ------------------------- | ------------------------------------ | ----------------------- |
| `GOOGLE_CLIENT_ID`        | `.env.local`, `.env.test.local` y CI | `test-google-id`        |
| `GOOGLE_CLIENT_SECRET`    | `.env.local`, `.env.test.local` y CI | `test-google-secret`    |
| `GITHUB_CLIENT_ID`        | `.env.local`, `.env.test.local` y CI | `test-github-id`        |
| `GITHUB_CLIENT_SECRET`    | `.env.local`, `.env.test.local` y CI | `test-github-secret`    |
| `MICROSOFT_CLIENT_ID`     | `.env.local`, `.env.test.local` y CI | `test-microsoft-id`     |
| `MICROSOFT_CLIENT_SECRET` | `.env.local`, `.env.test.local` y CI | `test-microsoft-secret` |

Convenciones:

- La lista de proveedores habilitados se calcula en el servidor, en cada request, y llega a `SocialButtons` por prop. Ningún Client Component lee `process.env`.
- Los secrets nunca salen del servidor: `lib/auth/providers.ts` solo lo importan `lib/auth/auth.ts` y `components/auth/social-section.tsx`.
- Cambiar las variables de proveedor solo pide reiniciar el servidor, no volver a correr `npm run build`.

## Plan de implementación

1. **Entorno y proveedores.** Sumar las seis variables a `.env.example`. Crear `lib/auth/providers.ts` con sus tests. Prueba: `npm run test:run` pasa.
2. **Better Auth.** Sumar `socialProviders`, `accountLinking`, la regla `/sign-in/social` y la regla `sign-in-social` en `lib/auth/rate-limit.ts`. Prueba: con credenciales falsas, `POST /api/auth/sign-in/social` con `{ "provider": "github" }` responde con una URL de `github.com/login/oauth/authorize`.
3. **Guardia de vinculación.** Crear `lib/auth/link-guard.ts`, conectarlo en `databaseHooks.account.create.before` y escribir su test de `db`. Prueba: `npm run test:db` pasa.
4. **Server Action y botones.** Crear `signInSocialAction`, `components/auth/social-buttons.tsx` con `/frontend-design` y `components/auth/social-section.tsx`. Sumar la prop `social` a `LoginForm` y `RegisterForm` y montar la sección dentro de `<Suspense>` en login y registro, con el texto legal en registro. Prueba: con credenciales reales de GitHub en `.env.local`, entrar con GitHub crea un usuario `lector` y lleva a `/cuenta/perfil`.
5. **Errores.** Sumar el mensaje de `?error=` en `login-context.tsx`. Prueba: cancelar en la pantalla de GitHub vuelve a `/cuenta/login` con el mensaje.
6. **Perfil y DAL.** Sumar `image` a `CurrentUser`, `getLoginMethods` y la fila "Métodos de acceso". Prueba: un usuario con contraseña y GitHub ve los dos métodos.
7. **Foto en el header.** Crear `lib/auth/avatar.ts` con su test, sumar `remotePatterns` y la foto en `user-menu-dropdown.tsx`. Prueba: un usuario de GitHub ve su foto y uno con contraseña ve la inicial.
8. **Tests de cliente y E2E.** Escribir los tests de `SocialButtons`, actualizar los de login y registro, y escribir `e2e/oauth.spec.ts`. Sumar las variables falsas al job `e2e`. Prueba: `npm run test:e2e` pasa en local con Docker levantado.
9. **README.** Documentar las consolas, las URLs de callback y la prueba manual.

## Criterios de aceptación

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin ninguna variable de proveedor.
- [ ] El build prerenderiza el shell de `/cuenta/login` y `/cuenta/registro` (figuran como prerenderizadas parcialmente en la salida de `next build`), y el HTML del shell ya incluye el formulario de email.
- [ ] Con un build hecho sin variables de proveedor, sumar `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` y reiniciar `npm run start`, sin volver a hacer el build, muestra "Continuar con GitHub".
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa con Docker levantado, y los jobs `checks`, `db` y `e2e` del CI pasan en un PR a `main`.
- [ ] Sin variables de proveedor, login y registro no muestran ningún botón "Continuar con …" ni el separador "o con tu email".
- [ ] Con solo `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET`, login y registro muestran solo "Continuar con GitHub" y el separador.
- [ ] Con las seis variables, login y registro muestran los tres botones en el orden Google, GitHub, Microsoft.
- [ ] Con `GOOGLE_CLIENT_ID` y sin `GOOGLE_CLIENT_SECRET`, `getSocialProvidersConfig()` lanza un error que menciona `GOOGLE_CLIENT_SECRET`.
- [ ] Cada botón redirige a la URL `authorize` de su proveedor con el `client_id` configurado y `redirect_uri` igual a `{BETTER_AUTH_URL}/api/auth/callback/{proveedor}`.
- [ ] Desde `/cuenta/login?volver=/blog/senales-sistema-a-medida`, el `callbackURL` que guarda Better Auth es `/blog/senales-sistema-a-medida`. Con `?volver=https://otro.com`, es `/cuenta/perfil`.
- [ ] `/cuenta/login?error=access_denied` muestra "No pudimos iniciar sesión con ese proveedor. Probá de nuevo o usá tu email." con `role="alert"`.
- [ ] El undécimo intento de `signInSocialAction` en un minuto desde la misma IP muestra "Demasiados intentos. Probá de nuevo en un minuto.".
- [ ] Registro muestra "Al continuar con un proveedor aceptás los términos y la política de privacidad." cuando hay al menos un proveedor.
- [ ] Mientras un botón de proveedor envía, está `disabled` y no se puede enviar dos veces.
- [ ] `removeUnverifiedPassword` borra la fila `credential` de un usuario con `email_verified = false` y no borra la de un usuario verificado.
- [ ] Prueba manual: entrar con GitHub con un email nuevo crea un usuario `lector` con `email_verified = true` y una fila `account` con `provider_id = 'github'`, y lleva a `/cuenta/perfil`.
- [ ] Prueba manual: entrar con Google con el email de una cuenta verificada con contraseña no crea otro usuario, suma la fila `google` y la contraseña sigue sirviendo.
- [ ] Prueba manual: registrar con contraseña un email sin verificarlo y después entrar con Google con ese email deja al usuario sin fila `credential`, y la contraseña del registro ya no sirve.
- [ ] Prueba manual: un usuario solo OAuth que pide "Recuperar" recibe el email y puede crear una contraseña con la que después inicia sesión.
- [ ] Prueba manual: cancelar en la pantalla del proveedor vuelve a `/cuenta/login` con el mensaje de error.
- [ ] `/cuenta/perfil` muestra "Métodos de acceso" con "Email y contraseña" y "GitHub" para un usuario que tiene los dos.
- [ ] Con sesión de un usuario de Google o GitHub, el botón del header (desktop y mobile) muestra su foto. Con un usuario de contraseña o de Microsoft, muestra la inicial.
- [ ] `avatarSrc` devuelve `null` para `http://`, para un `data:` y para un host que no es `lh3.googleusercontent.com` ni `avatars.githubusercontent.com`.
- [ ] Ninguna respuesta HTML ni payload RSC incluye `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET` ni `MICROSOFT_CLIENT_SECRET`.
- [ ] A 375px de ancho no hay scroll horizontal en login, registro y perfil.

## Decisiones

- **Sí:** Google, GitHub y Microsoft. Gratuitos y sin revisión para los scopes básicos. Elegido por el usuario.
- **No:** Apple. Exige la cuenta de desarrollador paga.
- **No:** Facebook. Pide verificación de negocio para producción.
- **No:** Discord. Poco habitual para el público del sitio.
- **Sí:** `socialProviders` de Better Auth. Ya está integrado con el adaptador de Drizzle y la tabla `account`, sin tablas nuevas.
- **Sí:** vinculación automática por email. Una sola cuenta por persona. Elegido por el usuario.
- **No:** rechazar el login si el email ya tiene cuenta. Revela qué emails tienen cuenta.
- **Sí:** borrar la contraseña de una cuenta sin verificar al vincular. Cierra el robo de cuenta previo sin perder la vinculación automática. Elegido por el usuario.
- **No:** aceptar el riesgo o rechazar la vinculación con cuentas sin verificar.
- **Sí:** `trustedProviders` solo con Google y GitHub. Microsoft no siempre verifica el email (nOAuth). Elegido por el usuario.
- **Sí:** Microsoft con `tenantId: "common"`. Acepta cuentas personales y de trabajo sin configurar un tenant.
- **Sí:** botones en login y registro, en el lugar del diseño de SPEC 04. Elegido por el usuario.
- **Sí:** un proveedor sin credenciales no muestra su botón. Build, `test:run` y el job `checks` siguen sin credenciales. Elegido por el usuario.
- **Sí:** los botones se calculan en cada request, con `connection()` dentro de `<Suspense>`. Muchos hostings inyectan las variables solo en runtime, y así no hace falta tenerlas al hacer el build. El resto de la página sigue en el shell estático. Elegido por el usuario después de revisar los riesgos.
- **No:** calcular la lista al prerenderizar. Si las variables no estaban en el build, no aparecía ningún botón hasta volver a hacer el build.
- **Sí:** `fallback={null}` en el `<Suspense>` de los botones. Sin JavaScript ni datos, el formulario de email ya se puede usar. Un esqueleto tendría que adivinar cuántos botones hay.
- **Sí:** un proveedor con una sola de sus dos variables hace fallar la configuración. Es un error de configuración y conviene verlo en vez de ocultar el botón en silencio.
- **No:** exigir todas las variables con Zod. Obliga a tener credenciales en todos los entornos.
- **Sí:** Server Action `signInSocialAction` que llama a `auth.api.signInSocial` y redirige. Sigue el patrón de SPEC 07 y anda sin JavaScript. Elegido por el usuario.
- **No:** `createAuthClient` en el cliente. SPEC 07 ya lo descartó.
- **Sí:** un mensaje genérico para cualquier error OAuth, con `errorCallbackURL: "/cuenta/login"` y cualquier `?error=`. Cancelar y fallar se ven igual. Elegido por el usuario.
- **No:** mensajes por código de error.
- **Sí:** 10 intentos por minuto en `/sign-in/social`. No hay contraseña que adivinar, solo se evita abusar del redirect. Elegido por el usuario.
- **Sí:** tests unitarios y E2E hasta el redirect, con login completo probado a mano. No suma servicios al CI. Elegido por el usuario.
- **No:** un servidor OIDC simulado en Docker y CI.
- **Sí:** "Métodos de acceso" de solo lectura en el perfil. Elegido por el usuario.
- **Sí:** foto del proveedor en el header, con caída a la inicial. Elegido por el usuario.
- **Sí:** `disableProfilePhoto` en Microsoft. Better Auth la guardaría como data URL en base64 en `user.image`. Elegido por el usuario.
- **Sí:** `avatarSrc` con una lista de hosts permitidos. `next/image` lanza con un host fuera de `remotePatterns`.
- **Sí:** texto legal bajo los botones del registro, en texto plano. Las páginas de términos no existen todavía. Elegido por el usuario.
- **Sí:** el texto legal dice "un proveedor" y no la lista. Así no nombra un proveedor deshabilitado.

## Riesgos

| Riesgo                                                                                                        | Mitigación                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los botones llegan en streaming después del shell y el formulario de email baja unos píxeles al aparecer.     | Es el costo de leer el entorno en cada request. El criterio de 375px lo revisa, y `/frontend-design` puede reservar el alto si el salto molesta.                   |
| Una variable de proveedor mal cargada (solo el ID o solo el secret) rompe la sección en runtime, no en el build. | `getSocialProvidersConfig()` también corre al crear la instancia de Better Auth, así que el error aparece en el primer request a `/api/auth` con un mensaje que nombra la variable. |
| En `account.create.before` Better Auth ya marcó `emailVerified = true` y la guardia no borra la contraseña.   | El paso 3 verifica el orden con un test de `db` sobre el flujo de vinculación. Si el orden es otro, la guardia se mueve al hook que corre antes de marcar el email. |
| `resetPassword` no crea la fila `credential` para un usuario solo OAuth.                                      | El criterio manual lo verifica. Si falla, `resetPasswordAction` crea la fila con el hash de Better Auth.                                                            |
| GitHub devuelve el email privado y Better Auth no lo obtiene.                                                 | Better Auth pide el scope `user:email`. Si igual falla, el usuario ve el mensaje genérico y puede usar email.                                                       |
| Las URLs de callback no coinciden entre la consola del proveedor y `BETTER_AUTH_URL`.                         | El README lista la URL exacta por proveedor. El E2E verifica el `redirect_uri`.                                                                                     |
| La foto de Google o GitHub cambia de host o la borra el usuario.                                              | `avatarSrc` devuelve `null` con otro host y el `onError` muestra la inicial.                                                                                        |
| El E2E sale a internet al seguir el redirect.                                                                 | `page.route` intercepta y aborta la request al proveedor.                                                                                                           |
| Un usuario sin verificar pierde la contraseña que puso, si es la dueña real que eligió el proveedor después.  | Puede entrar con el proveedor o crear otra contraseña con "Recuperar".                                                                                              |

## Qué **no** incluye este spec

- Apple, Facebook, Discord y otros proveedores.
- Vincular, desvincular o cambiar la contraseña desde el perfil.
- Editar nombre o foto.
- Foto de Microsoft.
- One Tap de Google y passkeys.
- Servidor OIDC simulado en CI.
- Páginas de Términos y condiciones y de Política de privacidad.

Cada uno de estos, si llega, va en su propio spec.
