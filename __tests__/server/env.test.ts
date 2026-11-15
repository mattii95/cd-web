import { afterEach, describe, expect, it, vi } from "vitest";
import { getDatabaseUrl } from "@/db/env";

describe("getDatabaseUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("devuelve una URL postgres válida", () => {
    vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5432/db");
    expect(getDatabaseUrl()).toBe("postgres://u:p@localhost:5432/db");
  });

  it("acepta el protocolo postgresql://", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/db");
    expect(getDatabaseUrl()).toBe("postgresql://u:p@localhost:5432/db");
  });

  it("lanza si la variable falta", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    expect(() => getDatabaseUrl()).toThrow("DATABASE_URL");
  });

  it("lanza con una URL http://", () => {
    vi.stubEnv("DATABASE_URL", "http://localhost:5432/db");
    expect(() => getDatabaseUrl()).toThrow("DATABASE_URL");
  });

  it("lanza con un texto que no es URL", () => {
    vi.stubEnv("DATABASE_URL", "no-soy-una-url");
    expect(() => getDatabaseUrl()).toThrow("DATABASE_URL");
  });
});
