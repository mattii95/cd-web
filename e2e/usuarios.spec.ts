import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  PASSWORD,
  clearRateLimit,
  createVerifiedUser,
  login,
  sql,
  uniqueEmail,
} from "./helpers";

// Un solo usuario a la vez y los límites de intentos son por IP (igual que auth.spec).
test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const PREFIX = "usuarios";
const SLUG = "senales-sistema-a-medida";
const SUSPENDIDA = "Tu cuenta está suspendida. Escribinos a courrouxdigital@gmail.com.";
const CREDENCIALES = "El email o la contraseña no son correctos.";

test.beforeEach(() => clearRateLimit());
test.afterEach(async () => {
  // Los comentarios y las sesiones caen por cascade; banned_by queda en NULL.
  await sql(`delete from "user" where email like $1`, [`${PREFIX}-%@test.com`]);
});

async function crearAdmin(page: Page) {
  const { email, name } = await createVerifiedUser(uniqueEmail(`${PREFIX}-admin`), "Ada Admin");
  await sql(`update "user" set role = 'admin' where email = $1`, [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  return { email, name };
}

const crearLector = (name: string, prefix = `${PREFIX}-lector`) =>
  createVerifiedUser(uniqueEmail(prefix), name);

// Como `login`, sin esperar a "networkidle": en el login nunca llega a estar quieta (prefetch de
// páginas que no existen) y cada espera cuesta ~18 s. El formulario anda también sin hidratar.
async function ingresar(page: Page, email: string, password = PASSWORD) {
  await page.goto("/cuenta/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

// Otro contexto del navegador: un lector con su propia sesión.
async function lectorConSesion(browser: import("@playwright/test").Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ingresar(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  return { ctx, page };
}

// La búsqueda deja solo a ese usuario: la lista del E2E tiene más de una página.
async function verUsuario(page: Page, email: string) {
  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  await page.waitForLoadState("networkidle");
  const fila = page.getByRole("row").filter({ hasText: email });
  await expect(fila).toHaveCount(1);
  return fila;
}

async function abrirMenu(fila: Locator, item: RegExp | string) {
  await fila.getByRole("button", { name: /^Más acciones/ }).click();
  await fila.page().getByRole("menuitem", { name: item }).click();
}

const aviso = (page: Page, texto: string | RegExp) => page.getByText(texto);

test("Usuarios en la barra lateral lleva a la tabla con contador y columnas", async ({ page }) => {
  await crearAdmin(page);
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Navegación del panel" }).getByRole("link", { name: "Usuarios" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Listado de usuarios" })).toBeVisible();
  await expect(page.getByText(/^\d+ usuarios?$/)).toBeVisible();
  await expect(page.getByRole("columnheader")).toHaveText([
    "Usuario",
    "Rol",
    "Estado",
    "Acceso",
    "Última actividad",
    "Alta",
    "Más acciones",
  ]);
});

test("buscar por email filtra, queda en la URL, sobrevive a la recarga y se limpia", async ({ page }) => {
  await crearAdmin(page);
  const ana = await crearLector("Ana Buscada", `${PREFIX}-ana`);
  await crearLector("Beto Otro", `${PREFIX}-beto`);

  await page.goto("/admin/users");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Buscar por nombre o email").fill(`${PREFIX}-ana`);
  await expect(page).toHaveURL(new RegExp(`\\?q=${PREFIX}-ana$`));
  await expect(page.getByRole("row").filter({ hasText: ana.email })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: `${PREFIX}-beto` })).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel("Buscar por nombre o email")).toHaveValue(`${PREFIX}-ana`);
  await expect(page.getByRole("row").filter({ hasText: `${PREFIX}-beto` })).toHaveCount(0);

  await page.getByLabel("Buscar por nombre o email").fill("sin-coincidencias-xyz");
  await expect(page.getByText("No hay usuarios que coincidan con estos filtros.")).toBeVisible();
  await page.getByRole("link", { name: "Limpiar filtros" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByLabel("Buscar por nombre o email")).toHaveValue("");
});

test("los filtros de estado y rol se reflejan en la URL", async ({ page }) => {
  await crearAdmin(page);
  const lector = await crearLector("Lola Filtro");
  await sql(`update "user" set banned_at = now(), ban_reason = 'x' where email = $1`, [lector.email]);

  await page.goto(`/admin/users?q=${encodeURIComponent(PREFIX)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Estado").selectOption("bloqueados");
  await expect(page).toHaveURL(new RegExp(`\\?q=${PREFIX}&estado=bloqueados$`));
  await expect(page.getByRole("row").filter({ hasText: lector.email })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: "Ada Admin" })).toHaveCount(0);

  await page.getByLabel("Rol").selectOption("admins");
  await expect(page).toHaveURL(/rol=admins/);
  await expect(page.getByText("No hay usuarios que coincidan con estos filtros.")).toBeVisible();
});

test("bloquear: la sesión abierta cae, el login muestra la suspensión y desbloquear lo devuelve", async ({
  page,
  browser,
}) => {
  await crearAdmin(page);
  const lector = await crearLector("Lola Bloqueada");
  const { ctx, page: lectorPage } = await lectorConSesion(browser, lector.email);
  await clearRateLimit();

  const fila = await verUsuario(page, lector.email);
  await abrirMenu(fila, /^Bloquear/);
  // Sin motivo no avanza.
  await page.getByRole("button", { name: "Bloquear", exact: true }).click();
  await expect(page.getByText("Escribí el motivo del bloqueo.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Motivo/ })).toBeFocused();
  await page.getByRole("textbox", { name: /Motivo/ }).fill("Spam en comentarios");
  await page.getByRole("button", { name: "Bloquear", exact: true }).click();

  await expect(aviso(page, /Lola Bloqueada quedó bloqueado\. Se cerró 1 sesión\./)).toBeVisible();
  await expect(fila.getByText("Bloqueado", { exact: true })).toBeVisible();

  // Su sesión, abierta en otro contexto, ya no vale.
  await lectorPage.goto("/cuenta/perfil");
  await expect(lectorPage).toHaveURL(/\/cuenta\/login/);

  // Con la contraseña correcta ve la suspensión; con una incorrecta, el mensaje genérico.
  await ingresar(lectorPage, lector.email);
  await expect(lectorPage.getByText(SUSPENDIDA)).toBeVisible();
  await expect(lectorPage.getByText("Spam en comentarios")).toHaveCount(0);
  await ingresar(lectorPage, lector.email, "incorrecta123");
  await expect(lectorPage.getByText(CREDENCIALES)).toBeVisible();
  await expect(lectorPage.getByText(SUSPENDIDA)).toHaveCount(0);
  await clearRateLimit();

  // Desbloquear muestra el motivo y quién bloqueó.
  await abrirMenu(fila, "Desbloquear");
  const dialogo = page.getByRole("dialog", { name: "¿Desbloquear a Lola Bloqueada?" });
  await expect(dialogo).toContainText("por Ada Admin");
  await expect(dialogo).toContainText("Motivo: «Spam en comentarios»");
  await dialogo.getByRole("button", { name: "Desbloquear" }).click();
  await expect(aviso(page, "Lola Bloqueada ya puede volver a iniciar sesión.")).toBeVisible();
  await expect(fila.getByText("Activo", { exact: true })).toBeVisible();

  await ingresar(lectorPage, lector.email);
  await expect(lectorPage).toHaveURL(/\/cuenta\/perfil$/);
  await ctx.close();
});

test("cerrar sesiones deja al lector sin sesión y puede volver a entrar", async ({ page, browser }) => {
  await crearAdmin(page);
  const lector = await crearLector("Lola Sesiones");
  const { ctx, page: lectorPage } = await lectorConSesion(browser, lector.email);
  await clearRateLimit();

  const fila = await verUsuario(page, lector.email);
  await abrirMenu(fila, "Cerrar sesiones");
  const dialogo = page.getByRole("dialog", { name: "¿Cerrar las sesiones de Lola Sesiones?" });
  await dialogo.getByRole("button", { name: "Cerrar sesiones" }).click();
  await expect(aviso(page, "Se cerró 1 sesión de Lola Sesiones.")).toBeVisible();

  await lectorPage.goto("/cuenta/perfil");
  await expect(lectorPage).toHaveURL(/\/cuenta\/login/);
  await ingresar(lectorPage, lector.email);
  await expect(lectorPage).toHaveURL(/\/cuenta\/perfil$/);
  await ctx.close();
});

test("reenviar verificación manda un email nuevo a un usuario sin verificar", async ({ page }) => {
  await crearAdmin(page);
  const lector = await crearLector("Lola Sin Verificar");
  await sql(`update "user" set email_verified = false where email = $1`, [lector.email]);

  const fila = await verUsuario(page, lector.email);
  await expect(fila.getByText("Sin verificar", { exact: true })).toBeVisible();
  const todosAntes = await mailTotal(lector.email);
  await abrirMenu(fila, "Reenviar verificación");
  await expect(aviso(page, `Le reenviamos el email de verificación a ${lector.email}.`)).toBeVisible();
  await expect.poll(() => mailTotal(lector.email)).toBe(todosAntes + 1);
});

async function mailTotal(to: string) {
  const res = await fetch(`http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  const { messages } = (await res.json()) as { messages: unknown[] };
  return messages.length;
}

test("borrar la cuenta de un lector con un comentario pide el email y el comentario desaparece", async ({
  page,
  browser,
}) => {
  await crearAdmin(page);
  const lector = await crearLector("Lola Comentarista");
  const texto = `Comentario de usuarios ${Date.now()}`;
  await sql(
    `insert into comment (id, post_id, user_id, text, status)
     values (gen_random_uuid()::text, (select id from post where slug = $1),
             (select id from "user" where email = $2), $3, 'aprobado')`,
    [SLUG, lector.email, texto],
  );

  // El blog público (en otro contexto) lo muestra antes y no después.
  const anonimo = await browser.newContext();
  const blog = await anonimo.newPage();
  await blog.goto(`/blog/${SLUG}`);
  await expect(blog.getByText(texto)).toBeVisible();

  const fila = await verUsuario(page, lector.email);
  await abrirMenu(fila, "Borrar cuenta");
  const borrar = page.getByRole("button", { name: "Borrar cuenta", exact: true });
  await expect(page.getByText("1 comentario")).toBeVisible();
  await expect(borrar).toBeDisabled();
  await page.getByRole("textbox", { name: /Escribí .* para confirmar/ }).fill(lector.email.toUpperCase());
  await expect(borrar).toBeEnabled();
  await borrar.click();

  await expect(aviso(page, "Se borró la cuenta de Lola Comentarista.")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: lector.email })).toHaveCount(0);

  await blog.reload();
  await expect(blog.getByRole("heading", { name: "Valoraciones y comentarios" })).toBeVisible();
  await expect(blog.getByText(texto)).toHaveCount(0);
  await anonimo.close();
});

test("en la fila del admin, Bloquear y Borrar cuenta están deshabilitados", async ({ page }) => {
  const admin = await crearAdmin(page);
  const fila = await verUsuario(page, admin.email);
  await expect(fila.getByText("(vos)")).toBeVisible();
  await fila.getByRole("button", { name: /^Más acciones/ }).click();
  for (const [nombre, motivo] of [
    ["Bloquear", "Los administradores no se pueden bloquear."],
    ["Cerrar sesiones", "Para cerrar tu sesión usá «Cerrar sesión»."],
    ["Borrar cuenta", "Los administradores no se pueden borrar."],
  ] as const) {
    const item = page.getByRole("menuitem", { name: new RegExp(`^${nombre}`) });
    await expect(item).toHaveAttribute("aria-disabled", "true");
    await expect(item).toContainText(motivo);
  }
});

test("sin sesión redirige al login y un lector recibe 404", async ({ page, browser, consoleErrors }) => {
  const anonimo = await browser.newContext();
  const anon = await anonimo.newPage();
  await anon.goto("/admin/users");
  await expect(anon).toHaveURL(/\/cuenta\/login\?volver=%2Fadmin%2Fusers$/);
  await anonimo.close();

  const lector = await crearLector("Lola Lectora");
  await login(page, lector.email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  consoleErrors.length = 0; // el navegador loguea el 404 esperado
});

test("a 390 px la tabla pasa a tarjetas, los modales ocupan la pantalla y no hay scroll horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await crearAdmin(page);
  const lector = await crearLector("Lola Móvil");
  await sql(`update "user" set email_verified = false where email = $1`, [lector.email]);

  const sinScroll = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

  await page.goto("/admin/users");
  await expect(page.getByRole("table", { name: "Listado de usuarios" })).toBeVisible();
  // El encabezado queda solo para lectores de pantalla (sr-only: 1 px), no como fila de columnas.
  expect((await page.locator("thead").boundingBox())!.width).toBeLessThanOrEqual(1);
  await sinScroll();

  const fila = await verUsuario(page, lector.email);
  // Cada celda muestra su columna con ::before y data-label.
  const etiqueta = await fila
    .locator('td[data-label="Estado"]')
    .evaluate((td) => getComputedStyle(td, "::before").content);
  expect(etiqueta).toBe('"Estado:"');
  await sinScroll();

  for (const [item, modal] of [
    [/^Bloquear/, "Bloquear a Lola Móvil"],
    ["Borrar cuenta", "Borrar la cuenta de Lola Móvil"],
  ] as const) {
    await abrirMenu(fila, item);
    const dialogo = page.getByRole("dialog", { name: modal });
    await expect(dialogo).toBeVisible();
    const box = (await dialogo.boundingBox())!;
    expect(Math.round(box.width)).toBe(390);
    expect(Math.round(box.height)).toBe(844);
    await sinScroll();
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialogo).toBeHidden();
  }
});

// Contraste WCAG del texto de un elemento contra el primer fondo opaco que encuentre hacia arriba.
async function contraste(el: Locator) {
  return el.evaluate((node) => {
    const rgba = (css: string) => {
      const c = document.createElement("canvas").getContext("2d")!;
      c.clearRect(0, 0, 1, 1);
      c.fillStyle = css;
      c.fillRect(0, 0, 1, 1);
      return Array.from(c.getImageData(0, 0, 1, 1).data);
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const fg = rgba(getComputedStyle(node).color);
    let bg = [255, 255, 255, 255];
    for (let n: Element | null = node; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] === 255) {
        bg = c;
        break;
      }
    }
    const [a, b] = [lum(fg), lum(bg)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

async function mide44(el: Locator) {
  const box = (await el.boundingBox())!;
  expect(Math.round(box.height), await el.innerText().catch(() => "control")).toBeGreaterThanOrEqual(44);
}

test("la barra, la tabla, el menú y los modales cumplen 44 px y 4.5:1", async ({ page }) => {
  await crearAdmin(page);
  const sin = await crearLector("Lola Contraste");
  await sql(`update "user" set email_verified = false where email = $1`, [sin.email]);
  const bloq = await crearLector("Beto Contraste");
  await sql(`update "user" set banned_at = now(), ban_reason = 'x' where email = $1`, [bloq.email]);

  await page.goto(`/admin/users?q=${PREFIX}`);
  await page.waitForLoadState("networkidle");

  // Barra.
  for (const c of [page.getByLabel("Buscar por nombre o email"), page.getByLabel("Estado"), page.getByLabel("Rol")])
    await mide44(c);

  // Insignias y textos de la tabla.
  for (const texto of ["Activo", "Sin verificar", "Bloqueado"]) {
    const insignia = page.getByRole("row").getByText(texto, { exact: true }).first();
    expect(await contraste(insignia), texto).toBeGreaterThanOrEqual(4.5);
  }
  for (const c of [
    page.getByText(/^desde /).first(),
    page.getByText("Sin sesiones").first(),
    page.getByRole("columnheader").first(),
  ])
    expect(await contraste(c)).toBeGreaterThanOrEqual(4.5);

  // Menú, con ítems deshabilitados y sus motivos.
  const filaSin = page.getByRole("row").filter({ hasText: sin.email });
  await filaSin.getByRole("button", { name: /^Más acciones/ }).click();
  await mide44(filaSin.getByRole("button", { name: /^Más acciones/ }));
  for (const item of await page.getByRole("menuitem").all()) {
    await mide44(item);
    expect(await contraste(item)).toBeGreaterThanOrEqual(4.5);
  }
  await expect(page.getByText("No tiene sesiones abiertas.")).toBeVisible();
  expect(await contraste(page.getByText("No tiene sesiones abiertas."))).toBeGreaterThanOrEqual(4.5);

  // Modales.
  await page.getByRole("menuitem", { name: /^Bloquear/ }).click();
  for (const c of [
    page.getByRole("textbox", { name: /Motivo/ }),
    page.getByRole("button", { name: "Cancelar" }),
    page.getByRole("button", { name: "Bloquear", exact: true }),
  ])
    await mide44(c);
  await page.getByRole("button", { name: "Bloquear", exact: true }).click();
  expect(await contraste(page.getByText("Escribí el motivo del bloqueo."))).toBeGreaterThanOrEqual(4.5);
  await page.getByRole("button", { name: "Cancelar" }).click();

  await filaSin.getByRole("button", { name: /^Más acciones/ }).click();
  await page.getByRole("menuitem", { name: "Borrar cuenta" }).click();
  for (const c of [
    page.getByRole("textbox", { name: /Escribí .* para confirmar/ }),
    page.getByRole("button", { name: "Cancelar" }),
    page.getByRole("button", { name: "Borrar cuenta", exact: true }),
  ])
    await mide44(c);
  await page.getByRole("textbox", { name: /Escribí .* para confirmar/ }).fill(sin.email);
  expect(await contraste(page.getByRole("button", { name: "Borrar cuenta", exact: true }))).toBeGreaterThanOrEqual(4.5);
});
