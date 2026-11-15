import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

try {
  process.loadEnvFile(".env.test.local");
} catch {
  // En CI las variables vienen del entorno.
}

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

export const clearRateLimit = () => sql("delete from rate_limit");

// Crea un usuario ya verificado, sin pasar por el email.
export async function createVerifiedUser(email = uniqueEmail(), name = "Ana Pérez") {
  const res = await fetch(`${APP}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: APP },
    body: JSON.stringify({ name, email, password: PASSWORD }),
  });
  expect(res.ok).toBe(true);
  await sql("update \"user\" set email_verified = true where email = $1", [email]);
  return { email, name };
}

export async function login(page: Page, email: string, password = PASSWORD, volver?: string) {
  await page.goto(volver ? `/cuenta/login?volver=${encodeURIComponent(volver)}` : "/cuenta/login");
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
