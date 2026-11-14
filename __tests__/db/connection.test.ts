import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db/client";

describe("conexión a la base de test", () => {
  afterAll(closeDb);

  it("responde SELECT 1", async () => {
    const result = await getDb().execute(sql`select 1 as one`);
    expect(result.rows[0]).toEqual({ one: 1 });
  });

  it("tiene la tabla de migraciones de Drizzle", async () => {
    const result = await getDb().execute(
      sql`select to_regclass('drizzle.__drizzle_migrations') as t`,
    );
    expect(result.rows[0]).toEqual({ t: "drizzle.__drizzle_migrations" });
  });
});
