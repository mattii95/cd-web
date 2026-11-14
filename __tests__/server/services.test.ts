import { describe, expect, it } from "vitest";
import { getService } from "@/lib/services";

describe("getService", () => {
  it("devuelve el servicio cuando el slug existe", () => {
    expect(getService("desarrollo-web")?.slug).toBe("desarrollo-web");
  });

  it("devuelve undefined cuando el slug no existe", () => {
    expect(getService("no-existe")).toBeUndefined();
  });
});
