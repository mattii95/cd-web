import { expect, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Client } from "pg";

try {
  process.loadEnvFile(".env.test.local");
} catch {
  // En CI las variables vienen del entorno.
}

const execFileAsync = promisify(execFile);

const MAILPIT = "http://localhost:8025";
export const APP = "http://localhost:3100";
export const PASSWORD = "secreta123";

export const uniqueEmail = (prefix = "e2e") =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.com`;

export async function sql<T extends object = object>(text: string, params: unknown[] = []) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

// En las páginas con Turnstile "networkidle" no llega nunca: el widget sigue en contacto con
// Cloudflare. Que el widget haya entregado el token prueba que la página hidrató.
export async function waitForCaptcha(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue("", {
    timeout: 15_000,
  });
}

export const clearRateLimit = () => sql("delete from rate_limit");

// Crea un usuario ya verificado, sin pasar por el email.
export async function createVerifiedUser(email = uniqueEmail(), name = "Ana Pérez") {
  // Los endpoints HTTP de registro están cerrados: se crea por auth.api con un script.
  await execFileAsync(
    "npx",
    ["tsx", "--conditions=react-server", "scripts/create-user.ts", email, name, PASSWORD],
    {
      env: {
        ...process.env,
        BETTER_AUTH_URL: APP,
        SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
        SMTP_PORT: process.env.SMTP_PORT ?? "1025",
        MAIL_FROM: process.env.MAIL_FROM ?? "Courroux Digital <no-reply@localhost>",
      },
    },
  );
  await sql("update \"user\" set email_verified = true where email = $1", [email]);
  return { email, name };
}

export async function login(page: Page, email: string, password = PASSWORD, volver?: string) {
  await page.goto(volver ? `/cuenta/login?volver=${encodeURIComponent(volver)}` : "/cuenta/login");
  // Sin esperar al widget, al cargar mueve el botón y el click puede caer fuera de él.
  await waitForCaptcha(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

type Message = { ID: string; Subject: string };

// Espera el primer email con ese asunto para esa dirección y devuelve el link que trae.
export async function waitForLink(to: string, subject: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: Message[] };
    const found = messages.find((m) => m.Subject === subject);
    if (found) {
      const detail = await (await fetch(`${MAILPIT}/api/v1/message/${found.ID}`)).json();
      return (detail.Text as string).match(/https?:\/\/\S+/)![0];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No llegó el email "${subject}" a ${to}`);
}

export async function mailCount(to: string, subject: string) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
  const { messages } = (await res.json()) as { messages: Message[] };
  return messages.filter((m) => m.Subject === subject).length;
}

const mediaDir = () =>
  path.resolve(process.cwd(), process.env.MEDIA_DIR || "storage/media");

// Inserta n imágenes con SQL (más rápido que subirlas por la UI), de "Semilla 01" la más nueva
// en adelante, con created_at separado por un segundo y una hora antes de ahora para que
// una imagen subida después quede primera. Copia el WebP de fixture a MEDIA_DIR para cada fila.
export async function seedMedia(n: number) {
  const rows = await sql<{ id: string }>(
    `insert into media (id, sha256, alt, width, height, bytes, original_name, created_at)
     select gen_random_uuid()::text, 'seed-' || gen_random_uuid()::text,
            'Semilla ' || lpad(i::text, 2, '0'), 64, 48, 1000,
            'seed-' || i || '.webp',
            now() - interval '1 hour' - (i * interval '1 second')
     from generate_series(1, $1::int) i
     returning id`,
    [n],
  );
  await mkdir(mediaDir(), { recursive: true });
  for (const { id } of rows) {
    await copyFile("e2e/fixtures/imagen.webp", path.join(mediaDir(), `${id}.webp`));
  }
  return rows.map((r) => r.id);
}

export async function clearSeedMedia() {
  const rows = await sql<{ id: string }>(
    "delete from media where original_name like 'seed-%' returning id",
  );
  for (const { id } of rows) await rm(path.join(mediaDir(), `${id}.webp`), { force: true });
}

// Imágenes que los tests suben por la UI (e2e/fixtures): fila y archivo. Borrar antes los posts que las usan.
export async function clearUploadedMedia() {
  const rows = await sql<{ id: string }>(
    "delete from media where original_name in ('imagen.png', 'imagen.webp') or original_name like 'e2e-medios-%' returning id",
  );
  for (const { id } of rows) await rm(path.join(mediaDir(), `${id}.webp`), { force: true });
}
