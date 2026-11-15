import { expect, test } from "./fixtures";
import {
  APP,
  PASSWORD,
  clearRateLimit,
  createVerifiedUser,
  login,
  mailCount,
  sql,
  uniqueEmail,
  waitForLink,
} from "./helpers";

// Los límites de intentos son por IP y todos los tests comparten la de localhost:
// los tests corren en serie, solo en desktop (ver testIgnore en playwright.config.ts),
// y cada uno parte sin intentos acumulados.
test.describe.configure({ mode: "serial" });
test.beforeEach(clearRateLimit);

const ERR_CREDENCIALES = "El email o la contraseña no son correctos.";

test("registro, verificación, login y logout", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/cuenta/registro");
  // La contraseña es un input controlado: si se tipea antes de hidratar, React la vacía.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nombre y apellido").fill("Ana Pérez");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Acepto los/).check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/cuenta\/verificar$/);
  await expect(page.getByRole("heading", { name: "Revisá tu email" })).toBeVisible();

  const [row] = await sql<{ role: string; email_verified: boolean }>(
    'select role, email_verified from "user" where email = $1',
    [email],
  );
  expect(row).toEqual({ role: "lector", email_verified: false });
  const verifyLink = await waitForLink(email, "Verificá tu email");

  // Sin verificar, el login falla y manda un link nuevo.
  await login(page, email);
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Tenés que verificar tu email. Te mandamos un link nuevo.",
  );
  await expect.poll(() => mailCount(email, "Verificá tu email")).toBe(2);

  await page.goto(verifyLink);
  await expect(page).toHaveURL(/\/cuenta\/verificar\?estado=ok$/);
  await expect(page.getByRole("heading", { name: "Tu email está verificado" })).toBeVisible();

  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await expect(page.getByRole("heading", { name: "Ana Pérez" })).toBeVisible();
  await expect(page.getByText(email, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Lector", { exact: true })).toBeVisible();
  await expect(page.getByText("Miembro desde")).toBeVisible();
  await expect(page.getByText(/\d{1,2} de \w+ de \d{4}/)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // Se pide la página sola: el DOM de una navegación suave arrastra scripts de la anterior.
  const html = await (await page.request.get("/cuenta/perfil")).text();
  expect(html).not.toMatch(/hash|session_token|"password"/i);

  await page.getByRole("button", { name: "Menú de Ana Pérez" }).click();
  await expect(page.getByRole("link", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Ingresar" }).first()).toBeVisible();

  await page.goto("/cuenta/perfil");
  await expect(page).toHaveURL(/\/cuenta\/login\?volver=%2Fcuenta%2Fperfil$/);
});

test("un link de verificación alterado muestra el estado de error", async ({ page }) => {
  await page.goto(
    `${APP}/api/auth/verify-email?token=falso&callbackURL=${encodeURIComponent("/cuenta/verificar?estado=ok")}`,
  );
  await expect(page.getByRole("heading", { name: "El link venció o no es válido" })).toBeVisible();
});

test("registrar un email existente no crea otro usuario y avisa a la cuenta", async ({ page }) => {
  const { email } = await createVerifiedUser();
  await page.goto("/cuenta/registro");
  // La contraseña es un input controlado: si se tipea antes de hidratar, React la vacía.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nombre y apellido").fill("Otra Persona");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Acepto los/).check();
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/cuenta\/verificar$/);

  await waitForLink(email, "Ya tenés una cuenta");
  const [{ count }] = await sql<{ count: string }>('select count(*) from "user" where email = $1', [email]);
  expect(count).toBe("1");
});

test("mandar role admin en el registro crea un lector", async ({ request }) => {
  const email = uniqueEmail();
  const res = await request.post(`${APP}/api/auth/sign-up/email`, {
    headers: { Origin: APP },
    data: { name: "Intruso", email, password: PASSWORD, role: "admin" },
  });
  expect(res.ok()).toBe(true);
  const [row] = await sql<{ role: string }>('select role from "user" where email = $1', [email]);
  expect(row.role).toBe("lector");
});

test("contraseña incorrecta y email inexistente dan el mismo error", async ({ page }) => {
  const { email } = await createVerifiedUser();
  await login(page, email, "otra-clave-1");
  await expect(page.locator("form").getByRole("alert")).toHaveText(ERR_CREDENCIALES);
  await login(page, uniqueEmail("nadie"));
  await expect(page.locator("form").getByRole("alert")).toHaveText(ERR_CREDENCIALES);
});

test("el sexto intento fallido en un minuto muestra el límite", async ({ page }) => {
  const email = uniqueEmail("limite");
  for (let i = 0; i < 5; i++) {
    await login(page, email, "mala-clave-1");
    await expect(page.locator("form").getByRole("alert")).toHaveText(ERR_CREDENCIALES);
  }
  await login(page, email, "mala-clave-1");
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Demasiados intentos. Probá de nuevo en un minuto.",
  );
});

test("volver: acepta un artículo y rechaza destinos externos", async ({ page }) => {
  const { email } = await createVerifiedUser();
  await login(page, email, PASSWORD, "/blog/senales-sistema-a-medida");
  await expect(page).toHaveURL(/\/blog\/senales-sistema-a-medida$/);

  await page.context().clearCookies();
  for (const volver of ["https://otro.com", "//otro.com", "/blog/no-existe"]) {
    await login(page, email, PASSWORD, volver);
    await expect(page).toHaveURL(/\/cuenta\/perfil$/);
    await page.context().clearCookies();
  }
});

test("cookie de sesión: sin Recordarme es de sesión, con Recordarme dura 30 días", async ({ page }) => {
  const { email } = await createVerifiedUser();
  const sessionCookie = async () =>
    (await page.context().cookies()).find((c) => c.name.endsWith("session_token"))!;

  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  let cookie = await sessionCookie();
  expect(cookie.expires).toBe(-1);
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.secure).toBe(true); // el build de producción marca la cookie como Secure

  await page.context().clearCookies();
  await page.goto("/cuenta/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Recordarme").check();
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  cookie = await sessionCookie();
  const dias = (cookie.expires - Date.now() / 1000) / 86400;
  expect(dias).toBeGreaterThan(29);
  expect(dias).toBeLessThan(31);
});

test("recuperar contraseña: mismo mensaje, link de un solo uso y sesiones revocadas", async ({
  page,
  browser,
}) => {
  const { email } = await createVerifiedUser();
  const mensaje = "Si el email tiene una cuenta, te enviamos un link.";

  const destinoInexistente = uniqueEmail("nadie");
  for (const destino of [destinoInexistente, email]) {
    await page.goto("/cuenta/recuperar");
    await page.getByLabel("Email").fill(destino);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.locator("form").getByRole("status")).toHaveText(mensaje);
  }
  const resetLink = await waitForLink(email, "Recuperá tu contraseña");
  expect(await mailCount(destinoInexistente, "Recuperá tu contraseña")).toBe(0);

  // Una sesión abierta antes del cambio.
  const otra = await (await browser.newContext({ baseURL: APP })).newPage();
  await login(otra, email);
  await expect(otra).toHaveURL(/\/cuenta\/perfil$/);

  await page.goto(resetLink);
  await expect(page).toHaveURL(/\/cuenta\/nueva-contrasena\?token=/);
  const token = new URL(page.url()).searchParams.get("token")!;
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("clave-nueva-123");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page).toHaveURL(/\/cuenta\/login\?estado=contrasena-actualizada$/);
  await expect(page.locator("form").getByRole("status")).toHaveText(
    "Tu contraseña se actualizó. Ya podés iniciar sesión.",
  );

  await otra.goto("/cuenta/perfil");
  await expect(otra).toHaveURL(/\/cuenta\/login/);
  await otra.context().close();

  await login(page, email, PASSWORD);
  await expect(page.locator("form").getByRole("alert")).toHaveText(ERR_CREDENCIALES);
  await login(page, email, "clave-nueva-123");
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);

  // El link ya se usó: la página lo rechaza y enviar el token de nuevo falla.
  await page.goto(resetLink);
  await expect(page.getByRole("heading", { name: "El link venció o no es válido" })).toBeVisible();
  await page.goto(`/cuenta/nueva-contrasena?token=${token}`);
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("otra-clave-456");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "El link venció o no es válido. Pedí uno nuevo.",
  );
});

test("perfil y admin: sin sesión, con cookie inventada, lector y admin", async ({
  page,
  context,
  consoleErrors,
}) => {
  await page.goto("/cuenta/perfil");
  await expect(page).toHaveURL(/\/cuenta\/login\?volver=%2Fcuenta%2Fperfil$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/cuenta\/login\?volver=%2Fadmin$/);

  // El proxy deja pasar la cookie, la DAL la rechaza.
  await context.addCookies([
    {
      name: "__Secure-better-auth.session_token",
      value: "inventada.firma",
      domain: "localhost",
      path: "/",
      secure: true,
    },
  ]);
  await page.goto("/cuenta/perfil");
  await expect(page).toHaveURL(/\/cuenta\/login/);
  await context.clearCookies();

  const { email, name } = await createVerifiedUser();
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  consoleErrors.length = 0; // el 404 de /admin para un lector es esperado y el navegador lo loguea

  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administración" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("cell", { name: email })).toBeVisible();
  await expect(page.getByRole("cell", { name, exact: true }).first()).toBeVisible();
  const html = await (await page.request.get("/admin")).text();
  expect(html).not.toMatch(/hash|session_token|"password"/i);
});

test("las páginas nuevas no tienen scroll horizontal a 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { email } = await createVerifiedUser();
  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);

  for (const ruta of ["/cuenta/perfil", "/admin", "/cuenta/verificar", "/cuenta/nueva-contrasena?token=x"]) {
    await page.goto(ruta);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, ruta).toBeLessThanOrEqual(0);
  }
});

test("menú mobile con sesión: perfil, administración y cerrar sesión", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { email } = await createVerifiedUser();
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);

  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("link", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("link", { name: "Ingresar" }).last()).toBeVisible();
});

test("el menú muestra Administración solo a un admin", async ({ page }) => {
  const { email } = await createVerifiedUser();
  await sql("update \"user\" set role = 'admin' where email = $1", [email]);
  await login(page, email);
  await expect(page).toHaveURL(/\/cuenta\/perfil$/);
  await page.getByRole("button", { name: /^Menú de / }).click();
  await expect(page.getByRole("link", { name: "Administración", exact: true })).toBeVisible();
});

for (const ruta of ["/cuenta/verificar", "/cuenta/nueva-contrasena"]) {
  test(`${ruta} tiene noindex`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
}
