import { describe, expect, it } from "vitest";
import { mediaQueryHref, parseMediaParams } from "@/lib/admin/media-params";

describe("parseMediaParams", () => {
  it("sin params devuelve los defaults", () => {
    expect(parseMediaParams({})).toEqual({ q: null, uso: null });
  });

  it("q se recorta y uso se lee", () => {
    expect(parseMediaParams({ q: "  equipo ", uso: "sin-usar" })).toEqual({
      q: "equipo",
      uso: "sin-usar",
    });
  });

  it("uso inválido cae a null", () => {
    expect(parseMediaParams({ uso: "otro" }).uso).toBeNull();
  });

  it("q vacío da null y q de 101 caracteres se corta a 100", () => {
    expect(parseMediaParams({ q: "   " }).q).toBeNull();
    expect(parseMediaParams({ q: "a".repeat(101) }).q).toHaveLength(100);
  });
});

describe("mediaQueryHref", () => {
  it("omite los valores por defecto", () => {
    expect(mediaQueryHref({ q: null, uso: null })).toBe("/admin/media");
  });

  it("incluye q y uso", () => {
    expect(mediaQueryHref({ q: "equipo", uso: "sin-usar" })).toBe(
      "/admin/media?q=equipo&uso=sin-usar",
    );
  });
});
