import { describe, expect, it } from "vitest";
import { parseTagParams, tagQueryHref } from "@/lib/admin/tag-params";

describe("parseTagParams", () => {
  it("sin params devuelve los defaults", () => {
    expect(parseTagParams({})).toEqual({ q: null, page: 1 });
  });

  it("q se recorta y page se lee", () => {
    expect(parseTagParams({ q: "  seo ", page: "2" })).toEqual({ q: "seo", page: 2 });
  });

  it.each(["0", "-1", "abc", "2.5", ""])("page %j cae a 1", (page) => {
    expect(parseTagParams({ page }).page).toBe(1);
  });

  it("q vacío da null y q de 101 caracteres se corta a 100", () => {
    expect(parseTagParams({ q: "   " }).q).toBeNull();
    expect(parseTagParams({ q: "a".repeat(101) }).q).toHaveLength(100);
  });

  it("con valores repetidos toma el primero", () => {
    expect(parseTagParams({ q: ["a", "b"], page: ["3", "4"] })).toEqual({ q: "a", page: 3 });
  });
});

describe("tagQueryHref", () => {
  it("omite los valores por defecto", () => {
    expect(tagQueryHref({ q: null, page: 1 })).toBe("/admin/tags");
    expect(tagQueryHref({ q: "seo", page: 1 })).toBe("/admin/tags?q=seo");
    expect(tagQueryHref({ q: "seo", page: 2 })).toBe("/admin/tags?q=seo&page=2");
  });

  it("escapa la búsqueda", () => {
    expect(tagQueryHref({ q: "a&b 50%", page: 1 })).toBe("/admin/tags?q=a%26b+50%25");
  });
});
