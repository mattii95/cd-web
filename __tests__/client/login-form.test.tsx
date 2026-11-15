import { render, screen } from "@testing-library/react";
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

  it("envía email, contraseña, rememberMe y volver a la action", async () => {
    signInAction.mockResolvedValue({ status: "idle" });
    await fillAndSubmit();

    const data: FormData = signInAction.mock.calls[0][1];
    expect(data.get("email")).toBe("tu@email.com");
    expect(data.get("password")).toBe("secreta123");
    expect(data.get("rememberMe")).toBe("on");
    expect(data.get("volver")).toBe("/admin");
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
