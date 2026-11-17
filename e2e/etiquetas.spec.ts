import { expect, test } from "./fixtures";

const categorias = (page: import("@playwright/test").Page) =>
  page.getByRole("group", { name: "Filtrar por categoría" });
const etiquetas = (page: import("@playwright/test").Page) =>
  page.getByRole("group", { name: "Filtrar por etiqueta" });
// El destacado y las tarjetas son enlaces a /blog/[slug] dentro de main.
const articulos = (page: import("@playwright/test").Page) =>
  page.getByRole("main").locator('a[href^="/blog/"]');

test("filtrar por etiqueta y combinarla con la categoría", async ({ page }) => {
  await page.goto("/blog");
  await expect(articulos(page)).toHaveCount(8);

  await etiquetas(page).getByRole("link", { name: /^Pymes/ }).click();
  await expect(page).toHaveURL(/\/blog\?etiqueta=pymes$/);
  await expect(articulos(page)).toHaveCount(3);

  await categorias(page).getByRole("link", { name: "IA", exact: true }).click();
  await expect(page).toHaveURL(/\/blog\?categoria=ia&etiqueta=pymes$/);
  await expect(articulos(page)).toHaveCount(1);
});

test("una etiqueta con la categoría activa conserva los dos filtros", async ({ page }) => {
  await page.goto("/blog?categoria=sistemas");
  await etiquetas(page).getByRole("link", { name: /^Gestión/ }).click();
  await expect(page).toHaveURL(/\/blog\?categoria=sistemas&etiqueta=gestion$/);
});

test("un filtro inválido se ignora y se ve como /blog", async ({ page }) => {
  await page.goto("/blog?categoria=xyz&etiqueta=no-existe");
  await expect(articulos(page)).toHaveCount(8);
  await expect(categorias(page).getByRole("link", { name: "Todos" })).toHaveAttribute("aria-current", "true");
});

test("la combinación sin resultados muestra el estado vacío", async ({ page }) => {
  await page.goto("/blog");
  await categorias(page).getByRole("link", { name: "Desarrollo web" }).click();
  await etiquetas(page).getByRole("link", { name: /^Chatbots/ }).click();

  await expect(page.getByText("No hay artículos con esa combinación.")).toBeVisible();
  await expect(articulos(page)).toHaveCount(0);
});
