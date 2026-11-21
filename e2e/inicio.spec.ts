import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  PASSWORD,
  clearRateLimit,
  createVerifiedUser,
  login,
  sql,
  uniqueEmail,
} from "./helpers";

// Un solo usuario a la vez y los límites de intentos son por IP (igual que comentarios.spec).
test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const PREFIX = "inicio";
const SLUG = "senales-sistema-a-medida";
const KPIS = ["Usuarios", "Comentarios", "Artículos", "Valoraciones"];
const GRAFICOS = ["Actividad", "Comentarios por estado", "Distribución de estrellas", "Artículos por categoría"];
const LISTAS = ["Top artículos", "Pendientes más viejos", "Últimos registrados"];

test.beforeEach(() => clearRateLimit());
test.afterEach(async () => {
  // Los comentarios y las sesiones caen por cascade.
  await sql(`delete from "user" where email like $1`, [`${PREFIX}-%@test.com`]);
});

async function crearAdmin(page: Page) {
  const { email } = await createVerifiedUser(uniqueEmail(`${PREFIX}-admin`), "Ada Admin");
  await sql(`update "user" set role = 'admin' where email = $1`, [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  return { email };
}

async function comentar(email: string, text: string, status: "pendiente" | "aprobado") {
  await sql(
    `insert into comment (id, post_id, user_id, text, status)
     select gen_random_uuid()::text, p.id, u.id, $3, $4::comment_status
     from post p, "user" u where p.slug = $1 and u.email = $2`,
    [SLUG, email, text, status],
  );
}

const kpi = (page: Page, titulo: string) =>
  page.getByRole("article").filter({ has: page.getByRole("heading", { name: titulo, level: 3 }) });
const grafico = (page: Page, titulo: string) => page.getByRole("figure").filter({ hasText: titulo });
const lista = (page: Page, titulo: string) =>
  page.getByRole("region", { name: titulo });

async function irAlInicio(page: Page, query = "") {
  await page.goto(`/admin${query}`);
  await page.waitForLoadState("networkidle");
}

async function pendientes(page: Page) {
  const enlace = kpi(page, "Comentarios").getByRole("link", { name: /^\d+ pendientes?$/ });
  await expect(enlace).toBeVisible();
  return Number((await enlace.textContent())!.match(/\d+/)![0]);
}

test("sin sesión /admin redirige al login y con un lector da 404", async ({ page, consoleErrors }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(`/cuenta/login?volver=${encodeURIComponent("/admin")}`);

  const { email } = await createVerifiedUser(uniqueEmail(`${PREFIX}-lector`));
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  consoleErrors.length = 0; // el navegador loguea el 404 esperado
});

test("el admin ve el saludo, el selector, 4 KPIs, 4 gráficos y 3 listas, sin los accesos viejos", async ({
  page,
}) => {
  await crearAdmin(page);
  await irAlInicio(page);
  const main = page.getByRole("main");

  await expect(page.getByRole("heading", { name: "Inicio", level: 1 })).toBeVisible();
  await expect(main.getByText("Hola, Ada")).toBeVisible();
  await expect(main.getByRole("navigation", { name: "Período" }).getByRole("link", { name: "30 días" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const titulo of KPIS) await expect(kpi(page, titulo)).toBeVisible();
  for (const titulo of GRAFICOS) await expect(grafico(page, titulo)).toBeVisible();
  for (const titulo of LISTAS) await expect(lista(page, titulo)).toBeVisible();

  // Los gráficos con datos dibujan el SVG (ResponsiveContainer mide en el navegador, no en jsdom).
  await expect(grafico(page, "Actividad").locator("svg.recharts-surface").first()).toBeVisible();

  // Ya no están las tarjetas de accesos: ningún enlace de main apunta a Medios.
  await expect(main.locator('a[href="/admin/media"]')).toHaveCount(0);
});

test("elegir 7 días cambia la URL, sobrevive a recargar y un período inválido cae a 30", async ({ page }) => {
  await crearAdmin(page);
  await irAlInicio(page);
  const tabs = page.getByRole("navigation", { name: "Período" });

  await tabs.getByRole("link", { name: "7 días" }).click();
  await expect(page).toHaveURL(/\/admin\?periodo=7$/);
  await expect(tabs.getByRole("link", { name: "7 días" })).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(tabs.getByRole("link", { name: "7 días" })).toHaveAttribute("aria-current", "page");

  await irAlInicio(page, "?periodo=15");
  await expect(tabs.getByRole("link", { name: "30 días" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "7 días" })).not.toHaveAttribute("aria-current");

  // Controles de 44 px o más.
  for (const periodo of ["7", "30", "90"]) {
    const box = await tabs.getByRole("link", { name: `${periodo} días` }).boundingBox();
    expect(box!.height, `${periodo} días`).toBeGreaterThanOrEqual(44);
  }
});

test("un lector comenta y el KPI de pendientes sube en 1", async ({ page, browser }) => {
  const lector = await createVerifiedUser(uniqueEmail(`${PREFIX}-lector`), "Beto Lector");
  await crearAdmin(page);
  await irAlInicio(page);
  const antes = await pendientes(page);

  const ctx = await browser.newContext();
  const reader = await ctx.newPage();
  await reader.goto(`/cuenta/login?volver=${encodeURIComponent(`/blog/${SLUG}`)}`);
  await reader.waitForLoadState("networkidle");
  await reader.getByLabel("Email").fill(lector.email);
  await reader.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await reader.getByRole("button", { name: "Ingresar" }).click();
  await expect(reader).toHaveURL(new RegExp(`/blog/${SLUG}`));
  await reader.waitForLoadState("networkidle");
  const main = reader.getByRole("main");
  await main.getByRole("textbox", { name: "Escribí un comentario" }).fill(`Comentario del inicio ${Date.now()}`);
  await main.getByRole("button", { name: "Publicar" }).click();
  await expect(main.getByText("Tu comentario quedó en revisión.")).toBeVisible();
  await ctx.close();

  await irAlInicio(page);
  await expect.poll(() => pendientes(page)).toBe(antes + 1);
});

test("los enlaces de las listas llevan a Comentarios, a Usuarios y al editor del artículo", async ({ page }) => {
  const lector = await createVerifiedUser(uniqueEmail(`${PREFIX}-lector`), "Beto Lector");
  const { email } = await crearAdmin(page);
  // Un pendiente (para su pie) y uno aprobado (para que el artículo entre en el top del período).
  await comentar(lector.email, `Pendiente del inicio ${Date.now()}`, "pendiente");
  await comentar(lector.email, `Aprobado del inicio ${Date.now()}`, "aprobado");
  const [{ id, title }] = await sql<{ id: string; title: string }>(
    `select id, title from post where slug = $1`,
    [SLUG],
  );

  await irAlInicio(page);
  await lista(page, "Top artículos").getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(`/admin/articles/${id}/edit`);

  await irAlInicio(page);
  await lista(page, "Últimos registrados").getByRole("link", { name: new RegExp(email) }).click();
  await expect(page).toHaveURL(`/admin/users?q=${encodeURIComponent(email)}`);

  await irAlInicio(page);
  await lista(page, "Pendientes más viejos").getByRole("link", { name: "Ver todos los pendientes" }).click();
  await expect(page).toHaveURL(/\/admin\/comments$/);
});

test("a 390 px no hay scroll horizontal y las secciones quedan en una columna", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await crearAdmin(page);
  await irAlInicio(page);
  for (const titulo of LISTAS) await expect(lista(page, titulo)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const a = await grafico(page, "Comentarios por estado").boundingBox();
  const b = await grafico(page, "Distribución de estrellas").boundingBox();
  expect(a!.x).toBe(b!.x); // mismo borde izquierdo: una debajo de la otra
  expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
});
