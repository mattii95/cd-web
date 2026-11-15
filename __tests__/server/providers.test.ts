import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEnabledProviders,
  getSocialProvidersConfig,
} from "@/lib/auth/providers";

const KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
];

describe("proveedores OAuth", () => {
  beforeEach(() => KEYS.forEach((k) => vi.stubEnv(k, "")));
  afterEach(() => vi.unstubAllEnvs());

  it("sin variables no habilita ninguno", () => {
    expect(getEnabledProviders()).toEqual([]);
    expect(getSocialProvidersConfig()).toEqual({});
  });

  it("con todas las variables devuelve los tres en orden fijo", () => {
    KEYS.forEach((k) => vi.stubEnv(k, "x"));
    expect(getEnabledProviders()).toEqual(["google", "github", "microsoft"]);
    expect(getSocialProvidersConfig()).toMatchObject({
      google: { clientId: "x", clientSecret: "x" },
      github: { clientId: "x", clientSecret: "x" },
      microsoft: { tenantId: "common", disableProfilePhoto: true },
    });
  });

  it("habilita solo el que tiene las dos variables", () => {
    vi.stubEnv("GITHUB_CLIENT_ID", "id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "secret");
    expect(getEnabledProviders()).toEqual(["github"]);
    expect(Object.keys(getSocialProvidersConfig())).toEqual(["github"]);
  });

  it("lanza nombrando la variable que falta", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    expect(() => getSocialProvidersConfig()).toThrow("GOOGLE_CLIENT_SECRET");
    expect(() => getEnabledProviders()).toThrow("GOOGLE_CLIENT_SECRET");
  });
});
