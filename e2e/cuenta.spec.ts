import { expect, test } from "./fixtures";

test("/cuenta redirige a /cuenta/login", async ({ page }) => {
  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/cuenta\/login$/);
});

test("enviar el login vacío no manda nada", async ({ page }) => {
  await page.goto("/cuenta/login");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/cuenta\/login$/);
});

test("ninguna página de cuenta ofrece Google ni avisa que no hay cuentas", async ({ page }) => {
  for (const ruta of ["login", "registro", "recuperar", "verificar", "nueva-contrasena"]) {
    await page.goto(`/cuenta/${ruta}`);
    await expect(page.getByText(/Google|todavía no están disponibles|o con tu email/)).toHaveCount(0);
  }
});

for (const ruta of ["login", "registro", "recuperar", "verificar", "nueva-contrasena"]) {
  test(`/cuenta/${ruta} tiene noindex`, async ({ page }) => {
    await page.goto(`/cuenta/${ruta}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
}
