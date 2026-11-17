import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  resolveLimit,
} from "@/lib/pagination";

const ID = "0b5f3c1e-8a6d-4f3e-9a52-3c1d2b4e5f60";
const raw = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

describe("encodeCursor / decodeCursor", () => {
  it("decodeCursor(encodeCursor(x)) devuelve x", () => {
    const data = { t: "2026-11-16 10:00:00.123456", id: ID };
    expect(decodeCursor(encodeCursor(data))).toEqual(data);
  });

  it("acepta fechas sin decimales", () => {
    const data = { t: "2026-11-16 10:00:00", id: ID };
    expect(decodeCursor(encodeCursor(data))).toEqual(data);
  });

  it("lanza InvalidCursorError con base64 o JSON inválido", () => {
    expect(() => decodeCursor("abc")).toThrow(InvalidCursorError);
    expect(() => decodeCursor("")).toThrow(InvalidCursorError);
  });

  it("lanza InvalidCursorError con un JSON sin id", () => {
    expect(() => decodeCursor(raw({ t: "2026-11-16 10:00:00" }))).toThrow(
      InvalidCursorError,
    );
  });

  it("lanza InvalidCursorError con un id que no es UUID", () => {
    expect(() =>
      decodeCursor(raw({ t: "2026-11-16 10:00:00", id: "123" })),
    ).toThrow(InvalidCursorError);
  });

  it("lanza InvalidCursorError con un t que no es fecha", () => {
    expect(() => decodeCursor(raw({ t: "ayer", id: ID }))).toThrow(
      InvalidCursorError,
    );
    expect(() =>
      decodeCursor(raw({ t: "2026-11-16 10:00:00.1234567", id: ID })),
    ).toThrow(InvalidCursorError);
  });

  it("lanza InvalidCursorError con campos de más", () => {
    expect(() =>
      decodeCursor(raw({ t: "2026-11-16 10:00:00", id: ID, extra: 1 })),
    ).toThrow(InvalidCursorError);
  });
});

describe("resolveLimit", () => {
  it("devuelve el default si limit es undefined", () => {
    expect(resolveLimit(undefined, 24)).toBe(24);
  });

  it("recorta a 1–100", () => {
    expect(resolveLimit(0, 24)).toBe(1);
    expect(resolveLimit(-5, 24)).toBe(1);
    expect(resolveLimit(500, 24)).toBe(100);
    expect(resolveLimit(10, 24)).toBe(10);
  });
});
