import { describe, expect, it } from "vitest";
import { commentQueryHref, parseCommentParams } from "@/lib/admin/comment-params";

const ID = "0b9c1f4e-6a1d-4c5b-8f0e-2d7a9b3c4e51";

describe("parseCommentParams", () => {
  it("sin params devuelve los defaults", () => {
    expect(parseCommentParams({})).toEqual({
      estado: "pendientes",
      articulo: null,
      q: null,
      page: 1,
    });
  });

  it("lee estado, articulo, q y page", () => {
    expect(
      parseCommentParams({ estado: "ocultos", articulo: ID, q: "  spam ", page: "2" }),
    ).toEqual({ estado: "ocultos", articulo: ID, q: "spam", page: 2 });
  });

  it("valores inválidos caen al default", () => {
    expect(parseCommentParams({ estado: "otro" }).estado).toBe("pendientes");
    expect(parseCommentParams({ articulo: "abc" }).articulo).toBeNull();
    for (const page of ["0", "abc", "-1", "2.5", ""]) {
      expect(parseCommentParams({ page }).page).toBe(1);
    }
  });

  it("q vacío da null y q de 101 caracteres se recorta a 100", () => {
    expect(parseCommentParams({ q: "   " }).q).toBeNull();
    expect(parseCommentParams({ q: "a".repeat(101) }).q).toHaveLength(100);
  });

  it("con valores repetidos toma el primero", () => {
    expect(parseCommentParams({ estado: ["todos", "ocultos"], page: ["3", "4"] })).toMatchObject({
      estado: "todos",
      page: 3,
    });
  });
});

describe("commentQueryHref", () => {
  it("con los valores por defecto devuelve /admin/comments", () => {
    expect(commentQueryHref({ estado: "pendientes", articulo: null, q: null, page: 1 })).toBe(
      "/admin/comments",
    );
  });

  it("con todo, arma la URL en orden", () => {
    expect(commentQueryHref({ estado: "ocultos", articulo: ID, q: "spam", page: 2 })).toBe(
      `/admin/comments?estado=ocultos&articulo=${ID}&q=spam&page=2`,
    );
  });

  it("escapa la búsqueda", () => {
    expect(commentQueryHref({ estado: "pendientes", articulo: null, q: "a&b", page: 1 })).toBe(
      "/admin/comments?q=a%26b",
    );
  });
});
