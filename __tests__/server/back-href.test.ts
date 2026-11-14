import { describe, expect, it } from "vitest";
import { resolveBackHref } from "@/lib/back-href";

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
