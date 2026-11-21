import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/security/headers";

const get = (isProd: boolean, key: string) =>
  securityHeaders(isProd).find((h) => h.key === key)?.value;

describe("securityHeaders", () => {
  it("producción incluye HSTS y upgrade-insecure-requests", () => {
    expect(get(true, "Strict-Transport-Security")).toBeDefined();
    expect(get(true, "Content-Security-Policy")).toContain(
      "upgrade-insecure-requests",
    );
  });

  it("desarrollo no los incluye y suma unsafe-eval en script-src", () => {
    const csp = get(false, "Content-Security-Policy")!;
    expect(get(false, "Strict-Transport-Security")).toBeUndefined();
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).toMatch(/script-src [^;]*'unsafe-eval'/);
  });

  it("la CSP de producción cierra frames y objetos y permite Turnstile", () => {
    const csp = get(true, "Content-Security-Policy")!;
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(csp).toMatch(/frame-src https:\/\/challenges\.cloudflare\.com/);
  });

  it("incluye los headers fijos", () => {
    for (const k of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ])
      expect(get(true, k)).toBeDefined();
  });
});
