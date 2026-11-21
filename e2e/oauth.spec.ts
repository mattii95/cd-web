import { expect, test } from "./fixtures";
import { APP, clearRateLimit, waitForCaptcha } from "./helpers";

// Los límites de intentos son por IP y se comparten: serie, solo desktop (ver playwright.config.ts).
test.describe.configure({ mode: "serial" });
test.beforeEach(clearRateLimit);

const PROVIDERS = [
  { id: "google", label: "Continuar con Google", authorize: "https://accounts.google.com/**" },
  { id: "github", label: "Continuar con GitHub", authorize: "https://github.com/login/oauth/**" },
  {
    id: "microsoft",
    label: "Continuar con Microsoft",
    authorize: "https://login.microsoftonline.com/**",
  },
] as const;

for (const ruta of ["/cuenta/login", "/cuenta/registro"]) {
  for (const { id, label, authorize } of PROVIDERS) {
    test(`${ruta}: "${label}" redirige a la URL authorize de ${id}`, async ({ page }) => {
      // No salimos a internet: la request al proveedor se intercepta y se aborta.
      let authorizeUrl: URL | undefined;
      await page.route(authorize, (route) => {
        authorizeUrl = new URL(route.request().url());
        return route.abort();
      });

      await page.goto(ruta);
      // La Server Action necesita la página hidratada.
      await waitForCaptcha(page);
      await page.getByRole("button", { name: label }).click();
      await expect.poll(() => authorizeUrl?.href).toBeTruthy();

      expect(authorizeUrl!.searchParams.get("client_id")).toBe(
        process.env[`${id.toUpperCase()}_CLIENT_ID`],
      );
      expect(authorizeUrl!.searchParams.get("redirect_uri")).toBe(
        `${APP}/api/auth/callback/${id}`,
      );
    });
  }
}

test("muestra los tres botones en orden y el separador", async ({ page }) => {
  await page.goto("/cuenta/login");
  const buttons = page.getByRole("button", { name: /^Continuar con / });
  await expect(buttons).toHaveText([
    "Continuar con Google",
    "Continuar con GitHub",
    "Continuar con Microsoft",
  ]);
  await expect(page.getByText("o con tu email")).toBeVisible();
});

test("registro muestra el texto legal de los proveedores", async ({ page }) => {
  await page.goto("/cuenta/registro");
  await expect(
    page.getByText("Al continuar con un proveedor aceptás los términos y la política de privacidad."),
  ).toBeVisible();
});

test("?error=access_denied muestra el mensaje con role=alert", async ({ page }) => {
  await page.goto("/cuenta/login?error=access_denied");
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "No pudimos iniciar sesión con ese proveedor. Probá de nuevo o usá tu email.",
  );
});
