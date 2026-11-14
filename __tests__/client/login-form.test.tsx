import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

describe("LoginForm", () => {
  it("muestra el aviso solo después de enviar un login válido", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "tu@email.com");
    await user.type(
      screen.getByLabelText("Contraseña", { selector: "input" }),
      "secreta123",
    );
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
