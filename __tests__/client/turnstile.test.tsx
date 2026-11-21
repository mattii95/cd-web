import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";

const turnstile = {
  render: vi.fn(),
  reset: vi.fn(),
  remove: vi.fn(),
};

const action = vi.fn();

function renderForm() {
  return render(
    <AuthForm
      action={action}
      title="t"
      subtitle="s"
      submitLabel="Enviar"
      footer="f"
      captcha
    >
      <input name="x" />
    </AuthForm>,
  );
}

// Opciones con las que AuthForm montó el widget.
const options = () => turnstile.render.mock.calls[0][1];

describe("AuthForm con captcha", () => {
  beforeEach(() => {
    vi.stubGlobal("turnstile", turnstile);
    window.turnstile = turnstile;
    turnstile.render.mockReset().mockReturnValue("widget-1");
    turnstile.reset.mockReset();
    turnstile.remove.mockReset();
    action.mockReset();
  });

  it("renderiza el widget con site key, tema oscuro, flexible y es", async () => {
    renderForm();
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    expect(options()).toMatchObject({
      sitekey: expect.any(String),
      theme: "dark",
      size: "flexible",
      language: "es",
    });
  });

  it("el botón espera el token y se bloquea otra vez al expirar", async () => {
    renderForm();
    const button = screen.getByRole("button", { name: "Enviar" });
    expect(button).toBeDisabled();
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled());

    act(() => options().callback("tok"));
    expect(button).toBeEnabled();
    act(() => options()["expired-callback"]());
    expect(button).toBeDisabled();
    act(() => options().callback("tok2"));
    act(() => options()["error-callback"]());
    expect(button).toBeDisabled();
  });

  it("resetea el widget cuando la action devuelve error", async () => {
    action.mockResolvedValue({ status: "error", message: "mal" });
    renderForm();
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled());
    act(() => options().callback("tok"));

    await userEvent.setup().click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(turnstile.reset).toHaveBeenCalledWith("widget-1"));
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("resetea el widget también tras un éxito: el token ya se gastó", async () => {
    action.mockResolvedValue({ status: "success", message: "ok" });
    renderForm();
    await waitFor(() => expect(turnstile.render).toHaveBeenCalled());
    act(() => options().callback("tok"));

    await userEvent.setup().click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(turnstile.reset).toHaveBeenCalledWith("widget-1"));
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("sin captcha no monta el widget", () => {
    render(
      <AuthForm action={action} title="t" subtitle="s" submitLabel="Enviar" footer="f">
        <input name="x" />
      </AuthForm>,
    );
    expect(turnstile.render).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
  });
});
