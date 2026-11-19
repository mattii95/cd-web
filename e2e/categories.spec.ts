import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clearRateLimit, createVerifiedUser, login, sql } from "./helpers";

// Un solo admin a la vez y los límites de intentos son por IP (igual que articles.spec).
test.describe.configure({ mode: "serial" });

const NAME = "E2E Marketing digital";
const SLUG = "e2e-marketing-digital";
const POST_TITLE = "E2E Artículo de categoría";
const SEED = ["Desarrollo web", "Sistemas", "SaaS", "Inteligencia artificial"];

const rows = (page: Page) =>
  page.getByRole("table", { name: "Listado de categorías" }).locator("tbody tr");
const row = (page: Page, name: string) => rows(page).filter({ hasText: name });
const modal = (page: Page) => page.getByRole("dialog");
const filtros = (page: Page) => page.getByRole("group", { name: "Filtrar por categoría" });

// Con streaming el blog responde 200 aun si no hay filtro: se mira el contenido.
async function filtrosDelBlog(page: Page) {
  const tab = await page.context().newPage();
  await tab.goto("/blog");
  await expect(filtros(tab)).toBeVisible();
  const textos = await filtros(tab).getByRole("link").allInnerTexts();
  await tab.close();
  return textos;
}

async function crearCategoria(page: Page) {
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill(NAME);
  await page.getByRole("combobox", { name: "Servicio del CTA" }).selectOption({ label: "Desarrollo web" });
  await page.getByRole("radio", { name: "Rayo" }).check({ force: true });
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await expect(page.getByText("Categoría creada.")).toBeVisible();
  await expect(row(page, NAME)).toBeVisible();
}

// Borrar por la interfaz invalida la caché del blog; borrar por SQL la dejaría vieja para otros specs.
async function borrarPorLaInterfaz(page: Page) {
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: `Borrar ${NAME}` }).click();
  await modal(page).getByRole("button", { name: "Borrar" }).click();
  await expect(page.getByText("Categoría borrada.")).toBeVisible();
  await expect(row(page, NAME)).toHaveCount(0);
}

const cleanup = async () => {
  await sql("delete from post where slug like 'e2e-cat-%'");
  await sql("delete from category where slug like 'e2e-%'");
  await sql(
    `update category set position = case slug when 'desarrollo-web' then 0 when 'sistemas' then 1
       when 'saas' then 2 when 'ia' then 3 else position end`,
  );
};

test.afterEach(cleanup);

test.beforeEach(async ({ page }) => {
  await clearRateLimit();
  await cleanup();
  const { email } = await createVerifiedUser();
  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
});

test("Categorías en la barra lateral lleva a /admin/categories con las 4 del seed en orden", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("link", { name: "Categorías", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/categories$/);
  await expect(page.getByRole("link", { name: "Categorías", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(rows(page)).toHaveCount(4);
  for (const [i, name] of SEED.entries()) await expect(rows(page).nth(i)).toContainText(name);
});

test("Nueva categoría queda última y su URL sigue al nombre", async ({ page }) => {
  await page.goto("/admin/categories");
  await crearCategoria(page);
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).last()).toContainText(NAME);
  await expect(rows(page).last()).toContainText(SLUG);
  await expect(rows(page).last()).toContainText("Desarrollo web");
  await borrarPorLaInterfaz(page);
});

test("la categoría nueva sale en el editor; con un artículo publicado aparece el filtro y la URL queda fija", async ({ page }) => {
  await page.goto("/admin/categories");
  await crearCategoria(page);
  expect(await filtrosDelBlog(page)).not.toContain(NAME); // sin artículos publicados no hay filtro

  await page.goto("/admin/articles/new");
  await page.getByLabel("Título del artículo").fill(POST_TITLE);
  await page.getByLabel("Dirección del artículo").fill("e2e-cat-articulo");
  const select = page.getByLabel("Categoría");
  await expect(select.getByRole("option", { name: NAME })).toBeAttached();
  await select.selectOption({ label: NAME });
  await page.getByLabel("Resumen que aparece debajo del título").fill("Resumen de prueba");
  await page.getByLabel("Llamado a la acción").fill("Escribinos");
  await page.locator("#campo-body").click();
  await page.keyboard.type("Cuerpo de prueba");
  await page.getByRole("button", { name: "Publicar" }).click();
  await modal(page).getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Artículo publicado.")).toBeVisible();

  const tab = await page.context().newPage();
  await tab.goto("/blog");
  await expect(filtros(tab).getByRole("link", { name: NAME, exact: true })).toBeVisible();
  await tab.close();

  await page.goto("/admin/categories");
  await expect(row(page, NAME)).toContainText("1 publicados · 1 en total");
  await page.getByRole("button", { name: `Editar ${NAME}` }).click();
  await expect(page.getByRole("textbox", { name: "URL" })).toHaveAttribute("readonly", "");
  await expect(modal(page)).toContainText("La URL no cambia porque la categoría tiene artículos publicados.");
  await page.getByRole("button", { name: "Cancelar" }).click();

  // Con artículos no se puede borrar; sin ellos sí.
  await expect(page.getByRole("button", { name: `Borrar ${NAME}` })).toBeDisabled();
  await expect(row(page, NAME)).toContainText("Tiene 1 artículos. Movelos a otra categoría para borrarla.");
  await sql("delete from post where slug like 'e2e-cat-%'");
  await page.reload();
  await borrarPorLaInterfaz(page);
  expect(await filtrosDelBlog(page)).not.toContain(NAME);
});

test("Bajar sobre la primera la deja segunda y cambia el orden de los filtros de /blog", async ({ page }) => {
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Bajar Desarrollo web" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Desarrollo web quedó en la posición 2." })).toBeAttached();
  await expect(rows(page).nth(1)).toContainText("Desarrollo web");

  await page.reload();
  await expect(rows(page).nth(0)).toContainText("Sistemas");
  await expect(rows(page).nth(1)).toContainText("Desarrollo web");
  await expect(page.getByRole("button", { name: "Subir Sistemas" })).toBeDisabled();

  expect((await filtrosDelBlog(page)).slice(0, 3)).toEqual(["Todos", "Sistemas", "Desarrollo web"]);

  // Se deshace por la interfaz para que el blog vuelva a su orden.
  await page.getByRole("button", { name: "Subir Desarrollo web" }).click();
  await expect(rows(page).nth(0)).toContainText("Desarrollo web");
  expect((await filtrosDelBlog(page)).slice(0, 3)).toEqual(["Todos", "Desarrollo web", "Sistemas"]);
});

test("el foco pasa al otro botón cuando el pulsado queda deshabilitado", async ({ page }) => {
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Subir Sistemas" }).click();
  await expect(rows(page).nth(0)).toContainText("Sistemas");
  await expect(page.getByRole("button", { name: "Bajar Sistemas" })).toBeFocused();
  await page.getByRole("button", { name: "Bajar Sistemas" }).click();
  await expect(rows(page).nth(0)).toContainText("Desarrollo web");
});

test("Borrar está deshabilitado con artículos y una categoría sin artículos pide confirmación", async ({ page }) => {
  await page.goto("/admin/categories");
  await expect(page.getByRole("button", { name: "Borrar Sistemas" })).toBeDisabled();
  await expect(row(page, "Sistemas")).toContainText(/Tiene \d+ artículos\. Movelos a otra categoría para borrarla\./);

  await crearCategoria(page);
  await page.getByRole("button", { name: `Borrar ${NAME}` }).click();
  await expect(modal(page)).toContainText(`¿Borrar la categoría «${NAME}»?`);
  await expect(modal(page)).toContainText("No se puede deshacer.");
  await modal(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(row(page, NAME)).toBeVisible();
  await modal(page).waitFor({ state: "hidden" });
  await borrarPorLaInterfaz(page);
});

test("un error de URL repetida se muestra debajo del campo", async ({ page }) => {
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await page.getByRole("textbox", { name: "Nombre" }).fill("Sistemas");
  await page.getByRole("combobox", { name: "Servicio del CTA" }).selectOption({ label: "Desarrollo web" });
  await page.getByRole("radio", { name: "Rayo" }).check({ force: true });
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await expect(modal(page).getByText("Ya hay una categoría con esa URL.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "URL" })).toBeFocused();
});

test("sin sesión /admin/categories redirige al login", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("http://localhost:3100/admin/categories");
  await expect(page).toHaveURL(/\/cuenta\/login/);
  await ctx.close();
});

test("a 390 px no hay scroll horizontal y el modal ocupa la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/categories");
  await expect(rows(page)).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  const box = await modal(page).boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBeGreaterThanOrEqual(388);
  expect(Math.round(box!.height)).toBeGreaterThanOrEqual(842);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("los controles miden 44 px o más", async ({ page }) => {
  await page.goto("/admin/categories");
  await expect(rows(page)).toHaveCount(4);
  const botones = [
    page.getByRole("button", { name: "Nueva categoría" }),
    page.getByRole("button", { name: "Bajar Desarrollo web" }),
    page.getByRole("button", { name: "Editar Sistemas" }),
    page.getByRole("button", { name: "Borrar Sistemas" }),
  ];
  for (const b of botones) {
    const box = await b.boundingBox();
    expect(box!.width, await b.innerText()).toBeGreaterThanOrEqual(43.5);
    expect(box!.height).toBeGreaterThanOrEqual(43.5);
  }
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  const campos = [
    page.getByRole("textbox", { name: "Nombre" }),
    page.getByRole("textbox", { name: "Texto del filtro" }),
    page.getByRole("textbox", { name: "URL" }),
    page.getByRole("combobox", { name: "Servicio del CTA" }),
    page.getByRole("radio", { name: "Código" }).locator("xpath=ancestor::label"),
    page.getByRole("button", { name: "Cancelar" }),
    page.getByRole("button", { name: "Crear categoría" }),
  ];
  for (const c of campos) expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
});
