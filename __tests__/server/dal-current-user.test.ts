import { beforeEach, describe, expect, it, vi } from "vitest";

const { headers, getSession } = vi.hoisted(() => ({ headers: vi.fn(), getSession: vi.fn() }));
const getAuth = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/lib/auth/auth", () => ({ getAuth }));

import { getCurrentUser } from "@/lib/auth/dal";

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    headers.mockResolvedValue(new Headers());
    getAuth.mockReturnValue({ api: { getSession } });
  });

  it("devuelve null si la base o Better Auth fallan", async () => {
    getSession.mockRejectedValue(new Error("db caída"));
    expect(await getCurrentUser()).toBeNull();
  });

  it("devuelve null si getAuth() lanza (p. ej. faltan variables)", async () => {
    getAuth.mockImplementation(() => {
      throw new Error("DATABASE_URL falta");
    });
    expect(await getCurrentUser()).toBeNull();
  });

  // Regresión: en el prerender headers() posterga la página. Si el catch lo tragara,
  // el redirect a login quedaría horneado en el HTML estático (/cuenta/perfil, /admin).
  it("no traga lo que lanza headers()", async () => {
    headers.mockRejectedValue(new Error("posterga el prerender"));
    await expect(getCurrentUser()).rejects.toThrow("posterga el prerender");
  });
});
