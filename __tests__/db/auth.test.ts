import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { account, rateLimit, session, user, verification } from "@/db/schema";
import { getAuth } from "@/lib/auth/auth";

const nuevoUsuario = (id: string, email = `${id}@test.com`) => ({
  id,
  name: id,
  email,
});

describe("esquema de auth", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(session);
    await db.delete(verification);
    await db.delete(rateLimit);
    await db.delete(user);
  });
  afterAll(closeDb);

  it("un usuario nuevo es lector y no verificado", async () => {
    const db = getDb();
    await db.insert(user).values(nuevoUsuario("u1"));
    const [row] = await db.select().from(user).where(eq(user.id, "u1"));
    expect(row.role).toBe("lector");
    expect(row.emailVerified).toBe(false);
  });

  it("rechaza un rol fuera del enum", async () => {
    const db = getDb();
    await expect(
      db.insert(user).values({ ...nuevoUsuario("u2"), role: "root" as "admin" }),
    ).rejects.toThrow();
  });

  it("rechaza un email repetido", async () => {
    const db = getDb();
    await db.insert(user).values(nuevoUsuario("u3", "a@test.com"));
    await expect(
      db.insert(user).values(nuevoUsuario("u4", "a@test.com")),
    ).rejects.toThrow();
  });

  it("borrar el usuario borra sus sesiones", async () => {
    const db = getDb();
    await db.insert(user).values(nuevoUsuario("u5"));
    await db.insert(session).values({
      id: "s1",
      token: "t1",
      userId: "u5",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db.delete(user).where(eq(user.id, "u5"));
    expect(await db.select().from(session)).toHaveLength(0);
  });

  it("rate_limit guarda lastRequest como número", async () => {
    const db = getDb();
    const now = Date.now();
    await db.insert(rateLimit).values({ id: "r1", key: "ip|/sign-in/email", count: 1, lastRequest: now });
    const [row] = await db.select().from(rateLimit);
    expect(row.lastRequest).toBe(now);
  });

  it("rechaza banned_at sin ban_reason, o un motivo de solo espacios", async () => {
    const db = getDb();
    await expect(
      db.insert(user).values({ ...nuevoUsuario("b1"), bannedAt: new Date() }),
    ).rejects.toThrow();
    await expect(
      db.insert(user).values({ ...nuevoUsuario("b2"), bannedAt: new Date(), banReason: "   " }),
    ).rejects.toThrow();
    await expect(
      db.insert(user).values({ ...nuevoUsuario("b3"), banReason: "motivo sin fecha" }),
    ).rejects.toThrow();
  });
});

describe("bloqueo en el login", () => {
  const password = "secreta123";

  beforeEach(async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", process.env.BETTER_AUTH_SECRET ?? "x".repeat(32));
    vi.stubEnv("BETTER_AUTH_URL", process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
    const db = getDb();
    await db.delete(session);
    await db.delete(rateLimit);
    await db.delete(user);
    const hash = await (await getAuth().$context).password.hash(password);
    await db.insert(user).values({
      ...nuevoUsuario("ban"),
      emailVerified: true,
      bannedAt: new Date(),
      banReason: "spam",
    });
    await db.insert(account).values({
      id: "ban-cred",
      accountId: "ban",
      providerId: "credential",
      userId: "ban",
      password: hash,
    });
  });

  it("con la contraseña correcta lanza ACCOUNT_SUSPENDED y no crea sesión", async () => {
    await expect(
      getAuth().api.signInEmail({ body: { email: "ban@test.com", password } }),
    ).rejects.toMatchObject({ body: { code: "ACCOUNT_SUSPENDED" } });
    expect(await getDb().select().from(session)).toHaveLength(0);
  });

  it("con una contraseña incorrecta sigue dando INVALID_EMAIL_OR_PASSWORD", async () => {
    await expect(
      getAuth().api.signInEmail({ body: { email: "ban@test.com", password: "incorrecta1" } }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });

  it("al desbloquearlo puede entrar", async () => {
    await getDb().update(user).set({ bannedAt: null, banReason: null }).where(eq(user.id, "ban"));
    const res = await getAuth().api.signInEmail({ body: { email: "ban@test.com", password } });
    expect(res.user.id).toBe("ban");
  });
});
