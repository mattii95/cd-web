import { afterAll, describe, expect, it } from "vitest";
import { closeDb } from "@/db/client";
import { checkDatabase } from "@/db/health";

describe("checkDatabase", () => {
  afterAll(closeDb);

  it("devuelve ok con la base de test", async () => {
    expect(await checkDatabase()).toEqual({ ok: true });
  });

  it("devuelve not ok con un puerto cerrado", async () => {
    expect(
      await checkDatabase("postgres://postgres:x@localhost:1/DB_CD26_test"),
    ).toEqual({ ok: false });
  });
});
