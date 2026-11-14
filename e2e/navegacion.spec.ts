import { expect, test } from "./fixtures";

const slug = "senales-sistema-a-medida";

test("home → blog → artículo → login → vuelve al artículo", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[href="/blog"]').filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/blog$/);

  await page.locator(`a[href="/blog/${slug}"]`).first().click();
  await expect(page).toHaveURL(`/blog/${slug}`);

  // El header también tiene un "Ingresar": se acota a la sección de comentarios.
  await page
    .getByRole("main")
    .getByRole("link", { name: "Ingresar" })
    .click();
  await expect(page).toHaveURL(`/cuenta/login?volver=/blog/${slug}`);

  await page.getByRole("link", { name: "Volver al blog" }).click();
  await expect(page).toHaveURL(`/blog/${slug}`);
});
