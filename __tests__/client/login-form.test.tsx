import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

const { signInAction } = vi.hoisted(() => ({ signInAction: vi.fn() }));

vi.mock("@/app/cuenta/actions", () => ({ signInAction }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("volver=/admin"),
}));

async function fillAndSubmit() {
  const user = userEvent.setup();
  render(<LoginForm />);
  await user.type(screen.getByLabelText("Email"), "tu@email.com");
  await user.type(
    screen.getByLabelText("Contraseña", { selector: "input" }),
    "secreta123",
  );
  await user.click(screen.getByLabelText("Recordarme"));
  await user.click(screen.getByRole("button", { name: "Ingresar" }));
}

describe("LoginForm", () => {
  beforeEach(() => signInAction.mockReset());

  it("no ofrece Google ni avisa que las cuentas no están disponibles", () => {
    render(<LoginForm />);
    expect(screen.queryByText(/Google/)).not.toBeInTheDocument();
    expect(screen.queryByText(/todavía no están disponibles/)).not.toBeInTheDocument();
  });

  it("monta el slot social fuera del form de email", () => {
    render(<LoginForm social={<p>botones sociales</p>} />);
    const social = screen.getByText("botones sociales");
    expect(social.closest("form")).toBeNull();
    expect(screen.getByRole("button", { name: "Ingresar" }).closest("form")).not.toBeNull();
  });

  it("envía email, contraseña, rememberMe y volver a la action", async () => {
    signInAction.mockResolvedValue({ status: "idle" });
    await fillAndSubmit();

    const data: FormData = signInAction.mock.calls[0][1];
    expect(data.get("email")).toBe("tu@email.com");
    expect(data.get("password")).toBe("secreta123");
    expect(data.get("rememberMe")).toBe("on");
    expect(data.get("volver")).toBe("/admin");
  });

  it("mientras envía, el botón queda deshabilitado y aria-busy", async () => {
    let finish!: () => void;
    signInAction.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ status: "idle" });
      }),
    );
    await fillAndSubmit();

    const button = screen.getByRole("button", { name: "Ingresar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    finish();
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("muestra el error de la action con role=alert", async () => {
    signInAction.mockResolvedValue({
      status: "error",
      message: "El email o la contraseña no son correctos.",
    });
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El email o la contraseña no son correctos.",
    );
  });
});
