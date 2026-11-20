import { describe, expect, it } from "vitest";
import { isDeleteConfirmed, parseBanForm } from "@/lib/admin/user-form";

const form = (fields: Record<string, string>) => {
  const d = new FormData();
  for (const [k, v] of Object.entries(fields)) d.set(k, v);
  return d;
};

describe("parseBanForm", () => {
  it("acepta un motivo válido y lo recorta", () => {
    expect(parseBanForm(form({ id: "u1", reason: "  spam  " }))).toEqual({
      ok: true,
      id: "u1",
      reason: "spam",
    });
  });

  it("acepta un motivo de exactamente 300 caracteres", () => {
    expect(parseBanForm(form({ id: "u1", reason: "a".repeat(300) })).ok).toBe(true);
  });

  it.each(["", "   "])("motivo %j da error en reason", (reason) => {
    expect(parseBanForm(form({ id: "u1", reason }))).toEqual({
      ok: false,
      fieldErrors: { reason: "Escribí el motivo del bloqueo." },
    });
  });

  it("motivo de 301 caracteres da error en reason", () => {
    expect(parseBanForm(form({ id: "u1", reason: "a".repeat(301) }))).toEqual({
      ok: false,
      fieldErrors: { reason: "El motivo puede tener hasta 300 caracteres." },
    });
  });

  it("id vacío o ausente da error en id", () => {
    expect(parseBanForm(form({ id: "", reason: "spam" }))).toMatchObject({
      ok: false,
      fieldErrors: { id: expect.any(String) },
    });
    expect(parseBanForm(form({ reason: "spam" }))).toMatchObject({ ok: false });
  });
});

describe("isDeleteConfirmed", () => {
  it("ignora espacios y mayúsculas", () => {
    expect(isDeleteConfirmed(" Ana@Mail.com ", "ana@mail.com")).toBe(true);
  });
  it("rechaza un email distinto", () => {
    expect(isDeleteConfirmed("ana@mail.co", "ana@mail.com")).toBe(false);
    expect(isDeleteConfirmed("", "ana@mail.com")).toBe(false);
  });
});
