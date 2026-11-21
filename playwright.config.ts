import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.test.local");
} catch {
  // En CI las variables vienen del entorno.
}

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Los límites de intentos son por IP y la base es una sola: un worker evita que archivos distintos se pisen.
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      testIgnore: /(auth|oauth|avatar|medios|comunidad|admin|articles|article-editor|media-picker|categories|tags|usuarios|comentarios)\.spec/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
  // Prueba el build de producción: next dev no reproduce el prerender con cacheComponents.
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !isCI,
    timeout: 180_000,
    // El servidor usa la base de test (DATABASE_URL de .env.test.local) y Mailpit.
    env: {
      BETTER_AUTH_URL: "http://localhost:3100",
      // Claves de prueba de Cloudflare (siempre pasan). El build incrusta la site key.
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
      SMTP_PORT: process.env.SMTP_PORT ?? "1025",
      MAIL_FROM: process.env.MAIL_FROM ?? "Courroux Digital <no-reply@localhost>",
    },
  },
});
