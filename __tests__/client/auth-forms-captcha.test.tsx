import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import { RecoverForm } from "@/components/auth/recover-form";
import { RegisterForm } from "@/components/auth/register-form";
import { VerifyView } from "@/components/auth/verify-view";

vi.mock("@/actions/cuenta", () => ({
  signInAction: vi.fn(),
  signUpAction: vi.fn(),
  requestResetAction: vi.fn(),
  resendVerificationAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const turnstile = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

describe("formularios de cuenta con Turnstile", () => {
  beforeEach(() => {
    window.turnstile = turnstile;
    turnstile.render.mockReset().mockReturnValue("w");
  });

  it.each([
    ["LoginForm", () => <LoginForm />],
    ["RegisterForm", () => <RegisterForm />],
    ["RecoverForm", () => <RecoverForm />],
    ["VerifyView", () => <VerifyView />],
  ])("%s monta el widget con la site key", async (_, ui) => {
    render(ui());
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    expect(turnstile.render.mock.calls[0][1].sitekey).toBe("1x00000000000000000000AA");
  });
});
