import { expect, test } from "./fixtures";

const etiquetas = (page: import("@playwright/test").Page) =>
  page.getByRole("group", { name: "Filtrar por etiqueta" });
// El destacado y las tarjetas son enlaces a /blog/[slug] dentro de main.
const articulos = (page: import("@playwright/test").Page) =>
  page.getByRole("main").locator('a[href^="/blog/"]');

test("filtrar por etiqueta y combinarla con la categoría", async ({ page }) => {
  await page.goto("/blog");
  await expect(articulos(page)).toHaveCount(8);

  await etiquetas(page)
    .getByRole("button", { name: /^Pymes/ })
    .click();
  await expect(articulos(page)).toHaveCount(3);

  await page.getByRole("button", { name: "IA", exact: true }).click();
  await expect(articulos(page)).toHaveCount(1);
});

test("la combinación sin resultados muestra el estado vacío", async ({
  page,
}) => {
  await page.goto("/blog");
  await page.getByRole("button", { name: "Desarrollo web" }).click();
  await etiquetas(page)
    .getByRole("button", { name: /^Chatbots/ })
    .click();

  await expect(
    page.getByText("No hay artículos con esa combinación."),
  ).toBeVisible();
  await expect(articulos(page)).toHaveCount(0);
});
