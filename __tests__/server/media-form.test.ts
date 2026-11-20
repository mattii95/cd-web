import { describe, expect, it } from "vitest";
import { MEDIA_LIMITS } from "@/lib/media/process";
import { UPLOAD_LIMITS, checkUploadFile, parseMediaForm } from "@/lib/admin/media-form";

const ID = "3f2b8c1e-9d4a-4c7e-8b21-5a6f0e9d1c33";
const form = (over: Record<string, string>) => {
  const fd = new FormData();
  const base = { id: ID, alt: "Equipo", originalName: "equipo.png", ...over };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
};

describe("parseMediaForm", () => {
  it("datos válidos, recortados", () => {
    expect(parseMediaForm(form({ alt: "  Equipo  " }))).toEqual({
      ok: true,
      id: ID,
      input: { alt: "Equipo", originalName: "equipo.png" },
    });
  });

  it.each([
    ["alt", { alt: "" }],
    ["alt", { alt: "a".repeat(301) }],
    ["originalName", { originalName: "" }],
    ["originalName", { originalName: "a".repeat(201) }],
    ["id", { id: "no-es-uuid" }],
  ])("error en %s", (field, over) => {
    const r = parseMediaForm(form(over));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors).toHaveProperty(field);
  });

  it("alt vacío usa el mensaje del spec", () => {
    const r = parseMediaForm(form({ alt: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.alt).toBe("El texto alternativo no puede estar vacío.");
  });
});

describe("checkUploadFile", () => {
  it("rechaza formato", () => {
    expect(checkUploadFile({ type: "image/gif", size: 1 })).toMatch(/^Formato no soportado/);
  });

  it("rechaza tamaño", () => {
    expect(checkUploadFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toBe(
      "La imagen supera el máximo de 10 MB.",
    );
  });

  it("acepta un PNG de 1 MB", () => {
    expect(checkUploadFile({ type: "image/png", size: 1024 * 1024 })).toBeNull();
  });
});

describe("UPLOAD_LIMITS", () => {
  it("espeja MEDIA_LIMITS", () => {
    expect(UPLOAD_LIMITS.maxBytes).toBe(MEDIA_LIMITS.maxBytes);
    for (const f of MEDIA_LIMITS.formats) expect(UPLOAD_LIMITS.types).toContain(`image/${f}`);
  });
});
