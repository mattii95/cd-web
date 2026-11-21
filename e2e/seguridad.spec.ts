import { expect, test } from "./fixtures";
import {
  APP,
  PASSWORD,
  clearRateLimit,
  createVerifiedUser,
  login,
  sql,
  uniqueEmail,
  waitForCaptcha,
} from "./helpers";

// Mismas razones que auth.spec: serie, solo desktop y sin intentos acumulados.
test.describe.configure({ mode: "serial" });
test.beforeEach(clearRateLimit);

const SLUG = "senales-sistema-a-medida";

test.describe("headers de seguridad", () => {
  for (const ruta of ["/", "/blog", "/cuenta/login"]) {
    test(`${ruta} trae los headers y no revela X-Powered-By`, async ({ request }) => {
      const res = await request.get(ruta);
      const h = res.headers();
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["referrer-policy"]).toBeTruthy();
      expect(h["permissions-policy"]).toBeTruthy();
      expect(h["x-powered-by"]).toBeUndefined();
    });
  }

  test("las pantallas más pesadas cargan sin violaciones de CSP", async ({ page }) => {
    const mensajes: string[] = [];
    page.on("console", (m) => mensajes.push(m.text()));

    const { email } = await createVerifiedUser();
    await sql("update \"user\" set role = 'admin' where email = $1", [email]);

    for (const ruta of ["/", `/blog/${SLUG}`]) {
      await page.goto(ruta);
      await page.waitForLoadState("networkidle");
    }
    // El widget de Turnstile (script y iframe de Cloudflare) también tiene que cargar bajo la CSP.
    await page.goto("/cuenta/login");
    await waitForCaptcha(page);
    await login(page, email);
    await expect(page).toHaveURL(/\/cuenta\/perfil$/);
    for (const ruta of ["/admin", "/admin/articles/new", "/admin/media"]) {
      await page.goto(ruta);
      await page.waitForLoadState("networkidle");
    }

    expect(mensajes.filter((m) => /Content Security Policy/i.test(m))).toEqual([]);
  });
});

test.describe("endpoints HTTP de email cerrados", () => {
  for (const ruta of [
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/email",
    "/api/auth/request-password-reset",
    "/api/auth/send-verification-email",
  ]) {
    test(`POST ${ruta} responde 404`, async ({ request }) => {
      const res = await request.post(`${APP}${ruta}`, {
        headers: { Origin: APP },
        data: { name: "Intruso", email: uniqueEmail(), password: PASSWORD, role: "admin" },
      });
      expect(res.status()).toBe(404);
    });
  }

  test("el registro por HTTP no crea al usuario aunque mande role admin", async ({ request }) => {
    const email = uniqueEmail();
    await request.post(`${APP}/api/auth/sign-up/email`, {
      headers: { Origin: APP },
      data: { name: "Intruso", email, password: PASSWORD, role: "admin" },
    });
    const rows = await sql('select 1 from "user" where email = $1', [email]);
    expect(rows).toHaveLength(0);
  });

  test("get-session sigue respondiendo 200", async ({ request }) => {
    const res = await request.get(`${APP}/api/auth/get-session`);
    expect(res.status()).toBe(200);
  });
});

test("robots.txt bloquea admin, cuenta y api y no lista sitemap", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const texto = await res.text();
  expect(texto).toContain("Disallow: /admin");
  expect(texto).toContain("Disallow: /cuenta");
  expect(texto).toContain("Disallow: /api");
  expect(texto).not.toMatch(/sitemap/i);
});
