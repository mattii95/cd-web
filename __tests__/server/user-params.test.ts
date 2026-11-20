import { describe, expect, it } from "vitest";
import { parseUserParams, userQueryHref } from "@/lib/admin/user-params";

describe("parseUserParams", () => {
  it("sin params devuelve los defaults", () => {
    expect(parseUserParams({})).toEqual({ q: null, estado: null, rol: null, page: 1 });
  });

  it("lee q, estado, rol y page", () => {
    expect(
      parseUserParams({ q: "  ana ", estado: "bloqueados", rol: "lectores", page: "2" }),
    ).toEqual({ q: "ana", estado: "bloqueados", rol: "lectores", page: 2 });
  });

  it("valores inválidos caen a null o 1", () => {
    expect(parseUserParams({ estado: "otro", rol: "otro" })).toMatchObject({
      estado: null,
      rol: null,
    });
    for (const page of ["0", "abc", "-1", "2.5", ""]) {
      expect(parseUserParams({ page }).page).toBe(1);
    }
  });

  it("q vacío da null y q de 101 caracteres se recorta a 100", () => {
    expect(parseUserParams({ q: "   " }).q).toBeNull();
    expect(parseUserParams({ q: "a".repeat(101) }).q).toHaveLength(100);
  });

  it("con valores repetidos toma el primero", () => {
    expect(parseUserParams({ estado: ["activos", "bloqueados"], page: ["3", "4"] })).toMatchObject({
      estado: "activos",
      page: 3,
    });
  });
});

describe("userQueryHref", () => {
  it("con todo por defecto devuelve /admin/users", () => {
    expect(userQueryHref({ q: null, estado: null, rol: null, page: 1 })).toBe("/admin/users");
  });

  it("con todo, arma la URL en orden", () => {
    expect(userQueryHref({ q: "ana", estado: "bloqueados", rol: "lectores", page: 2 })).toBe(
      "/admin/users?q=ana&estado=bloqueados&rol=lectores&page=2",
    );
  });

  it("escapa la búsqueda", () => {
    expect(userQueryHref({ q: "a&b", estado: null, rol: null, page: 1 })).toBe(
      "/admin/users?q=a%26b",
    );
  });
});
