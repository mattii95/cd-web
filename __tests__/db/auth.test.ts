import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { rateLimit, session, user, verification } from "@/db/schema";

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
});
