import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db/client";
import { account, user } from "@/db/schema";
import { getLoginMethods } from "@/lib/auth/dal";

describe("getLoginMethods", () => {
  beforeEach(async () => {
    await getDb().delete(user);
  });
  afterAll(closeDb);

  it("devuelve los métodos en orden fijo, sin importar el de inserción", async () => {
    const db = getDb();
    await db.insert(user).values({ id: "u", name: "u", email: "u@test.com" });
    await db.insert(account).values(
      ["microsoft", "github", "credential", "google"].map((p) => ({
        id: `u-${p}`,
        accountId: p,
        providerId: p,
        userId: "u",
      })),
    );
    expect(await getLoginMethods("u")).toEqual(["credential", "google", "github", "microsoft"]);
  });

  it("devuelve vacío para un usuario sin cuentas", async () => {
    expect(await getLoginMethods("nadie")).toEqual([]);
  });
});
