import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { account, user } from "@/db/schema";
import { removeUnverifiedPassword } from "@/lib/auth/link-guard";

const crear = async (id: string, emailVerified: boolean) => {
  const db = getDb();
  await db.insert(user).values({ id, name: id, email: `${id}@test.com`, emailVerified });
  await db.insert(account).values([
    { id: `${id}-c`, accountId: id, providerId: "credential", userId: id, password: "hash" },
    { id: `${id}-g`, accountId: `g-${id}`, providerId: "github", userId: id },
  ]);
};

const providers = async (id: string) =>
  (await getDb().select().from(account).where(eq(account.userId, id)))
    .map((a) => a.providerId)
    .sort();

describe("removeUnverifiedPassword", () => {
  beforeEach(async () => {
    await getDb().delete(user);
  });
  afterAll(closeDb);

  it("borra la fila credential de un usuario sin verificar y deja las demás", async () => {
    await crear("sin", false);
    await removeUnverifiedPassword("sin");
    expect(await providers("sin")).toEqual(["github"]);
  });

  it("no toca la de un usuario verificado", async () => {
    await crear("ver", true);
    await removeUnverifiedPassword("ver");
    expect(await providers("ver")).toEqual(["credential", "github"]);
  });

  it("ignora un usuario inexistente", async () => {
    await expect(removeUnverifiedPassword("nadie")).resolves.toBeUndefined();
  });
});
