# SPEC 23 — Gestión de usuarios

> **Estado:** Aprobado
> **Depende de:** SPEC 07, SPEC 08, SPEC 14, SPEC 16, SPEC 21
> **Fecha:** 2026-11-19
> **Objetivo:** Que el admin busque y filtre usuarios en `/admin/users` y pueda bloquearlos, desbloquearlos, cerrarles las sesiones, reenviarles la verificación y borrar su cuenta.

## Por qué existe este spec

SPEC 07 dejó afuera "Gestionar usuarios desde `/admin`: cambiar roles, banear, impersonar o borrar". Hoy `/admin/users` es una tabla de solo lectura con todos los usuarios en una sola página. No hay forma de frenar a alguien que abusa de los comentarios, ni de borrar una cuenta a pedido.

Tres decisiones marcan el diseño:

- **Bloqueo con columnas propias, no con el plugin `admin` de Better Auth.** El plugin usa los roles `user`/`admin` y obligaría a migrar el enum `user_role` (`lector`/`admin`) y todos sus usos. Se copia solo su mecanismo: un `databaseHooks.session.create.before` que rechaza la sesión de un usuario bloqueado.
- **Los administradores no se tocan.** Bloquear y borrar aplican solo a lectores. El rol no cambia en este spec, así que nunca puede quedar el panel sin admins.
- **Borrar es definitivo y se confirma escribiendo el email.** Se van en cascada sus comentarios, votos y puntuaciones. Un autor de artículos no se puede borrar (`post.author_id` es `RESTRICT`).

**Referencias:**

- `db/schema/auth.ts` (`user`, `session`, `account`), `db/schema/blog.ts` (`post`, `comment`, `comment_vote`, `post_rating`, `author_profile`), `db/schema/media.ts` (`uploaded_by`, `set null`).
- `lib/auth/auth.ts` (`databaseHooks`, `user.additionalFields`), `lib/auth/dal.ts` (`getCurrentUser`, `requireAdmin`, `getLoginMethods`), `actions/cuenta/index.ts` (`toState`, `resendVerificationAction`), `components/auth/login-context.tsx`.
- `node_modules/better-auth/dist/plugins/admin/admin.mjs` (hook de bloqueo) y `api/routes/callback.mjs` (un `APIError` con `code` en el callback OAuth redirige a `errorCallbackURL?error={code}`).
- `app/(admin)/admin/users/page.tsx` (actual), `app/(admin)/admin/tags/` (`tags-search.tsx`, `tags-footer.tsx`, `tag-row-menu.tsx`) y `lib/admin/tag-params.ts` como modelo de tabla, búsqueda, paginación y menú de fila.
- `components/admin/confirm-dialog.tsx`, `components/admin/form-dialog.tsx`, `components/admin/toast.tsx` (`notify`), `components/auth/user-avatar.tsx`, `lib/site.ts` (`site.email`).
- `node_modules/next/dist/docs/01-app/` sobre `searchParams` como promesa, Cache Components y `updateTag`.

## Alcance

**Incluye:**

- **Bloqueo en la autenticación:**
  - `user` suma `banned_at`, `ban_reason` y `banned_by`. Bloqueado = `banned_at IS NOT NULL`.
  - `databaseHooks.session.create.before` en `lib/auth/auth.ts` busca al usuario y, si está bloqueado, lanza `APIError("FORBIDDEN", { code: "ACCOUNT_SUSPENDED" })`. Cubre email y contraseña, Google, GitHub y Microsoft.
  - Bloquear borra todas las filas de `session` del usuario en la misma transacción.
  - Defensa extra: `bannedAt` se declara en `user.additionalFields` (`input: false`) y `getCurrentUser` devuelve `null` si viene con valor.
  - **Mensaje en `/cuenta/login`:** "Tu cuenta está suspendida. Escribinos a {site.email}." Sin el motivo.
    - Login con email: `toState` traduce el código `ACCOUNT_SUSPENDED`.
    - Login con proveedor: el callback redirige a `/cuenta/login?error=ACCOUNT_SUSPENDED` y `login-context.tsx` muestra este mensaje en lugar del genérico de proveedor.
  - Con contraseña incorrecta se sigue viendo "El email o la contraseña no son correctos." (Better Auth chequea la contraseña antes de crear la sesión), así que el mensaje no revela qué emails existen.

- **Página (`page.tsx`, reescrita):**
  - `AdminPageHeader` "Usuarios". Lee `searchParams` y la base dentro de un `<Suspense>` con esqueleto de tabla, después de `requireAdmin()`.
  - Contador "{N} usuarios" / "1 usuario" con la búsqueda y los filtros aplicados.

- **Barra de búsqueda y filtros (`users-toolbar.tsx`, cliente):**
  - Input "Buscar por nombre o email" (`type="search"`, máx. 100) con 300 ms de espera. `ILIKE` escapado sobre `name` y `email`, como `listAdminTags`.
  - Filtro "Estado" (`select`): Todos, Activos, Bloqueados, Sin verificar.
  - Filtro "Rol" (`select`): Todos, Lectores, Administradores.
  - Estado en la URL: `/admin/users?q=ana&estado=bloqueados&rol=lectores&page=2`. "Todos" y la búsqueda vacía no van en la URL. Cambiar búsqueda o filtro vuelve a la página 1.
  - Parámetros inválidos se ignoran; una página fuera de rango se acota a la última, como `tag-params`.

- **Estados de un usuario (excluyentes):**

  | Estado        | Regla                                     | Insignia        |
  | ------------- | ----------------------------------------- | --------------- |
  | Activo        | `banned_at IS NULL` y `email_verified`    | "Activo"        |
  | Sin verificar | `banned_at IS NULL` y no `email_verified` | "Sin verificar" |
  | Bloqueado     | `banned_at IS NOT NULL` (verificado o no) | "Bloqueado"     |

- **Tabla (`users-table.tsx`):**
  - Orden por `created_at` descendente y después `id`. 25 por página. Pie "Mostrando {desde}–{hasta} de {total}" con "Anterior" / "Siguiente" (`users-footer.tsx`, como `tags-footer.tsx`).
  - Columnas:

    | Columna          | Contenido                                                                                           |
    | ---------------- | --------------------------------------------------------------------------------------------------- |
    | Usuario          | `UserAvatar`, nombre y email debajo. Un "(vos)" junto al nombre del admin que mira.                 |
    | Rol              | "Lector" o "Administrador".                                                                         |
    | Estado           | Insignia. Si está bloqueado, debajo "desde {fecha}".                                                |
    | Acceso           | Íconos de los métodos de `getLoginMethods` (email, Google, GitHub, Microsoft) con nombre accesible. |
    | Última actividad | `max(session.updated_at)` del usuario con `formatDate`; sin sesiones, "Sin sesiones".               |
    | Alta             | `formatDate(created_at)`.                                                                           |
    | "Más acciones"   | Menú de fila.                                                                                       |

  - Por debajo de `md` cada fila pasa a tarjeta con `data-label`, como hoy.
  - Estados vacíos: "Todavía no hay usuarios." (sin filtros) y "No hay usuarios que coincidan con estos filtros." (con búsqueda o filtros), este último con el botón "Limpiar filtros" que va a `/admin/users`.

- **Menú de fila (`user-row-menu.tsx`, como `tag-row-menu.tsx`):**

  | Ítem                    | Visible cuando               | Deshabilitado cuando (con el motivo debajo del ítem)                                                                 |
  | ----------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
  | "Bloquear"              | No está bloqueado            | Es admin: "Los administradores no se pueden bloquear."                                                               |
  | "Desbloquear"           | Está bloqueado               | Nunca.                                                                                                               |
  | "Cerrar sesiones"       | Siempre                      | Es el admin que mira: "Para cerrar tu sesión usá «Cerrar sesión»." · Tiene 0 sesiones: "No tiene sesiones abiertas." |
  | "Reenviar verificación" | Sin verificar y no bloqueado | Nunca.                                                                                                               |
  | "Borrar cuenta"         | Siempre                      | Es admin: "Los administradores no se pueden borrar." · Es autor: "Es autor de {N} artículos: no se puede borrar."    |

- **Bloquear (`ban-dialog.tsx`, `<dialog>` nativo como `FormDialog`):**
  - Título "Bloquear a {nombre}". Texto: "No va a poder iniciar sesión y se cierran sus {N} sesiones abiertas. Sus comentarios siguen publicados."
  - Campo "Motivo (solo lo ven los administradores)": `textarea` obligatorio, `trim`, máx. 300, con contador.
  - Botones "Cancelar" y "Bloquear" (spinner y "Bloqueando…").
  - Errores debajo del campo (`aria-invalid`, `aria-describedby`) y foco al campo con error. La misma validación corre en el cliente y en el servidor.
  - Guarda `banned_at = now()`, `ban_reason` y `banned_by` = id del admin.

- **Desbloquear:** `ConfirmDialog` "¿Desbloquear a {nombre}?" / "Bloqueado el {fecha} por {admin}. Motivo: «{motivo}». Va a poder volver a iniciar sesión." / "Desbloquear". Si `banned_by` quedó vacío, "por un administrador". Pone las tres columnas en `NULL`.

- **Cerrar sesiones:** `ConfirmDialog` "¿Cerrar las sesiones de {nombre}?" / "Se cierran sus {N} sesiones abiertas. Puede volver a iniciar sesión." / "Cerrar sesiones". Borra sus filas de `session`. Vale también para otros admins.

- **Reenviar verificación:** sin diálogo. Llama a `getAuth().api.sendVerificationEmail` con `callbackURL` `/cuenta/verificar?estado=ok` (el mismo de `actions/cuenta`) y muestra el toast. Solo para usuarios sin verificar y no bloqueados; el servidor lo vuelve a chequear.

- **Borrar cuenta (`delete-user-dialog.tsx`, `<dialog>` nativo):**
  - Título "Borrar la cuenta de {nombre}".
  - Lista lo que se borra: "{N} comentarios", "{M} puntuaciones" y "{K} votos en comentarios" (las que no son 0; con todo en 0, "No tiene comentarios ni puntuaciones."). Debajo: "Las imágenes que subió quedan en Medios. No se puede deshacer."
  - Input "Escribí {email} para confirmar". "Borrar cuenta" se habilita solo cuando el texto, con `trim`, es igual al email sin distinguir mayúsculas.
  - El servidor repite esa comparación y rechaza si no coincide.
  - En una transacción: vuelve a chequear que no sea admin ni autor y borra la fila de `user`. `session`, `account`, `author_profile`, `comment`, `comment_vote` y `post_rating` caen en cascada; `media.uploaded_by` queda en `NULL`.
  - Invalida `blog` con `updateTag`, porque los comentarios y las puntuaciones salen en el blog público.

- **Server Actions (`actions/admin/users/index.ts`):**
  - `banUserAction(prev, data)` (`id`, `reason`), `unbanUserAction(prev, data)` (`id`), `revokeUserSessionsAction(prev, data)` (`id`), `resendUserVerificationAction(prev, data)` (`id`) y `deleteUserAction(prev, data)` (`id`, `confirmEmail`).
  - Todas llaman a `requireAdmin()` antes de tocar la base, validan con Zod y llaman a `revalidatePath("/admin/users")` si cambiaron algo. `deleteUserAction` además llama a `updateTag("blog")`.
  - Las reglas de protección (admin, uno mismo, autor, estado) se chequean en el servidor aunque el menú ya las deshabilite.
  - Mensajes:

    | Caso                                 | Mensaje                                                               |
    | ------------------------------------ | --------------------------------------------------------------------- |
    | Bloqueado                            | "{nombre} quedó bloqueado. Se cerraron {N} sesiones."                 |
    | Desbloqueado                         | "{nombre} ya puede volver a iniciar sesión."                          |
    | Sesiones cerradas                    | "Se cerraron {N} sesiones de {nombre}."                               |
    | Verificación reenviada               | "Le reenviamos el email de verificación a {email}."                   |
    | Cuenta borrada                       | "Se borró la cuenta de {nombre}."                                     |
    | Motivo vacío (campo)                 | "Escribí el motivo del bloqueo."                                      |
    | Motivo largo (campo)                 | "El motivo puede tener hasta 300 caracteres."                         |
    | Email de confirmación no coincide    | "El email no coincide."                                               |
    | Destino admin                        | "No se puede hacer esto con un administrador."                        |
    | Uno mismo (cerrar sesiones)          | "Para cerrar tu sesión usá «Cerrar sesión»."                          |
    | Autor al borrar                      | "No se puede borrar: es autor de {N} artículos."                      |
    | Ya bloqueado / ya desbloqueado       | "Ese usuario ya estaba bloqueado." / "Ese usuario no está bloqueado." |
    | Ya verificado o bloqueado (reenviar) | "Ese usuario ya no necesita verificar su email."                      |
    | Id inexistente                       | "Ese usuario ya no existe."                                           |
    | Error de base o de envío             | "No pudimos completar la acción. Intentá de nuevo en unos minutos."   |

- **Diseño:** barra, tabla, insignias, íconos de acceso, menú de fila, los dos modales propios y los estados vacíos se hacen con `/frontend-design`, siguiendo `/admin/tags` y los tokens `cms-*`. Todos los controles miden 44 px o más y cumplen 4.5:1 de contraste. A 390 px no hay scroll horizontal y los modales ocupan la pantalla.

- **Tests (casos en los criterios de aceptación):**
  - Vitest `server`: `__tests__/server/user-params.test.ts` y `__tests__/server/user-form.test.ts`, nuevos; `dal-current-user.test.ts` suma casos.
  - Vitest `db`: `__tests__/db/admin-users.test.ts` y `__tests__/db/users-actions.test.ts`, nuevos; `auth.test.ts` suma casos.
  - Vitest `client`: `__tests__/client/users-toolbar.test.tsx`, `__tests__/client/user-row-menu.test.tsx`, `__tests__/client/ban-dialog.test.tsx` y `__tests__/client/delete-user-dialog.test.tsx`, nuevos; `login-form.test.tsx` suma el caso de cuenta suspendida.
  - Playwright: `e2e/usuarios.spec.ts`, nuevo; `admin.spec.ts` ajusta "Usuarios: columnas y contador"; `auth.spec.ts` y `oauth.spec.ts` siguen pasando.

**Fuera de alcance (para specs futuros):**

- Cambiar el rol de un usuario (lector ↔ administrador).
- Bloquear o borrar administradores.
- Bloqueo con vencimiento.
- Avisar por email al bloquear, desbloquear o borrar.
- Mostrarle el motivo al usuario bloqueado.
- Ocultar o moderar en bloque los comentarios de un usuario bloqueado.
- Reasignar los artículos de un autor para poder borrarlo.
- Página o modal de detalle por usuario (`/admin/users/[id]`), lista de sesiones con dispositivo e IP.
- Impersonar usuarios.
- Crear o invitar usuarios desde el panel, editar nombre o email, marcar verificado a mano.
- Historial de acciones de administración (auditoría).
- Acciones en lote y exportar la lista.
- Que el usuario borre su propia cuenta desde `/cuenta/perfil`.

## Modelo de datos

Una migración nueva, `db/migrations/0007_bloqueo_de_usuarios.sql` (generada con drizzle-kit):

- `user.banned_at timestamp NULL`, `user.ban_reason text NULL`, `user.banned_by text NULL REFERENCES "user"(id) ON DELETE SET NULL`.
- `CHECK user_ban_check`: `(banned_at IS NULL) = (ban_reason IS NULL)`.
- `CHECK user_ban_reason_check`: `ban_reason IS NULL OR length(trim(ban_reason)) BETWEEN 1 AND 300`.

`session`, `account` y las tablas del blog no cambian.

```ts
// db/schema/auth.ts (cambia): user suma
bannedAt: timestamp(), // null = no bloqueado
banReason: text(),
bannedBy: text().references((): AnyPgColumn => user.id, { onDelete: "set null" }),

// lib/auth/auth.ts (cambia)
// user.additionalFields suma bannedAt: { type: "date", required: false, input: false }
// databaseHooks.session.create.before lanza APIError("FORBIDDEN", { code: SUSPENDED_CODE })

// lib/auth/suspension.ts (nuevo, "server-only")
export const SUSPENDED_CODE = "ACCOUNT_SUSPENDED";
export async function assertNotSuspended(userId: string): Promise<void>;

// lib/auth/messages.ts (nuevo, sin dependencias de servidor)
export const SUSPENDED_MESSAGE: string; // "Tu cuenta está suspendida. Escribinos a {site.email}."

// lib/admin/user-params.ts (nuevo, como tag-params.ts)
export const USER_STATUS_FILTERS = ["activos", "bloqueados", "sin-verificar"] as const;
export const USER_ROLE_FILTERS = ["lectores", "admins"] as const;
export type AdminUserQuery = {
  q: string | null;
  estado: (typeof USER_STATUS_FILTERS)[number] | null; // null = Todos
  rol: (typeof USER_ROLE_FILTERS)[number] | null; // null = Todos
  page: number;
};
export const USERS_PER_PAGE = 25;
export function parseUserParams(
  params: Record<string, string | string[] | undefined>,
): AdminUserQuery;
export function userQueryHref(query: AdminUserQuery): string; // "/admin/users?q=…&estado=…&rol=…&page=…"

// lib/admin/user-form.ts (nuevo, sin dependencias de servidor)
export const USER_FORM_LIMITS = { banReason: 300, query: 100 } as const;
export function parseBanForm(
  data: FormData,
): { ok: true; id: string; reason: string } | { ok: false; fieldErrors: Partial<Record<"id" | "reason", string>> };
export function isDeleteConfirmed(typed: string, email: string): boolean; // trim + sin mayúsculas

// db/admin-users.ts (nuevo, "server-only", sin caché)
export type UserStatus = "activo" | "sin-verificar" | "bloqueado";
export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  status: UserStatus;
  bannedAt: Date | null;
  banReason: string | null;
  bannedByName: string | null;
  methods: LoginMethod[];
  lastActiveAt: Date | null; // max(session.updated_at)
  sessions: number;
  posts: number; // artículos como autor, de cualquier estado
  comments: number;
  ratings: number;
  votes: number;
  createdAt: Date;
};
export type AdminUserList = { items: AdminUserRow[]; total: number; page: number; pageCount: number };
export async function listAdminUsers(query: AdminUserQuery): Promise<AdminUserList>;

type Guarded<T> = T | { ok: false; reason: "not-found" | "protected" };
export async function banUser(
  id: string,
  reason: string,
  by: string,
): Promise<Guarded<{ ok: true; name: string; revoked: number } | { ok: false; reason: "already" }>>;
export async function unbanUser(
  id: string,
): Promise<{ ok: true; name: string } | { ok: false; reason: "not-found" | "not-banned" }>;
export async function revokeUserSessions(
  id: string,
): Promise<{ ok: true; name: string; revoked: number } | { ok: false; reason: "not-found" }>;
export async function deleteUser(
  id: string,
  confirmEmail: string,
): Promise<
  Guarded<
    | { ok: true; name: string }
    | { ok: false; reason: "author"; posts: number }
    | { ok: false; reason: "mismatch" }
  >
>;
// "protected" = el destino es admin.

// actions/admin/users/index.ts (nuevo)
export type UserActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message?: string; fieldErrors?: Partial<Record<"reason" | "confirmEmail", string>> };
```

Archivos nuevos:

- `app/(admin)/admin/users/`: `users-toolbar.tsx`, `users-table.tsx`, `users-footer.tsx`, `user-row-menu.tsx`, `ban-dialog.tsx` y `delete-user-dialog.tsx`.
- `actions/admin/users/index.ts`, `db/admin-users.ts`.
- `lib/admin/user-params.ts`, `lib/admin/user-form.ts`, `lib/auth/suspension.ts`, `lib/auth/messages.ts`.
- `db/migrations/0007_bloqueo_de_usuarios.sql` y su snapshot.

Archivos que cambian: `db/schema/auth.ts`, `lib/auth/auth.ts`, `lib/auth/dal.ts`, `actions/cuenta/index.ts` (`toState`), `components/auth/login-context.tsx` y `app/(admin)/admin/users/page.tsx`.

Convenciones:

- Bloqueado = `banned_at IS NOT NULL`. No hay columna booleana aparte.
- El motivo es interno. Nunca sale en una pantalla pública ni en un mensaje al usuario.
- El panel opera siempre por `id`. Las consultas del panel no usan caché.
- Admin protegido = `role = 'admin'`. Uno mismo es siempre admin, así que la protección lo cubre para bloquear y borrar.

## Plan de implementación

1. **Migración y bloqueo en la autenticación.** Columnas y `CHECK`, `additionalFields.bannedAt`, `assertNotSuspended` en `session.create.before`, `getCurrentUser` con `null` para bloqueados, `SUSPENDED_MESSAGE` en `toState` y en `login-context.tsx`. Casos en `auth.test.ts`, `dal-current-user.test.ts` y `login-form.test.tsx`. Prueba: `npm run test:run` y `npm run test:db` pasan, y un usuario marcado a mano con `banned_at` no puede entrar.
2. **Utilidades.** `lib/admin/user-params.ts` y `lib/admin/user-form.ts`, con `user-params.test.ts` y `user-form.test.ts`. Prueba: `npm run test:run` pasa.
3. **Consultas.** `db/admin-users.ts` con listado, filtros, conteos y las cuatro escrituras, con `admin-users.test.ts`. Prueba: `npm run test:db` pasa.
4. **Actions.** `actions/admin/users/index.ts` con `users-actions.test.ts`. Prueba: `npm run test:db` pasa.
5. **Tabla y barra.** `page.tsx` reescrita leyendo `searchParams` dentro del `<Suspense>`, `users-toolbar.tsx`, `users-table.tsx`, `users-footer.tsx` y `user-row-menu.tsx` con "Reenviar verificación" y los ítems deshabilitados con su motivo. Diseño con `/frontend-design`. `users-toolbar.test.tsx` y `user-row-menu.test.tsx`; ajustar `admin.spec.ts`. Prueba: `npm run test:run` pasa y a mano se busca, filtra y pagina con el seed.
6. **Bloquear, desbloquear y cerrar sesiones.** `ban-dialog.tsx` y los dos `ConfirmDialog`, conectados al menú. Diseño con `/frontend-design`. `ban-dialog.test.tsx`. Prueba: `npm run test:run` pasa y a mano se bloquea y desbloquea un lector.
7. **Borrar cuenta.** `delete-user-dialog.tsx` conectado al menú. Diseño con `/frontend-design`. `delete-user-dialog.test.tsx`. Prueba: `npm run test:run` pasa y a mano se borra un lector con comentarios.
8. **E2E.** `e2e/usuarios.spec.ts`. Prueba: `npm run test:e2e` pasa completo.

## Criterios de aceptación

**General**

- [ ] `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `npm run build` termina sin errores con Docker apagado, sin `DATABASE_URL` y sin `MEDIA_DIR`.
- [ ] `npm run test:run` pasa con Docker apagado.
- [ ] `npm run test:db` pasa con Docker levantado.
- [ ] `npm run test:e2e` pasa completo, con `auth.spec.ts` y `oauth.spec.ts` sin cambios en sus casos.
- [ ] `package.json` no suma dependencias y `lib/auth/auth.ts` no suma el plugin `admin` de Better Auth.

**Autenticación (`db`, `server`, `client`)**

- [ ] Insertar un usuario con `banned_at` y sin `ban_reason`, o con un `ban_reason` de solo espacios, falla por la base.
- [ ] Con `banned_at` puesto, `signInEmail` con la contraseña correcta lanza un `APIError` con código `ACCOUNT_SUSPENDED` y no crea filas en `session`.
- [ ] Con `banned_at` puesto, `signInEmail` con una contraseña incorrecta sigue dando `INVALID_EMAIL_OR_PASSWORD`.
- [ ] `getCurrentUser` devuelve `null` para una sesión válida de un usuario con `bannedAt`.
- [ ] `signInAction` de un usuario bloqueado devuelve "Tu cuenta está suspendida. Escribinos a {site.email}.".
- [ ] `LoginContext` con `?error=ACCOUNT_SUSPENDED` muestra el mensaje de cuenta suspendida y no el de proveedor; con `?error=access_denied` sigue mostrando el de proveedor.

**Utilidades (`server`)**

- [ ] `parseUserParams({ q: "  ana ", estado: "bloqueados", rol: "lectores", page: "2" })` devuelve esos valores con `q: "ana"`; `estado: "otro"`, `rol: "otro"`, `page: "0"` y `page: "abc"` caen a `null` o `1`; una `q` de 101 caracteres se recorta a 100.
- [ ] `userQueryHref` con todo en `null` y `page: 1` devuelve `/admin/users`; con todo, `/admin/users?q=ana&estado=bloqueados&rol=lectores&page=2`.
- [ ] `parseBanForm` con motivo vacío, de solo espacios o de 301 caracteres, o con un `id` vacío, devuelve el error en el campo correspondiente.
- [ ] `isDeleteConfirmed(" Ana@Mail.com ", "ana@mail.com")` es `true`; con `"ana@mail.co"` es `false`.

**Consultas (`admin-users.test.ts`)**

- [ ] `listAdminUsers` ordena por alta descendente, pagina de a 25 y busca por nombre o email; `q: "50%"` no devuelve todos.
- [ ] Los filtros `activos`, `bloqueados` y `sin-verificar` devuelven conjuntos disjuntos que suman el total; un bloqueado sin verificar solo sale en `bloqueados`.
- [ ] `rol: "admins"` combinado con `estado` y `q` aplica los tres filtros a la vez.
- [ ] Cada fila trae `methods`, `sessions`, `lastActiveAt` (o `null` sin sesiones), `posts`, `comments`, `ratings`, `votes` y `bannedByName` correctos.
- [ ] `banUser` sobre un lector con 2 sesiones guarda `banned_at`, `ban_reason` y `banned_by`, borra las 2 sesiones y devuelve `revoked: 2`.
- [ ] `banUser` sobre un admin devuelve `protected`; sobre un bloqueado, `already`; con un id inexistente, `not-found`; en los tres casos no cambia nada.
- [ ] `unbanUser` pone las tres columnas en `NULL`; sobre uno no bloqueado devuelve `not-banned`.
- [ ] `revokeUserSessions` borra solo las sesiones de ese usuario y devuelve cuántas.
- [ ] `deleteUser` de un lector con comentarios, votos, puntuaciones y una imagen subida borra al usuario, sus comentarios, votos, puntuaciones, sesiones y cuentas, y deja la imagen con `uploaded_by` en `NULL`.
- [ ] `deleteUser` de un autor devuelve `author` con su cantidad de artículos; de un admin, `protected`; con un email que no coincide, `mismatch`; en los tres casos no borra nada.

**Actions (`users-actions.test.ts`)**

- [ ] Cada action llama a `requireAdmin()` antes de tocar la base y, si cambió algo, a `revalidatePath("/admin/users")`.
- [ ] `deleteUserAction` llama a `updateTag("blog")`; las demás no.
- [ ] `revokeUserSessionsAction` sobre el admin que la llama devuelve "Para cerrar tu sesión usá «Cerrar sesión»." y no borra su sesión.
- [ ] `resendUserVerificationAction` sobre un usuario sin verificar llama a `sendVerificationEmail` con su email; sobre uno verificado o bloqueado devuelve "Ese usuario ya no necesita verificar su email." sin enviar.
- [ ] Las actions devuelven los mensajes de la tabla de mensajes para cada caso de éxito y de error.
- [ ] Después de `banUserAction`, una sesión que el usuario tenía abierta deja de valer: `getSession` con su cookie devuelve `null`.
- [ ] Borrar un lector que comentó un artículo publicado hace que `getPublishedPostBySlug` y los comentarios de ese artículo ya no lo incluyan.

**Componentes (`client`)**

- [ ] `UsersToolbar`: escribir llama a `router.replace` una sola vez 300 ms después de la última tecla, con `?q=…` y sin `page`; elegir "Bloqueados" lo hace con `?estado=bloqueados`; elegir "Todos" lo quita.
- [ ] `UserRowMenu` de un admin muestra "Bloquear" y "Borrar cuenta" deshabilitados con su motivo; del admin que mira, "Cerrar sesiones" deshabilitado con "Para cerrar tu sesión usá «Cerrar sesión»."; de un autor, "Borrar cuenta" deshabilitado con "Es autor de {N} artículos…".
- [ ] `UserRowMenu` muestra "Desbloquear" en lugar de "Bloquear" para un bloqueado, y "Reenviar verificación" solo para un sin verificar no bloqueado.
- [ ] `BanDialog` con el motivo vacío muestra "Escribí el motivo del bloqueo.", pone el foco en el campo y no llama a la action.
- [ ] `DeleteUserDialog` lista "{N} comentarios", "{M} puntuaciones" y "{K} votos en comentarios" omitiendo los que son 0, y "Borrar cuenta" sigue deshabilitado hasta escribir el email exacto.

**Usuarios (E2E, `usuarios.spec.ts`)**

- [ ] "Usuarios" en la barra lateral lleva a `/admin/users` con la tabla, el contador y las columnas Usuario, Rol, Estado, Acceso, Última actividad y Alta.
- [ ] Buscar parte de un email deja solo los que coinciden, la URL queda con `?q=` y recargar mantiene la búsqueda; "Limpiar filtros" en el estado vacío vuelve a `/admin/users`.
- [ ] Bloquear un lector con motivo muestra el toast, la fila pasa a "Bloqueado" y, en otro contexto del navegador donde ese lector tenía sesión, recargar `/cuenta/perfil` lleva a `/cuenta/login`.
- [ ] Ese lector bloqueado intenta entrar con su contraseña y ve "Tu cuenta está suspendida. Escribinos a {site.email}."; con una contraseña incorrecta ve "El email o la contraseña no son correctos.".
- [ ] "Desbloquear" muestra el motivo y quién bloqueó; después el lector puede iniciar sesión.
- [ ] "Cerrar sesiones" de un lector con sesión abierta lo deja sin sesión y puede volver a entrar.
- [ ] "Reenviar verificación" de un usuario sin verificar muestra el toast y llega un email de verificación a su dirección.
- [ ] "Borrar cuenta" de un lector con un comentario pide el email, borra la cuenta, la fila desaparece y el comentario ya no sale en el artículo.
- [ ] En la fila del admin del seed, "Bloquear" y "Borrar cuenta" están deshabilitados.
- [ ] Sin sesión, `/admin/users` redirige a `/cuenta/login`; con un lector, da 404.
- [ ] A 390 px la tabla pasa a tarjetas, los modales ocupan la pantalla y no hay scroll horizontal.
- [ ] La barra, la tabla, el menú y los modales cumplen 4.5:1 de contraste y todos sus controles miden 44 px o más (revisado con `/frontend-design`).

## Decisiones

- **Sí:** bloquear/desbloquear, cerrar sesiones y borrar cuenta. Elegido por el usuario.
- **No:** cambiar el rol. Elegido por el usuario. Queda para otro spec, junto con la regla de no quedarse sin admins.
- **Sí:** columnas propias en `user` y un hook `session.create.before`. Elegido por el usuario. No toca el enum `user_role`.
- **No:** el plugin `admin` de Better Auth. Trae roles `user`/`admin` que chocan con `lector`/`admin` y endpoints (impersonar, crear usuarios) que no se usan.
- **Sí:** `banned_at` nulo como única marca de bloqueo, en vez de `banned boolean` + fecha. Una sola fuente de verdad y el `CHECK` ata el motivo a la fecha.
- **Sí:** bloqueo permanente hasta desbloquear. Elegido por el usuario.
- **No:** bloqueo con vencimiento. Suma una fecha, una UI de duración y un desbloqueo automático por poco uso.
- **Sí:** mensaje genérico "Tu cuenta está suspendida. Escribinos a {site.email}." sin el motivo. Elegido por el usuario.
- **No:** responder como credenciales inválidas. El usuario no entendería por qué no puede entrar.
- **Sí:** el mensaje de suspendida solo sale con la contraseña correcta. Better Auth chequea la contraseña antes de crear la sesión, así que no revela qué emails tienen cuenta.
- **Sí:** bloquear cierra todas las sesiones en la misma transacción, y `getCurrentUser` ignora a los bloqueados. Sin `cookieCache` la sesión se lee de la base, pero la segunda barrera cubre una sesión creada justo antes del bloqueo.
- **Sí:** motivo interno obligatorio de hasta 300 caracteres, con fecha y admin que bloqueó. Elegido por el usuario.
- **No:** avisar por email. Elegido por el usuario.
- **Sí:** los comentarios de un bloqueado quedan publicados. Elegido por el usuario. Moderar comentarios es otro tema.
- **Sí:** no se puede borrar a un autor de artículos. Elegido por el usuario. `post.author_id` ya es `RESTRICT`.
- **No:** reasignar los artículos antes de borrar. Más UI para un caso raro con un solo autor.
- **Sí:** confirmar el borrado escribiendo el email. Elegido por el usuario. Es la única acción del panel que borra datos de terceros en cascada.
- **Sí:** las imágenes que subió quedan en Medios (`uploaded_by` en `NULL`). Ya es el `ON DELETE SET NULL` de SPEC 10 y pueden estar en artículos.
- **Sí:** bloquear y borrar no aplican a administradores, ni a uno mismo. Elegido por el usuario. Sin cambio de rol en este spec, nunca puede quedar el panel sin admins.
- **Sí:** "Cerrar sesiones" vale para otros admins pero no para uno mismo. Cerrar la propia ya existe con "Cerrar sesión".
- **Sí:** búsqueda por nombre o email, filtros de estado y de rol, y paginación de a 25 con estado en la URL. Elegido por el usuario. Mismo modelo que `/admin/tags`.
- **Sí:** estados excluyentes Activo / Sin verificar / Bloqueado. Bloqueado gana sobre sin verificar para que los filtros sumen el total.
- **Sí:** acciones en un menú "Más acciones" por fila con modales. Elegido por el usuario.
- **No:** página o modal de detalle por usuario. Las acciones caben en el menú y los datos en la tabla.
- **Sí:** "Reenviar verificación" y las columnas Acceso y Última actividad. Elegido por el usuario.
- **Sí:** "Última actividad" sale de `max(session.updated_at)`, sin columna nueva. Con `updateAge` de un día la precisión es diaria, que alcanza para la tabla.
- **No:** columna `last_login_at`. Otro hook y otra migración para ganar precisión que la tabla no muestra.
- **Sí:** `deleteUserAction` invalida `blog`. Los comentarios y puntuaciones del usuario salen en el blog público y todas sus cachés llevan la etiqueta `blog`.
- **Sí:** tests `server`, `db`, `client` y E2E. Elegido por el usuario.

## Riesgos

| Riesgo                                                                                                      | Mitigación                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Una actualización de Better Auth cambia cómo el callback OAuth reporta un `APIError` del hook.              | Hoy redirige a `errorCallbackURL?error={code}` (`callback.mjs`). Si cambia, se ve el mensaje genérico de proveedor y la sesión igual no se crea; test `client` del mensaje y `oauth.spec.ts`. |
| El hook `session.create.before` suma una consulta a cada login.                                             | Es una lectura por clave primaria y solo corre al crear la sesión, no en cada request.                                                                                                        |
| Un login en curso crea la sesión justo antes de que el bloqueo borre las sesiones.                          | `getCurrentUser` devuelve `null` si `bannedAt` tiene valor, así que esa sesión no sirve; test `server`.                                                                                       |
| Las acciones del menú se llaman a mano sobre un admin o sobre uno mismo.                                    | Cada regla se vuelve a chequear en el servidor dentro de la transacción; tests `db` de `protected` y del caso propio.                                                                         |
| Los conteos por fila (sesiones, comentarios, votos, puntuaciones, artículos, métodos) hacen lenta la tabla. | Subconsultas agregadas sobre las 25 filas de la página, con los índices por `user_id` que ya existen.                                                                                         |
| Borrar un usuario deja cachés del blog con sus comentarios.                                                 | `deleteUserAction` llama a `updateTag("blog")`; test `db` y E2E de que el comentario desaparece.                                                                                              |
| Leer `searchParams` o la base fuera de `<Suspense>` rompe el build con Cache Components.                    | Toda lectura va dentro del `<Suspense>` de la página; el build sin `DATABASE_URL` lo prueba.                                                                                                  |

## Qué **no** incluye este spec

- Cambiar roles, y bloquear o borrar administradores.
- Bloqueo con vencimiento, emails de aviso y mostrar el motivo al usuario.
- Moderar los comentarios de un bloqueado.
- Reasignar artículos para borrar a un autor.
- Detalle por usuario, sesiones con dispositivo e IP, impersonar.
- Crear, invitar o editar usuarios desde el panel.
- Auditoría, acciones en lote y exportar.
- Borrar la propia cuenta desde el perfil.

Cada uno de estos, si llega, va en su propio spec.
