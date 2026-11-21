import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  vi.resetModules();
  return (await import("@/lib/security/client-ip")).getClientIp;
}

const h = (init: Record<string, string>) => new Headers(init);

describe("getClientIp", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("TRUSTED_IP_HEADER", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("x-forwarded-for: toma el último valor", async () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "x-forwarded-for");
    const getClientIp = await load();
    expect(getClientIp(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("2.2.2.2");
  });

  it("cf-connecting-ip: ignora x-forwarded-for", async () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "cf-connecting-ip");
    const getClientIp = await load();
    expect(
      getClientIp(h({ "x-forwarded-for": "1.1.1.1", "cf-connecting-ip": "3.3.3.3" })),
    ).toBe("3.3.3.3");
  });

  it("sin variable devuelve local aunque venga x-forwarded-for", async () => {
    const getClientIp = await load();
    expect(getClientIp(h({ "x-forwarded-for": "1.1.1.1" }))).toBe("local");
  });

  it("sin header en la request devuelve local", async () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "x-real-ip");
    const getClientIp = await load();
    expect(getClientIp(h({}))).toBe("local");
  });

  it("en producción sin variable advierte una sola vez", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const getClientIp = await load();
    getClientIp(h({}));
    getClientIp(h({}));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("valor inválido lanza un error que nombra la variable", async () => {
    vi.stubEnv("TRUSTED_IP_HEADER", "x-foo");
    const getClientIp = await load();
    expect(() => getClientIp(h({}))).toThrow(/TRUSTED_IP_HEADER/);
  });
});
