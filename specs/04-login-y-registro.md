# SPEC 04 — Login y registro

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 03
> **Fecha:** 2026-11-14
> **Objetivo:** Maquetar `/cuenta/login`, `/cuenta/registro` y `/cuenta/recuperar` según los artboards `Login` y `Registro` del diseño de Claude Design, sin backend de cuentas.

## Por qué existe este spec

SPEC 03 dejó "Ingresar" en el header y "Ingresar" y "Crear cuenta" en la sección de comentarios como botones visuales, sin destino.
Este spec es **solo diseño**: las páginas existen y se ven como en el artboard, pero no crean ni abren sesión.
Un spec posterior agrega las cuentas (proveedor de auth, sesión y base de datos) sin cambiar las plantillas.

Los artboards ocupan toda la pantalla, sin el header ni el footer del sitio.
Por eso el header y el footer pasan del layout raíz a un route group `(site)`, y las páginas de cuenta quedan afuera de ese grupo.

**Fuente del diseño:** el canvas https://claude.ai/artifact/C2LN5ysoCWnCeBgrekb5bw, artboards `project/Login.dc.html` y `project/Registro.dc.html`.
Se leen con la herramienta Artifact (`action: "read"`, `path: "project/Login.dc.html"`).
Son la referencia de layout, espaciados, colores, copys, íconos y animaciones.
Ante cualquier duda visual, gana el artboard, salvo en lo que se excluye abajo.
`/cuenta/recuperar` no tiene artboard: usa el layout de `Login` con los textos definidos en este spec.

## Alcance

**Incluye:**

- Route group `app/(site)/` con un `layout.tsx` que renderiza `SiteHeader`, `children` y `SiteFooter`. La home, `/blog` y `/servicios/[slug]` se mueven adentro. Las URLs no cambian.
- `app/layout.tsx` deja de renderizar el header y el footer. Mantiene las fuentes, `globals.css` y la metadata.
- Tres páginas en `app/cuenta/`, sin header ni footer, con el layout dividido del artboard: panel oscuro a la izquierda y formulario a la derecha sobre `#F4F7FD`. Debajo de 960px (dos columnas de 480px) el panel va arriba y el formulario abajo.
- **Panel oscuro** (compartido): grilla animada, orbe, anillo punteado, logo con "Courroux Digital" (link a `/`), botón "Volver al blog", prompt `$ …`, `h1`, bajada, card animada "Vos ★★★★★ ¡Muy útil, lo voy a aplicar!" con el globo "El autor respondió tu comentario", y 3 ítems con check.
- **`/cuenta/login`** ("Iniciar sesión"):
  - Panel: `$ login --lector`, "Sumate a la conversación del blog", la bajada del artboard y los checks "Comentá cada artículo", "Puntuá lo que leíste" y "Enterate cuando te respondan".
  - Formulario: "Iniciá sesión", "Bienvenido de nuevo. Ingresá con tu cuenta para participar.", "Continuar con Google", separador "o con tu email", Email, Contraseña (con mostrar u ocultar), "Recordarme", "¿Olvidaste tu contraseña?" (link a `/cuenta/recuperar`), botón "Ingresar" y "¿No tenés cuenta? Creá una gratis" (link a `/cuenta/registro`).
- **`/cuenta/registro`** ("Crear cuenta"):
  - Panel: `$ registro --nuevo-lector`, "Creá tu cuenta en segundos", la bajada del artboard y los checks "Gratis y sin publicidad", "Comentarios y puntuaciones" y "Te das de baja cuando quieras".
  - Formulario: "Crear cuenta", "Completá tus datos para empezar a participar.", "Continuar con Google", separador, "Nombre y apellido", Email, Contraseña (con mostrar u ocultar), medidor de seguridad de 4 segmentos, checkbox "Acepto los Términos y condiciones y la Política de privacidad.", botón "Crear cuenta" y "¿Ya tenés cuenta? Iniciá sesión" (link a `/cuenta/login`).
- **`/cuenta/recuperar`** ("Recuperar contraseña"), sin artboard:
  - Panel: `$ recuperar --contraseña`, "Volvé a entrar en un minuto", bajada "Te mandamos un link a tu email para que crees una contraseña nueva." y los checks "Link válido por 1 hora", "Tu cuenta sigue segura" y "Sin perder tus comentarios". Mantiene la card animada.
  - Formulario: "Recuperá tu contraseña", "Te enviamos un link para crear una nueva.", Email, botón "Enviar link" y "¿Te acordaste? Iniciá sesión" (link a `/cuenta/login`). Sin botón de Google ni separador.
- Interacciones locales que funcionan:
  - Mostrar u ocultar la contraseña. El botón cambia de ícono y de `aria-label` ("Mostrar contraseña" / "Ocultar contraseña").
  - Medidor de seguridad en registro, con la lógica del artboard. Suma 1 punto por cada regla: 8 o más caracteres, mayúsculas y minúsculas, un número y un símbolo. Etiqueta: "Escribí una contraseña", "Débil", "Media", "Buena" o "Fuerte".
- Envío del formulario: validación nativa de HTML (`required`, `type="email"`, `minLength={8}` en la contraseña de registro y el checkbox de términos `required`). Si es válido, no navega y muestra arriba del botón un recuadro con `role="status"`: "Las cuentas todavía no están disponibles. Muy pronto vas a poder ingresar.". El recuadro queda visible.
- "Volver al blog" lleva al artículo de origen si la URL trae `?volver=/blog/{slug}` con un slug que existe. Si no, lleva a `/blog`. El texto no cambia.
- Links que pasan a apuntar a las páginas nuevas:
  - "Ingresar" del header (desktop y mobile) → `/cuenta/login`.
  - "Ingresar" de la sección de comentarios → `/cuenta/login?volver=/blog/{slug}`.
  - "Crear cuenta" de la sección de comentarios → `/cuenta/registro?volver=/blog/{slug}`.
- Redirect de `/cuenta` a `/cuenta/login` en `next.config.ts`, como el de `/servicios` de SPEC 02.
- Metadata por página: `title` "Iniciar sesión", "Crear cuenta" y "Recuperar contraseña" (con el template "· Courroux Digital"), una `description` corta, `alternates.canonical` y `robots: { index: false, follow: true }`.
- Las animaciones del artboard (`fx-grid`, `fx-orb1`, `fx-orb2`, `fx-ring`, `fx-float`, `fx-float2`, `fx-beam`, `fx-rise` con `d1`–`d4`, `fx-reveal`, `fx-btn`, `fx-ghost`, `fx-card`, `fx-input`, `au-star`, `au-type`, `au-check`). Se reutilizan las que existen en `app/globals.css` y se suman las que faltan. Se desactivan con `prefers-reduced-motion: reduce`.

**Fuera de alcance (para specs futuros):**

- Cuentas reales: proveedor de auth, sesión, base de datos, cookies y middleware/proxy.
- Login con Google: el botón es solo visual y no hace nada.
- Envío real del email de recuperación y la página para crear la contraseña nueva.
- "Recordarme": el checkbox es solo visual.
- Páginas de Términos y condiciones y de Política de privacidad: los textos se ven como links, pero no llevan a ningún lado.
- Newsletter: el checkbox "Quiero recibir los nuevos artículos por email" del artboard no se muestra.
- Estado con sesión en el header (avatar, menú de usuario, "Cerrar sesión") y en la sección de comentarios.
- Validación con mensajes propios, verificación de email y límites de intentos.
- Mantener `?volver=` al pasar de una página de cuenta a otra.

## Modelo de datos

Este spec no agrega datos de dominio ni persistencia.
Solo hay un tipo de props para el panel compartido:

```ts
// components/auth/auth-panel.tsx
export type AuthPanelContent = {
  prompt: string; // "$ login --lector"
  title: string; // h1: "Sumate a la conversación del blog"
  intro: string; // bajada
  checks: [string, string, string]; // los 3 ítems con check
};
```

Los textos de cada panel viven en la página que lo usa (`app/cuenta/*/page.tsx`).

Regla de `?volver=`:

- Se acepta solo si coincide con `^/blog/[a-z0-9-]+$` y `getPost(slug)` existe.
- Cualquier otro valor (URL absoluta, `//otro.com`, ruta inexistente) se ignora y el link va a `/blog`.

## Plan de implementación

1. **Route group `(site)`.** Crear `app/(site)/layout.tsx` con `SiteHeader`, `children` y `SiteFooter`. Mover `app/page.tsx`, `app/blog/` y `app/servicios/` a `app/(site)/`. Sacar el header y el footer de `app/layout.tsx`. Prueba: `npm run build` compila y la home, `/blog` y un servicio se ven igual.
2. **Animaciones.** Sumar a `app/globals.css` las clases del artboard que falten (`fx-float2`, `fx-beam` con `@property --a`, `fx-input`, `au-star`, `au-type`, `au-check`, y las que no estén), dentro del bloque de `prefers-reduced-motion` existente.
3. **Panel compartido.** Crear `components/auth/auth-layout.tsx` (grilla de dos columnas y `main` con orbe) y `components/auth/auth-panel.tsx` (panel oscuro con logo, card animada y checks, recibe `AuthPanelContent`). Crear `app/cuenta/login/page.tsx` solo con el panel. Prueba: `/cuenta/login` muestra el panel sin header ni footer.
4. **"Volver al blog".** Crear `components/auth/back-link.tsx` (client) que lee `?volver=` con `useSearchParams`, lo valida con la regla de arriba y cae a `/blog`. Se monta dentro de `<Suspense>` con un fallback que apunta a `/blog`. Prueba: `?volver=/blog/senales-sistema-a-medida` vuelve al artículo, y `?volver=https://otro.com` va a `/blog`.
5. **Piezas del formulario.** Crear `components/auth/password-input.tsx` (client, mostrar u ocultar), `components/auth/google-button.tsx` (visual), `components/auth/unavailable-notice.tsx` (recuadro con `role="status"`) y `components/auth/auth-form.tsx` (client: `onSubmit` con `preventDefault` y muestra el aviso).
6. **Login.** Crear `components/auth/login-form.tsx` y montarlo en `app/cuenta/login/page.tsx`, con `metadata`. Prueba: enviar con un email válido muestra el aviso y no navega.
7. **Registro.** Crear `components/auth/password-strength.tsx` (client) y `components/auth/register-form.tsx`, y `app/cuenta/registro/page.tsx` con su panel y `metadata`. Prueba: "Abcdef1!" marca 4 segmentos y "Fuerte".
8. **Recuperar.** Crear `components/auth/recover-form.tsx` y `app/cuenta/recuperar/page.tsx` con su panel y `metadata`.
9. **Redirect.** Agregar en `next.config.ts` el redirect de `/cuenta` a `/cuenta/login`.
10. **Enlaces existentes.** Cambiar "Ingresar" en `components/site-header.tsx` y `components/mobile-menu.tsx` de `<button>` a `<Link href="/cuenta/login">`. En `components/blog/reviews-section.tsx`, cambiar "Ingresar" y "Crear cuenta" a `<Link>` con `?volver=/blog/{slug}`, pasando el `slug` como prop desde la página del artículo.

## Criterios de aceptación

- [x] `npm run build` termina sin errores ni warnings de tipos.
- [x] `npm run lint` termina sin errores.
- [x] El build prerenderiza `/cuenta/login`, `/cuenta/registro` y `/cuenta/recuperar`.
- [x] Las tres páginas cargan sin errores en la consola del navegador.
- [x] La home, `/blog`, un artículo y un servicio siguen mostrando el header y el footer, con las mismas URLs.
- [x] Las tres páginas de cuenta no muestran el header ni el footer del sitio.
- [ ] A 1440px de ancho, `/cuenta/login` coincide visualmente con el artboard `Login`.
- [ ] A 1440px de ancho, `/cuenta/registro` coincide visualmente con el artboard `Registro`, sin el checkbox de newsletter.
- [x] A 375px de ancho no hay scroll horizontal en ninguna de las tres páginas, y el panel oscuro queda arriba del formulario.
- [x] El logo del panel lleva a `/`.
- [x] "Ingresar" del header (desktop y mobile) lleva a `/cuenta/login`.
- [x] En `/blog/senales-sistema-a-medida`, "Ingresar" lleva a `/cuenta/login?volver=/blog/senales-sistema-a-medida` y "Crear cuenta" a `/cuenta/registro?volver=/blog/senales-sistema-a-medida`.
- [x] Con `?volver=/blog/senales-sistema-a-medida`, "Volver al blog" lleva a ese artículo.
- [x] Sin `?volver=`, o con `?volver=https://otro.com`, `?volver=//otro.com` o `?volver=/blog/no-existe`, "Volver al blog" lleva a `/blog`.
- [x] `/cuenta` redirige a `/cuenta/login`.
- [x] Login enlaza a registro y a recuperar. Registro y recuperar enlazan a login.
- [x] El botón del ojo alterna el `type` del campo entre `password` y `text`, y su `aria-label` entre "Mostrar contraseña" y "Ocultar contraseña".
- [x] En registro, el campo vacío muestra "Escribí una contraseña" sin segmentos. "abcdefgh" marca 1 segmento y "Débil". "Abcdef1!" marca 4 segmentos y "Fuerte".
- [x] Enviar un formulario con campos vacíos o un email inválido muestra la validación nativa del navegador y no muestra el aviso.
- [x] En registro, enviar sin aceptar los términos muestra la validación nativa del navegador.
- [x] Enviar un formulario válido muestra "Las cuentas todavía no están disponibles. Muy pronto vas a poder ingresar." con `role="status"`, y la URL no cambia.
- [x] "Continuar con Google" y "Recordarme" no navegan ni muestran el aviso.
- [x] "Términos y condiciones" y "Política de privacidad" no son `<a href>` y no navegan.
- [x] La pestaña muestra "Iniciar sesión · Courroux Digital", "Crear cuenta · Courroux Digital" y "Recuperar contraseña · Courroux Digital".
- [x] Las tres páginas tienen `<meta name="robots">` con `noindex` y `<link rel="canonical">` con su URL.
- [ ] Con `prefers-reduced-motion: reduce` emulado, las tres páginas no tienen animaciones.
- [x] No aparece ningún texto "[Tu marca]" ni "Quiero recibir los nuevos artículos por email".

## Decisiones

- **Sí:** este spec es solo diseño, sin backend. Separa la maqueta de la elección del proveedor de auth.
- **No:** cuentas reales ahora. Necesitan proveedor, sesión y base de datos; van en su propio spec.
- **Sí:** rutas bajo `/cuenta` (`/cuenta/login`, `/cuenta/registro`, `/cuenta/recuperar`). Deja lugar para perfil y otras páginas de cuenta.
- **No:** `/login` y `/registro` en la raíz, ni `/ingresar` y `/crear-cuenta`.
- **Sí:** sin header ni footer, como en el artboard. Se logra con el route group `(site)`, sin cambiar las URLs.
- **No:** mantener el header y el footer en las páginas de cuenta. El panel dividido no coincidiría con el diseño.
- **No:** dos root layouts distintos. Un solo `app/layout.tsx` con las fuentes evita duplicarlas.
- **Sí:** todos los "Ingresar" y "Crear cuenta" existentes apuntan a las páginas nuevas. Ya no son botones sin destino.
- **Sí:** validación nativa y un aviso de "no disponible" al enviar. Es honesto y deja ver los estados de error del navegador.
- **No:** navegar al artículo al enviar, como en el artboard. Simularía un login que no ocurrió.
- **No:** dejar el envío sin respuesta. Parecería roto.
- **Sí:** el aviso es un recuadro con `role="status"` dentro del formulario. No necesita una librería de toasts.
- **Sí:** mostrar u ocultar la contraseña y el medidor de seguridad funcionales. Son baratos, no tienen backend y el artboard trae la lógica.
- **Sí:** se diseña `/cuenta/recuperar` con el layout de login. "¿Olvidaste tu contraseña?" tiene a dónde ir.
- **Sí:** panel propio para recuperar, con textos sobre recuperar en vez de comentar.
- **No:** Google en recuperar. No aplica a recuperar una contraseña.
- **Sí:** "Continuar con Google" solo visual. Elegido por el usuario.
- **Sí:** "Términos y condiciones" y "Política de privacidad" con estilo de link, sin destino. No hay páginas, y un link a un 404 es peor.
- **No:** el checkbox de newsletter. SPEC 03 dejó la newsletter afuera, y ofrecerla sin proveedor es engañoso.
- **Sí:** `noindex` en las tres páginas. No aportan a la búsqueda, y menos sin backend.
- **Sí:** redirect de `/cuenta` a `/cuenta/login`, como `/servicios` en SPEC 02.
- **Sí:** `?volver=` para volver al artículo de origen. Validado contra `getPost` para evitar un open redirect.
- **Sí:** `?volver=` se lee en el cliente con `useSearchParams` dentro de `<Suspense>`. Con `cacheComponents`, leer `searchParams` en la página la haría dinámica. Así la página se prerenderiza y solo el link se resuelve en el cliente.
- **No:** mantener `?volver=` al pasar de login a registro o a recuperar. Suma lógica en cada link para un caso poco común.
- **No:** cambiar el texto a "Volver al artículo" cuando hay `?volver=`. El artboard dice "Volver al blog", y el artículo es parte del blog.

## Riesgos

| Riesgo                                                                                                  | Mitigación                                                                                                                        |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Mover las rutas a `(site)` puede romper imports relativos o los tipos generados (`PageProps<"/blog">`). | Los imports usan `@/`. Los tipos dependen de la URL, no de la carpeta. Se corre `npm run build` en el paso 1 antes de seguir.     |
| La página 404 global deja de tener header y footer porque sale del layout raíz.                         | Verificar en el paso 1. Si hace falta, agregar `app/(site)/not-found.tsx` o un `app/not-found.tsx` que renderice header y footer. |
| Un formulario que no crea la cuenta puede confundir si se publica antes del spec de cuentas.            | El aviso dice que las cuentas no están disponibles. Si hace falta, ocultar los links a `/cuenta` con un cambio chico.             |
| `?volver=` puede usarse para redirigir a un sitio externo (open redirect).                              | Se acepta solo `/blog/{slug}` con un slug que existe. Cualquier otro valor cae a `/blog`.                                         |
| `useSearchParams` sin `<Suspense>` rompe el prerender con `cacheComponents`.                            | `back-link.tsx` se monta siempre dentro de `<Suspense>`, con fallback a `/blog`.                                                  |
| `@property --a` (borde animado de `fx-beam`) no está en todos los navegadores.                          | Sin soporte, el borde no gira y la card se ve estática. No rompe el layout.                                                       |

## Qué **no** incluye este spec

- Cuentas reales, sesión y base de datos.
- Login con Google.
- Envío del email de recuperación y la página de nueva contraseña.
- "Recordarme" funcional.
- Páginas de Términos y condiciones y de Política de privacidad.
- Newsletter.
- Estado con sesión en el header y en los comentarios.
- Validación con mensajes propios y verificación de email.

Cada uno de estos, si llega, va en su propio spec.
