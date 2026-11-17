import { describe, expect, it } from "vitest";
import { resolveAfterLogin, resolveBackHref } from "@/lib/back-href";

describe("resolveBackHref", () => {
  it("acepta cualquier /blog/{slug} con formato válido", () => {
    expect(resolveBackHref("/blog/senales-sistema-a-medida")).toBe(
      "/blog/senales-sistema-a-medida",
    );
    expect(resolveBackHref("/blog/cualquier-slug")).toBe(
      "/blog/cualquier-slug",
    );
  });

  it.each([
    ["null", null],
    ["URL absoluta", "https://otro.com"],
    ["URL sin protocolo", "//otro.com"],
    ["path traversal", "/blog/../x"],
    ["mayúsculas", "/blog/Mayus"],
    ["subruta", "/blog/a/b"],
  ])("devuelve /blog para %s", (_caso, volver) => {
    expect(resolveBackHref(volver)).toBe("/blog");
  });
});

describe("resolveAfterLogin", () => {
  it.each([
    "/blog/senales-sistema-a-medida",
    "/blog/cualquier-slug",
    "/cuenta/perfil",
    "/admin",
  ])("acepta %s", (volver) => {
    expect(resolveAfterLogin(volver)).toBe(volver);
  });

  it.each([
    ["null", null],
    ["URL absoluta", "https://otro.com"],
    ["URL sin protocolo", "//otro.com"],
    ["mayúsculas", "/blog/Mayus"],
    ["subruta de admin", "/admin/usuarios"],
  ])("devuelve /cuenta/perfil para %s", (_caso, volver) => {
    expect(resolveAfterLogin(volver)).toBe("/cuenta/perfil");
  });
});
