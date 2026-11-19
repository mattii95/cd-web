import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { clearRateLimit, createVerifiedUser, login, sql } from "./helpers";

// Mismas razones que admin.spec: un solo usuario a la vez y los límites de intentos son por IP.
test.describe.configure({ mode: "serial" });

const N = 12; // artículos de prueba: 01–03 borradores, 04–12 publicados
const slug = (i: number) => `e2e-art-${String(i).padStart(2, "0")}`;
const title = (i: number) => `E2E Artículo ${String(i).padStart(2, "0")}`;

const total = async () =>
  (await sql<{ n: number }>("select count(*)::int as n from post"))[0].n;
const row = (page: Page, i: number) => page.getByRole("row").filter({ hasText: title(i) });
const menu = (page: Page, i: number) =>
  page.getByRole("button", { name: `Más acciones: ${title(i)}` });
// Con streaming el blog responde 200 aun si no encuentra el artículo: se mira el contenido.
async function blogShows(page: Page, i: number, visible: boolean) {
  const tab = await page.context().newPage();
  await tab.goto(`/blog/${slug(i)}`);
  await expect(tab.getByRole("heading", { level: 1, name: title(i) })).toHaveCount(visible ? 1 : 0);
  await tab.close();
}
const modal = (page: Page) => page.getByRole("dialog");

async function seedArticles() {
  await sql("delete from post where slug like 'e2e-art-%'");
  const cats = await sql<{ id: string }>("select id from category order by position limit 2");
  const [autor] = await sql<{ id: string }>("select id from \"user\" where id = 'autor-e2e'");
  await sql(
    `insert into post (id, slug, title, excerpt, body, cta, reading_minutes, category_id, author_id,
                       status, published_at, updated_at)
     select gen_random_uuid()::text, 'e2e-art-' || lpad(i::text, 2, '0'),
            'E2E Artículo ' || lpad(i::text, 2, '0'), 'extracto',
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"texto"}]}]}'::jsonb, 'cta', 3 + i % 5,
            case when i % 2 = 1 then $1 else $2 end, $3,
            (case when i <= 3 then 'borrador' else 'publicado' end)::post_status,
            case when i <= 3 then null else now() - (i || ' hours')::interval end,
            case when i = ${N} then now() - interval '10 days' else now() - (i || ' minutes')::interval end
     from generate_series(1, ${N}) as i`,
    [cats[0].id, cats[1].id, autor.id],
  );
}

test.beforeEach(async ({ page }) => {
  await clearRateLimit();
  await seedArticles();
  const { email } = await createVerifiedUser();
  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await page.goto("/admin/articles");
  await expect(page.getByRole("table", { name: "Listado de artículos" })).toBeVisible();
});

test.afterEach(() => sql("delete from post where slug like 'e2e-art-%'"));

test("muestra título, pestañas con contador, columnas y nada fuera de alcance", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Artículos", level: 1 })).toBeVisible();
  const n = await total();
  await expect(page.getByRole("link", { name: new RegExp(`^Todos\\s*${n}$`) })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Publicados\s*\d+$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Borradores\s*3$/ })).toBeVisible();

  for (const h of ["Título", "Categoría", "Estado", "Lectura", "Actualizado", "Acciones"]) {
    await expect(page.getByRole("columnheader", { name: h })).toBeVisible();
  }
  for (const t of ["Exportar"]) {
    await expect(page.getByText(t, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("Borradores deja ?status=draft, marca la pestaña y solo muestra borradores", async ({ page }) => {
  await page.getByRole("link", { name: /^Borradores/ }).click();
  await expect(page).toHaveURL(/\?status=draft$/);
  await expect(page.getByRole("link", { name: /^Borradores/ })).toHaveAttribute("aria-current", "page");
  await expect(row(page, 1)).toBeVisible();
  await expect(page.getByText("Publicado", { exact: true })).toHaveCount(0);
  await expect(row(page, 4)).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Navegación del panel" }).getByRole("link", { name: "Artículos" }),
  ).toHaveAttribute("aria-current", "page");
});

test("buscar agrega q a la URL y filtra; Limpiar filtros lo quita", async ({ page }) => {
  await page.getByLabel("Buscar", { exact: true }).fill("Artículo 05");
  await expect(page).toHaveURL(/[?&]q=Art%C3%ADculo\+05|q=Art%C3%ADculo%2005/);
  await expect(row(page, 5)).toBeVisible();
  await expect(row(page, 6)).toHaveCount(0);

  await page.getByRole("button", { name: "Limpiar filtros" }).click();
  await expect(page).toHaveURL(/\/admin\/articles$/);
  await expect(page.getByLabel("Buscar", { exact: true })).toHaveValue("");
  await expect(row(page, 6)).toBeVisible();
});

test("la categoría y 'Actualizado' filtran y quedan en la URL", async ({ page }) => {
  const [{ slug: cat }] = await sql<{ slug: string }>("select slug from category order by position limit 1");
  await page.getByLabel("Categoría").selectOption(cat);
  await expect(page).toHaveURL(new RegExp(`category=${cat}`));
  await expect(row(page, 1)).toBeVisible(); // impares: primera categoría
  await expect(row(page, 2)).toHaveCount(0);

  await page.getByLabel("Categoría").selectOption("");
  await expect(row(page, 12)).toBeVisible(); // actualizado hace 10 días
  await page.getByLabel("Actualizado").selectOption("7d");
  await expect(page).toHaveURL(/updated=7d/);
  await expect(row(page, 12)).toHaveCount(0);
  await expect(row(page, 1)).toBeVisible();
});

test("clic en Título ordena ascendente y un segundo clic, descendente", async ({ page }) => {
  const th = page.getByRole("columnheader", { name: "Título" });
  await expect(th).toHaveAttribute("aria-sort", "none");
  await th.getByRole("link").click();
  await expect(th).toHaveAttribute("aria-sort", "ascending");
  await expect(page).toHaveURL(/sort=title&dir=asc/);
  await th.getByRole("link").click();
  await expect(th).toHaveAttribute("aria-sort", "descending");
});

test("pagina con perPage=10 y cambiar las filas vuelve a la página 1", async ({ page }) => {
  const n = await total();
  await page.goto("/admin/articles?perPage=10");
  await expect(page.getByText(`Mostrando 1–10 de ${n} artículos`)).toBeVisible();
  await page.getByRole("link", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(`Mostrando 11–${Math.min(20, n)} de ${n} artículos`)).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Paginación" }).getByRole("link", { name: "2", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByLabel("Filas por página").selectOption("25");
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByText(`Mostrando 1–${Math.min(25, n)} de ${n} artículos`)).toBeVisible();
});

test("sin coincidencias muestra el mensaje con Limpiar filtros", async ({ page }) => {
  await page.goto("/admin/articles?q=zzzzzz");
  await expect(page.getByText("Ningún artículo coincide con los filtros.")).toBeVisible();
  await page.getByRole("link", { name: "Limpiar filtros" }).click();
  await expect(page.getByRole("table", { name: "Listado de artículos" })).toBeVisible();
});

test("recargar conserva pestaña, orden y filas", async ({ page }) => {
  await page.goto("/admin/articles?status=draft&sort=title&dir=asc&perPage=10");
  await page.reload();
  await expect(page.getByRole("link", { name: /^Borradores/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("columnheader", { name: "Título" })).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByLabel("Filas por página")).toHaveValue("10");
  await expect(row(page, 1)).toBeVisible();
  await expect(row(page, 4)).toHaveCount(0);
});

test("publicar un borrador pide confirmación y el artículo se ve en el blog", async ({ page }) => {
  await blogShows(page, 1, false);
  await menu(page, 1).click();
  await page.getByRole("menuitem", { name: "Publicar" }).click();
  await expect(modal(page)).toContainText("va a aparecer en el blog");
  await modal(page).getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Artículo publicado.")).toBeVisible();
  await expect(row(page, 1)).toContainText("Publicado");
  await blogShows(page, 1, true);
});

test("pasar a borrador pide confirmación y el artículo deja de verse en el blog", async ({ page }) => {
  await blogShows(page, 4, true);
  await menu(page, 4).click();
  await page.getByRole("menuitem", { name: "Pasar a borrador" }).click();
  await modal(page).getByRole("button", { name: "Pasar a borrador" }).click();
  await expect(page.getByText("Artículo pasado a borrador.")).toBeVisible();
  await expect(row(page, 4)).toContainText("Borrador");
  await blogShows(page, 4, false);
});

test("eliminar: Cancelar no cambia nada y Eliminar saca la fila y baja el contador", async ({ page }) => {
  const n = await total();
  await menu(page, 5).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await expect(modal(page)).toContainText(title(5));
  await modal(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(modal(page)).toBeHidden();
  await expect(row(page, 5)).toBeVisible();

  await menu(page, 5).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await modal(page).getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Artículo eliminado.")).toBeVisible();
  await expect(row(page, 5)).toHaveCount(0);
  await expect(page.getByRole("link", { name: new RegExp(`^Todos\\s*${n - 1}$`) })).toBeVisible();
});

test("Escape cierra el modal y el foco vuelve a Más acciones", async ({ page }) => {
  await menu(page, 5).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByRole("button", { name: "Cancelar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal(page)).toBeHidden();
  await expect(menu(page, 5)).toBeFocused();
  await expect(row(page, 5)).toBeVisible();
});

test("a 390 px no hay scroll horizontal y las filas se apilan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.reload();
  await expect(page.getByText(title(5)).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // La cabecera queda solo para lectores de pantalla y cada celda ocupa su propia línea.
  await expect(page.locator('td[data-label="Estado"]').first()).toHaveCSS("display", "block");
});
