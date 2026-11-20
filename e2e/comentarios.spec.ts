import type { Browser, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  PASSWORD,
  clearRateLimit,
  createVerifiedUser,
  login,
  sql,
  uniqueEmail,
} from "./helpers";

// Un solo usuario a la vez y los límites de intentos son por IP (igual que usuarios.spec).
test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const PREFIX = "comentarios";
const SLUG = "senales-sistema-a-medida";

test.beforeEach(() => clearRateLimit());
test.afterEach(async () => {
  // Los comentarios y las sesiones caen por cascade.
  await sql(`delete from "user" where email like $1`, [`${PREFIX}-%@test.com`]);
});

async function crearAdmin(page: Page) {
  const { email, name } = await createVerifiedUser(uniqueEmail(`${PREFIX}-admin`), "Ada Admin");
  await sql(`update "user" set role = 'admin' where email = $1`, [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  return { email, name };
}

const crearLector = (name = "Lía Lectora") => createVerifiedUser(uniqueEmail(`${PREFIX}-lector`), name);

async function comentar(email: string, text: string, status = "pendiente", slug = SLUG) {
  await sql(
    `insert into comment (id, post_id, user_id, text, status)
     select gen_random_uuid()::text, p.id, u.id, $3, $4::comment_status
     from post p, "user" u where p.slug = $1 and u.email = $2`,
    [slug, email, text, status],
  );
}

const estadoDe = async (text: string) =>
  (await sql<{ status: string }>(`select status from comment where text = $1`, [text]))[0]?.status;
const pendientes = async () =>
  Number((await sql<{ n: string }>(`select count(*)::text n from comment where status = 'pendiente'`))[0].n);

// Otro contexto del navegador: un usuario con su propia sesión.
async function conSesion(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  return { ctx, page };
}

// La búsqueda por email deja solo los comentarios de ese lector: la cola del E2E trae más.
async function verLista(page: Page, params: Record<string, string>) {
  await page.goto(`/admin/comments?${new URLSearchParams(params)}`);
  await page.waitForLoadState("networkidle");
}

const tarjeta = (page: Page, texto: string) =>
  page.getByRole("article").filter({ hasText: texto });
const insignia = (page: Page) =>
  page
    .getByRole("navigation", { name: "Navegación del panel" })
    .getByRole("img", { name: /pendientes$/ });

test("Comentarios en la barra lateral, después de Medios, lleva a Pendientes con la insignia", async ({
  page,
}) => {
  const lector = await crearLector();
  await comentar(lector.email, "Pendiente para la insignia");
  await crearAdmin(page);
  await page.goto("/admin");
  const nav = page.getByRole("navigation", { name: "Navegación del panel" });
  const links = await nav.getByRole("link").allTextContents();
  expect(links.indexOf("Comentarios")).toBe(links.indexOf("Medios") + 1);
  await expect(insignia(page)).toHaveAttribute("aria-label", `${await pendientes()} pendientes`);

  await nav.getByRole("link", { name: "Comentarios" }).click();
  await expect(page).toHaveURL(/\/admin\/comments$/);
  await expect(page.getByRole("heading", { name: "Comentarios" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Estado de los comentarios" }).getByRole("link", { name: /^Pendientes/ }),
  ).toHaveAttribute("aria-current", "page");
});

test("un lector comenta, el admin aprueba y el comentario se ve en el artículo público", async ({
  page,
  browser,
}) => {
  const lector = await crearLector("Beto Lector");
  const texto = `Comentario moderado ${Date.now()}`;

  // El lector comenta: nace pendiente.
  await page.goto(`/cuenta/login?volver=${encodeURIComponent(`/blog/${SLUG}`)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(lector.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${SLUG}`));
  await page.waitForLoadState("networkidle");
  const main = page.getByRole("main");
  await main.getByRole("textbox", { name: "Escribí un comentario" }).fill(texto);
  await main.getByRole("button", { name: "Publicar" }).click();
  await expect(main.getByText("Tu comentario quedó en revisión.")).toBeVisible();

  // El admin lo ve en Pendientes y lo aprueba.
  const { ctx, page: admin } = await (async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await crearAdmin(p);
    return { ctx, page: p };
  })();
  const antes = await pendientes();
  await verLista(admin, { q: lector.email });
  await expect(admin.getByText("1 comentario", { exact: true })).toBeVisible();
  await tarjeta(admin, texto).getByRole("button", { name: "Aprobar" }).click();
  await expect(admin.getByText("Comentario aprobado.")).toBeVisible();
  await expect(tarjeta(admin, texto)).toHaveCount(0);
  await expect.poll(pendientes).toBe(antes - 1);
  await admin.goto("/admin");
  if (antes - 1 > 0) await expect(insignia(admin)).toHaveAttribute("aria-label", `${antes - 1} pendientes`);
  else await expect(insignia(admin)).toHaveCount(0);

  // El artículo público lo muestra, sin "En revisión".
  const anonimo = await browser.newContext();
  const anon = await anonimo.newPage();
  await anon.goto(`/blog/${SLUG}`);
  const publico = anon.getByRole("listitem").filter({ hasText: texto });
  await expect(publico).toBeVisible();
  await expect(publico.getByText("En revisión")).toHaveCount(0);
  await anonimo.close();
  await ctx.close();
});

test("Ocultar un aprobado lo saca del artículo y el lector lo ve Oculto en su perfil", async ({
  page,
  browser,
}) => {
  const lector = await crearLector();
  const texto = `Aprobado a ocultar ${Date.now()}`;
  await comentar(lector.email, texto, "aprobado");
  await crearAdmin(page);
  await verLista(page, { estado: "aprobados", q: lector.email });
  await tarjeta(page, texto).getByRole("button", { name: "Ocultar" }).click();
  await expect(page.getByText("Comentario oculto.")).toBeVisible();
  await expect(tarjeta(page, texto)).toHaveCount(0);
  expect(await estadoDe(texto)).toBe("oculto");

  const anonimo = await browser.newContext();
  const anon = await anonimo.newPage();
  await anon.goto(`/blog/${SLUG}`);
  await expect(anon.getByRole("heading", { name: "Valoraciones y comentarios" })).toBeVisible();
  await expect(anon.getByText(texto)).toHaveCount(0);
  await anonimo.close();

  const { ctx, page: perfil } = await conSesion(browser, lector.email);
  await expect(perfil.getByText(texto)).toBeVisible();
  await expect(perfil.getByText("Oculto", { exact: true }).first()).toBeVisible();
  await ctx.close();
});

test("Deshacer después de aprobar devuelve el comentario a Pendientes", async ({ page }) => {
  const lector = await crearLector();
  const texto = `Aprobar y deshacer ${Date.now()}`;
  await comentar(lector.email, texto);
  await crearAdmin(page);
  await verLista(page, { q: lector.email });
  await tarjeta(page, texto).getByRole("button", { name: "Aprobar" }).click();
  await expect(page.getByText("Comentario aprobado.")).toBeVisible();
  expect(await estadoDe(texto)).toBe("aprobado");

  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByText("Se deshizo el cambio.")).toBeVisible();
  expect(await estadoDe(texto)).toBe("pendiente");
  await expect(tarjeta(page, texto)).toBeVisible();
});

test("seleccionar 2 pendientes y Aprobar en lote", async ({ page }) => {
  const lector = await crearLector();
  await comentar(lector.email, "Lote uno");
  await comentar(lector.email, "Lote dos");
  await crearAdmin(page);
  await verLista(page, { q: lector.email });
  await page.getByRole("checkbox", { name: "Seleccionar todos los de esta página" }).check();
  await expect(page.getByText("2 seleccionados")).toBeVisible();
  await page.getByRole("button", { name: "Aprobar", exact: true }).first().click();
  await expect(page.getByText("Se aprobaron 2 comentarios.")).toBeVisible();
  await expect(page.getByText("2 seleccionados")).toHaveCount(0);
  expect(await estadoDe("Lote uno")).toBe("aprobado");
  expect(await estadoDe("Lote dos")).toBe("aprobado");
});

test("buscar por email deja solo sus comentarios y Limpiar filtros mantiene la pestaña", async ({
  page,
}) => {
  const lector = await crearLector();
  const otro = await crearLector("Otra Persona");
  await comentar(lector.email, "Texto del primero");
  await comentar(otro.email, "Texto del otro");
  await crearAdmin(page);
  await page.goto("/admin/comments");
  await page.waitForLoadState("networkidle");

  const parte = lector.email.split("@")[0];
  await page.getByLabel("Buscar en el texto, nombre o email").fill(parte);
  await expect(page).toHaveURL(new RegExp(`\\?q=${parte}`));
  await expect(tarjeta(page, "Texto del primero")).toBeVisible();
  await expect(tarjeta(page, "Texto del otro")).toHaveCount(0);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Buscar en el texto, nombre o email")).toHaveValue(parte);
  await expect(tarjeta(page, "Texto del primero")).toBeVisible();

  // En Aprobados no hay nada de este lector: vacío con filtros y "Limpiar filtros".
  await verLista(page, { estado: "aprobados", q: lector.email });
  await expect(page.getByText("No hay comentarios que coincidan con estos filtros.")).toBeVisible();
  await page.getByRole("link", { name: "Limpiar filtros" }).click();
  await expect(page).toHaveURL(/\/admin\/comments\?estado=aprobados$/);
});

test("filtrar por artículo deja solo los comentarios de ese artículo", async ({ page }) => {
  const lector = await crearLector();
  const [otro] = await sql<{ slug: string; id: string }>(
    `select slug, id from post where status = 'publicado' and slug <> $1 order by slug limit 1`,
    [SLUG],
  );
  const [propio] = await sql<{ id: string }>(`select id from post where slug = $1`, [SLUG]);
  await comentar(lector.email, "En el artículo uno", "pendiente", SLUG);
  await comentar(lector.email, "En el artículo dos", "pendiente", otro.slug);
  await crearAdmin(page);
  await verLista(page, { q: lector.email });
  await expect(page.getByRole("article")).toHaveCount(2);

  await page.getByLabel("Artículo").selectOption(propio.id);
  await expect(page).toHaveURL(new RegExp(`articulo=${propio.id}`));
  await expect(tarjeta(page, "En el artículo uno")).toBeVisible();
  await expect(tarjeta(page, "En el artículo dos")).toHaveCount(0);
});

test("Borrar con confirmación quita el comentario de la lista y del artículo", async ({
  page,
  browser,
}) => {
  const lector = await crearLector("Caro Lectora");
  const texto = `Aprobado a borrar ${Date.now()}`;
  await comentar(lector.email, texto, "aprobado");
  await crearAdmin(page);
  await verLista(page, { estado: "aprobados", q: lector.email });
  const card = tarjeta(page, texto);
  await card.getByRole("button", { name: /^Más acciones/ }).click();
  await page.getByRole("menuitem", { name: "Borrar" }).click();
  await expect(page.getByRole("heading", { name: "¿Borrar el comentario de Caro Lectora?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Comentario borrado.")).toBeVisible();
  await expect(tarjeta(page, texto)).toHaveCount(0);
  expect(await estadoDe(texto)).toBeUndefined();

  const anonimo = await browser.newContext();
  const anon = await anonimo.newPage();
  await anon.goto(`/blog/${SLUG}`);
  await expect(anon.getByRole("heading", { name: "Valoraciones y comentarios" })).toBeVisible();
  await expect(anon.getByText(texto)).toHaveCount(0);
  await anonimo.close();
});

test("Ver usuario lleva a /admin/users?q={email} con ese usuario en la tabla", async ({ page }) => {
  const lector = await crearLector();
  await comentar(lector.email, "Para ver al usuario");
  await crearAdmin(page);
  await verLista(page, { q: lector.email });
  await tarjeta(page, "Para ver al usuario").getByRole("button", { name: /^Más acciones/ }).click();
  await page.getByRole("menuitem", { name: "Ver usuario" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/users\\?q=${encodeURIComponent(lector.email).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  await expect(page.getByRole("row").filter({ hasText: lector.email })).toHaveCount(1);
});

test("sin sesión redirige a /cuenta/login y un lector recibe 404", async ({
  page,
  browser,
  consoleErrors,
}) => {
  const anonimo = await browser.newContext();
  const anon = await anonimo.newPage();
  await anon.goto("/admin/comments");
  await expect(anon).toHaveURL(/\/cuenta\/login\?volver=%2Fadmin%2Fcomments$/);
  await anonimo.close();

  // La página se transmite por streaming: el estado HTTP ya salió en 200 cuando se llama a
  // notFound(), así que se comprueba la página de error (igual que usuarios.spec).
  const lector = await crearLector();
  await login(page, lector.email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await page.goto("/admin/comments");
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  consoleErrors.length = 0; // el navegador loguea el 404 esperado
});

test("a 390 px las tarjetas apilan sus datos, no hay scroll horizontal y el cajón muestra la insignia", async ({
  page,
}) => {
  const lector = await crearLector();
  await comentar(lector.email, "Texto para el móvil con un enlace largo https://ejemplo.com/una/ruta/muy/larga/que/no/corta");
  await crearAdmin(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await verLista(page, { q: lector.email });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const card = page.getByRole("article");
  await expect(card).toHaveCount(1);
  for (const control of [
    card.getByRole("button", { name: "Aprobar" }),
    card.getByRole("button", { name: "Ocultar" }),
    card.getByRole("button", { name: /^Más acciones/ }),
    card.getByRole("checkbox").locator(".."),
  ]) {
    const box = await control.boundingBox();
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: "Abrir menú" }).click();
  const cajon = page.getByRole("dialog", { name: "Menú del panel" });
  await expect(cajon.getByRole("link", { name: "Comentarios" })).toBeVisible();
  await expect(cajon.getByRole("img", { name: /pendientes$/ })).toBeVisible();
});
