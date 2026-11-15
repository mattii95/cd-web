import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthEnv } from "@/lib/auth/env";

const SECRET = "a".repeat(32);

describe("getAuthEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("devuelve secret y URL válidos", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    expect(getAuthEnv()).toMatchObject({
      BETTER_AUTH_SECRET: SECRET,
      BETTER_AUTH_URL: "http://localhost:3000",
    });
  });

  it("lanza si el secret tiene menos de 32 caracteres", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "corto");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    expect(() => getAuthEnv()).toThrow("BETTER_AUTH_SECRET");
  });

  it("lanza si falta el secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", undefined);
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    expect(() => getAuthEnv()).toThrow("BETTER_AUTH_SECRET");
  });

  it("lanza si la URL no es válida", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    vi.stubEnv("BETTER_AUTH_URL", "no-soy-una-url");
    expect(() => getAuthEnv()).toThrow("BETTER_AUTH_URL");
  });
});
