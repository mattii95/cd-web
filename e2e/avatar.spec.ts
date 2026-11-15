import { expect, test } from "./fixtures";
import { clearRateLimit, createVerifiedUser, login, sql } from "./helpers";

// Los límites de intentos son por IP y se comparten: serie, solo desktop (ver playwright.config.ts).
test.describe.configure({ mode: "serial" });
test.beforeEach(clearRateLimit);

const PHOTO = "https://avatars.githubusercontent.com/u/1?v=4";
// PNG de 1×1: la foto no sale a internet, el optimizador de next/image se intercepta.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function userWithPhoto() {
  const { email } = await createVerifiedUser();
  await sql('update "user" set image = $2 where email = $1', [email, PHOTO]);
  return email;
}

test.beforeEach(async ({ page }) => {
  await page.route("**/_next/image**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }),
  );
});

test("desktop: el botón del header muestra la foto del proveedor", async ({ page }) => {
  await login(page, await userWithPhoto());
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  const photo = page.getByRole("button", { name: /^Menú de / }).locator("img");
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", new RegExp(encodeURIComponent(PHOTO)));
});

test("mobile: el panel del menú muestra la foto del proveedor", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, await userWithPhoto());
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.locator(`header img[src*="${encodeURIComponent(PHOTO)}"]:visible`)).toHaveCount(1);
});

test("un usuario sin foto ve la inicial en desktop y en mobile", async ({ page }) => {
  const { email } = await createVerifiedUser(undefined, "Ana Pérez");
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  const button = page.getByRole("button", { name: /^Menú de / });
  await expect(button).toHaveText("A");
  await expect(button.locator("img")).toHaveCount(0);
});
