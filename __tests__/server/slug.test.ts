import { describe, expect, it } from "vitest";
import { isSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("saca tildes y signos", () => {
    expect(slugify("¿Qué es SaaS? Guía 2026")).toBe("que-es-saas-guia-2026");
  });
  it("ñ → n y sin guiones repetidos", () => {
    expect(slugify("Año  ñandú -- test")).toBe("ano-nandu-test");
  });
  it("recorta a 80 sin guion final", () => {
    const s = slugify("palabra ".repeat(40));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
  it("solo signos → vacío", () => {
    expect(slugify("¡¿?!")).toBe("");
  });
});

describe("isSlug", () => {
  it("acepta un slug válido", () => {
    expect(isSlug("seo-local-2026")).toBe(true);
  });
  it.each(["SEO", "-seo", "seo--local", "seo_local", "a".repeat(81), ""])(
    "rechaza %s",
    (v) => expect(isSlug(v)).toBe(false),
  );
});
