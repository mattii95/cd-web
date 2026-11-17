import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { rateLimit } from "@/db/schema";
import { hit, isUserRateLimited } from "@/lib/auth/rate-limit";

describe("hit", () => {
  beforeEach(async () => {
    await getDb().delete(rateLimit);
  });
  afterAll(closeDb);

  it("deja pasar hasta el máximo y corta el siguiente", async () => {
    for (let i = 0; i < 5; i++) expect(await hit("ip|sign-in", 5, 60)).toBe(false);
    expect(await hit("ip|sign-in", 5, 60)).toBe(true);
  });

  it("cada clave cuenta aparte", async () => {
    for (let i = 0; i < 6; i++) await hit("ip-a|sign-in", 5, 60);
    expect(await hit("ip-b|sign-in", 5, 60)).toBe(false);
  });

  it("vuelve a contar cuando vence la ventana", async () => {
    for (let i = 0; i < 6; i++) await hit("ip|sign-up", 3, 60);
    await getDb()
      .update(rateLimit)
      .set({ lastRequest: Date.now() - 61_000 })
      .where(eq(rateLimit.key, "ip|sign-up"));
    expect(await hit("ip|sign-up", 3, 60)).toBe(false);
  });

  it("isUserRateLimited corta el sexto comentario del mismo usuario y no el de otro", async () => {
    for (let i = 0; i < 5; i++) expect(await isUserRateLimited("comment", "ana")).toBe(false);
    expect(await isUserRateLimited("comment", "ana")).toBe(true);
    expect(await isUserRateLimited("comment", "beto")).toBe(false);
  });
});
