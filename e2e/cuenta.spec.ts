import { expect, test } from "./fixtures";

test("/cuenta redirige a /cuenta/login", async ({ page }) => {
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/cuenta\/login$/);
});

test("enviar el login vacío no muestra el aviso", async ({ page }) => {
  await page.goto("/cuenta/login");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("un login válido muestra el aviso y no cambia la URL", async ({ page }) => {
  await page.goto("/cuenta/login");
  await page.getByLabel("Email").fill("tu@email.com");
  await page.getByLabel("Contraseña", { exact: true }).fill("secreta123");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page).toHaveURL(/\/cuenta\/login$/);
});

for (const ruta of ["login", "registro", "recuperar"]) {
  test(`/cuenta/${ruta} tiene noindex`, async ({ page }) => {
    await page.goto(`/cuenta/${ruta}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
}
