import { afterEach, describe, expect, it, vi } from "vitest";
import { getMailEnv } from "@/lib/mail/env";

function stubValid() {
  vi.stubEnv("SMTP_HOST", "localhost");
  vi.stubEnv("SMTP_PORT", "1025");
  vi.stubEnv("MAIL_FROM", "Courroux Digital <no-reply@localhost>");
}

describe("getMailEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("convierte el puerto a número y acepta usuario y contraseña vacíos", () => {
    stubValid();
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    expect(getMailEnv()).toMatchObject({ SMTP_HOST: "localhost", SMTP_PORT: 1025 });
  });

  it("lanza si falta el host", () => {
    stubValid();
    vi.stubEnv("SMTP_HOST", undefined);
    expect(() => getMailEnv()).toThrow("SMTP_HOST");
  });

  it("lanza si el puerto no es un número válido", () => {
    stubValid();
    vi.stubEnv("SMTP_PORT", "abc");
    expect(() => getMailEnv()).toThrow("SMTP_PORT");
  });

  it("lanza si falta MAIL_FROM", () => {
    stubValid();
    vi.stubEnv("MAIL_FROM", undefined);
    expect(() => getMailEnv()).toThrow("MAIL_FROM");
  });
});
