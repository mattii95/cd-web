import { describe, expect, it } from "vitest";
import { resolveAfterLogin, resolveBackHref } from "@/lib/back-href";

describe("resolveBackHref", () => {
  it("acepta el slug de un artículo que existe", () => {
    expect(resolveBackHref("/blog/senales-sistema-a-medida")).toBe(
      "/blog/senales-sistema-a-medida",
    );
  });

  it.each([
    ["null", null],
    ["URL absoluta", "https://otro.com"],
    ["URL sin protocolo", "//otro.com"],
    ["artículo que no existe", "/blog/no-existe"],
    ["path traversal", "/blog/../cuenta"],
  ])("devuelve /blog para %s", (_caso, volver) => {
    expect(resolveBackHref(volver)).toBe("/blog");
  });
});

describe("resolveAfterLogin", () => {
  it.each([
    "/blog/senales-sistema-a-medida",
    "/cuenta/perfil",
    "/admin",
  ])("acepta %s", (volver) => {
    expect(resolveAfterLogin(volver)).toBe(volver);
  });

  it.each([
    ["null", null],
    ["URL absoluta", "https://otro.com"],
    ["URL sin protocolo", "//otro.com"],
    ["artículo que no existe", "/blog/no-existe"],
    ["subruta de admin", "/admin/usuarios"],
  ])("devuelve /cuenta/perfil para %s", (_caso, volver) => {
    expect(resolveAfterLogin(volver)).toBe("/cuenta/perfil");
  });
});
