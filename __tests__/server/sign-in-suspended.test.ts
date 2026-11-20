import { describe, expect, it, vi } from "vitest";
import { APIError } from "better-auth/api";

// Función plana, no vi.fn: vitest marca como falla un vi.fn que lanzó, aunque el código lo capture.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/auth", () => ({
  getAuth: () => ({
    api: {
      signInEmail: async () => {
        throw new APIError("FORBIDDEN", { code: "ACCOUNT_SUSPENDED", message: "ACCOUNT_SUSPENDED" });
      },
    },
  }),
}));
vi.mock("@/lib/auth/rate-limit", () => ({ isRateLimited: async () => false }));

import { signInAction } from "@/actions/cuenta";
import { SUSPENDED_MESSAGE } from "@/lib/auth/messages";

describe("signInAction con cuenta suspendida", () => {
  it("devuelve el mensaje de cuenta suspendida", async () => {
    const data = new FormData();
    data.set("email", "a@a.com");
    data.set("password", "secreta123");
    expect(await signInAction({ status: "idle" }, data)).toEqual({
      status: "error",
      message: "Tu cuenta está suspendida. Escribinos a courrouxdigital@gmail.com.",
    });
    expect(SUSPENDED_MESSAGE).toContain("suspendida");
  });
});
