import { beforeEach, describe, expect, it, vi } from "vitest";

const { api, verifyTurnstile } = vi.hoisted(() => ({
  api: {
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    sendVerificationEmail: vi.fn(),
  },
  verifyTurnstile: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/auth", () => ({ getAuth: () => ({ api }) }));
vi.mock("@/lib/auth/rate-limit", () => ({ isRateLimited: async () => false }));
vi.mock("@/lib/security/turnstile", () => ({ verifyTurnstile }));

import {
  requestResetAction,
  resendVerificationAction,
  signInAction,
  signUpAction,
} from "@/actions/cuenta";

const MENSAJE = "No pudimos verificar que no sos un bot. Probá de nuevo.";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const valid = {
  name: "Ana",
  email: "a@a.com",
  password: "secreta123",
  "cf-turnstile-response": "tok",
};

describe("captcha en las actions de cuenta", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    verifyTurnstile.mockReset().mockResolvedValue(false);
  });

  it.each([
    ["signInAction", signInAction],
    ["signUpAction", signUpAction],
    ["requestResetAction", requestResetAction],
    ["resendVerificationAction", resendVerificationAction],
  ])("%s devuelve el mensaje y no llama a auth.api si falla", async (_, action) => {
    expect(await action({ status: "idle" }, form(valid))).toEqual({
      status: "error",
      message: MENSAJE,
    });
    Object.values(api).forEach((f) => expect(f).not.toHaveBeenCalled());
  });

  it("manda a Cloudflare el token del formulario", async () => {
    await signUpAction({ status: "idle" }, form(valid));
    expect(verifyTurnstile).toHaveBeenCalledWith("tok", "local");
  });

  it("con captcha válido sigue al flujo normal", async () => {
    verifyTurnstile.mockResolvedValue(true);
    api.signUpEmail.mockResolvedValue({});
    await signUpAction({ status: "idle" }, form(valid));
    expect(api.signUpEmail).toHaveBeenCalledTimes(1);
  });
});
