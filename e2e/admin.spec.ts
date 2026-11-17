import { expect, test } from "./fixtures";
import { clearRateLimit, createVerifiedUser, login, sql } from "./helpers";

// Un solo usuario a la vez y los límites de intentos son por IP (igual que auth.spec).
test.describe.configure({ mode: "serial" });

const RUTAS = ["/admin", "/admin/articles", "/admin/media", "/admin/users"];
const nav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Navegación del panel" });

async function entrarComoAdmin(page: import("@playwright/test").Page) {
  const { email, name } = await createVerifiedUser();
  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  return { email, name };
}

test.beforeEach(() => clearRateLimit());

test("sin sesión las cuatro rutas redirigen al login", async ({ page }) => {
  for (const ruta of RUTAS) {
    await page.goto(ruta);
    await expect(page).toHaveURL(`/cuenta/login?volver=${encodeURIComponent(ruta)}`);
  }
});

test("con un lector las cuatro rutas responden 404", async ({ page, consoleErrors }) => {
  const { email } = await createVerifiedUser();
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  for (const ruta of RUTAS) {
    await page.goto(ruta);
    await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  }
  consoleErrors.length = 0; // el navegador loguea cada 404 esperado
});

test("el panel no tiene el header ni el footer del sitio y es noindex con título Panel", async ({ page }) => {
  await entrarComoAdmin(page);
  for (const ruta of RUTAS) {
    await page.goto(ruta);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page).toHaveTitle(/· Panel$/);
  }
});

test("barra lateral: orden, ítem activo y sin ítems futuros", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/media");
  await expect(nav(page).getByRole("link")).toHaveText(["Inicio", "Artículos", "Medios", "Usuarios"]);
  await expect(nav(page).getByRole("link", { name: "Medios" })).toHaveAttribute("aria-current", "page");
  await expect(nav(page).getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Ver el blog" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Categorías|SEO|Ajustes/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeHidden();
});

test("Inicio: saludo y tres accesos directos", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin");
  await expect(page.getByText("Hola, Ana")).toBeVisible();
  const main = page.getByRole("main");
  for (const [titulo, href] of [
    ["Artículos", "/admin/articles"],
    ["Medios", "/admin/media"],
    ["Usuarios", "/admin/users"],
  ]) {
    await expect(main.getByRole("link", { name: new RegExp(`^${titulo}`) })).toHaveAttribute("href", href);
  }
});

test("Artículos: estado vacío y sin botón Nuevo artículo", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/articles");
  await expect(page.getByRole("heading", { name: "Artículos" })).toBeVisible();
  await expect(page.getByText("La gestión de artículos llega en el próximo spec.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuevo artículo" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nuevo artículo" })).toHaveCount(0);
});

test("Usuarios: columnas y contador", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin/users");
  await expect(page.getByRole("columnheader")).toHaveText(["Nombre", "Email", "Rol", "Verificado", "Alta"]);
  await expect(page.getByText(/\d+ usuarios? registrados?/)).toBeVisible();
});

test("menú de cuenta: nombre, rol, opciones y cerrar sesión", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.goto("/admin");
  const boton = page.getByRole("button", { name: "Cuenta: Ana Pérez, administrador" });
  await expect(boton).toBeVisible();
  await expect(boton).toContainText("Administrador");
  await boton.click();
  await expect(page.getByRole("link", { name: "Mi perfil" })).toHaveAttribute("href", "/cuenta/perfil");
  await expect(page.getByRole("link", { name: "Ver el sitio" })).toHaveAttribute("href", "/");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Mi perfil" })).toBeHidden();

  await boton.click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/); // la action termina antes de volver a pedir /admin
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/cuenta\/login\?volver=%2Fadmin$/);
});

test("iniciar sesión con volver=/admin lleva al Inicio del panel", async ({ page }) => {
  const { email } = await createVerifiedUser();
  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await login(page, email, undefined, "/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});

test("a 390 px el cajón abre, Escape cierra y el foco vuelve al botón", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrarComoAdmin(page);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Ver el blog" })).toBeHidden();
  const abrir = page.getByRole("button", { name: "Abrir menú" });
  await abrir.click();
  await expect(page.getByRole("dialog", { name: "Menú del panel" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(abrir).toBeFocused();
  for (const ruta of RUTAS) {
    await page.goto(ruta);
    await page.waitForLoadState("load");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, ruta).toBeLessThanOrEqual(0);
  }
});
