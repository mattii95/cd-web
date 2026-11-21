import { describe, expect, it } from "vitest";
import {
  bucketKeys,
  bucketLabel,
  dashboardHref,
  dashboardRange,
  parseDashboardParams,
  percentChange,
} from "@/lib/admin/dashboard-params";

describe("parseDashboardParams", () => {
  it("sin params devuelve 30", () => {
    expect(parseDashboardParams({})).toEqual({ periodo: 30 });
  });

  it("respeta 7 y 90", () => {
    expect(parseDashboardParams({ periodo: "7" }).periodo).toBe(7);
    expect(parseDashboardParams({ periodo: "90" }).periodo).toBe(90);
  });

  it("valores inválidos caen a 30", () => {
    expect(parseDashboardParams({ periodo: "15" }).periodo).toBe(30);
    expect(parseDashboardParams({ periodo: "abc" }).periodo).toBe(30);
    expect(parseDashboardParams({ periodo: ["7", "90"] }).periodo).toBe(30);
  });
});

describe("dashboardHref", () => {
  it("omite el período por defecto", () => {
    expect(dashboardHref({ periodo: 30 })).toBe("/admin");
    expect(dashboardHref({ periodo: 7 })).toBe("/admin?periodo=7");
  });
});

describe("dashboardRange", () => {
  it("7 días: desde las 00:00 de Buenos Aires", () => {
    const r = dashboardRange(7, new Date("2026-11-21T15:00:00Z"));
    expect(r.from.toISOString()).toBe("2026-11-15T03:00:00.000Z");
    expect(r.prevFrom.toISOString()).toBe("2026-11-08T03:00:00.000Z");
    expect(r.bucket).toBe("day");
  });

  it("a las 22:00 de Buenos Aires el último día sigue siendo el 20/11", () => {
    const r = dashboardRange(30, new Date("2026-11-21T01:00:00Z"));
    expect(bucketKeys(r).at(-1)).toBe("2026-11-20");
  });
});

describe("bucketKeys", () => {
  const now = new Date("2026-11-21T15:00:00Z");

  it("una clave por día con 7 y 30", () => {
    expect(bucketKeys(dashboardRange(7, now))).toHaveLength(7);
    expect(bucketKeys(dashboardRange(30, now))).toHaveLength(30);
  });

  it("con 90, una clave por lunes y la primera ≤ from", () => {
    const r = dashboardRange(90, now);
    const keys = bucketKeys(r);
    expect(r.bucket).toBe("week");
    expect(keys.every((k) => new Date(`${k}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
    expect(Date.parse(`${keys[0]}T03:00:00Z`)).toBeLessThanOrEqual(r.from.getTime());
    expect(keys.at(-1)).toBe("2026-11-16");
  });
});

describe("bucketLabel", () => {
  it("formatea día y semana", () => {
    expect(bucketLabel("2026-11-21", "day")).toBe("21 nov");
    expect(bucketLabel("2026-11-17", "week")).toBe("Sem. 17 nov");
  });
});

describe("percentChange", () => {
  it("sube, baja, igual y nuevo", () => {
    expect(percentChange(12, 10)).toEqual({ kind: "up", pct: 20 });
    expect(percentChange(5, 10)).toEqual({ kind: "down", pct: 50 });
    expect(percentChange(3, 3)).toEqual({ kind: "same" });
    expect(percentChange(0, 0)).toEqual({ kind: "same" });
    expect(percentChange(4, 0)).toEqual({ kind: "new" });
  });
});
