import { describe, expect, it } from "vitest";
import { formatAverage, formatPostDate } from "@/lib/blog-posts";

describe("formatAverage", () => {
  it("usa coma decimal y un decimal", () => {
    expect(formatAverage(4.6)).toBe("4,6");
    expect(formatAverage(4)).toBe("4,0");
  });
});

describe("formatPostDate", () => {
  it("formatea en es-AR sin puntos ni 'de'", () => {
    expect(formatPostDate(new Date("2026-03-05"))).toBe("5 mar 2026");
  });

  it("usa UTC: no cambia de día por la zona horaria", () => {
    expect(formatPostDate(new Date("2026-11-16T23:30:00Z"))).toBe(
      "16 nov 2026",
    );
  });
});
