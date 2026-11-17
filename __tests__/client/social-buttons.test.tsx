import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SocialButtons } from "@/components/auth/social-buttons";

const { signInSocialAction } = vi.hoisted(() => ({ signInSocialAction: vi.fn() }));

vi.mock("@/actions/cuenta", () => ({ signInSocialAction }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("volver=/blog/senales-sistema-a-medida"),
}));

describe("SocialButtons", () => {
  beforeEach(() => signInSocialAction.mockReset());

  it("sin proveedores no renderiza nada, ni el separador", () => {
    const { container } = render(<SocialButtons providers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("con uno muestra su botón y el separador", () => {
    render(<SocialButtons providers={["github"]} />);
    expect(screen.getByRole("button", { name: "Continuar con GitHub" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Google|Microsoft/ })).not.toBeInTheDocument();
    expect(screen.getByRole("separator")).toHaveTextContent("o con tu email");
  });

  it("con tres los muestra en el orden recibido", () => {
    render(<SocialButtons providers={["google", "github", "microsoft"]} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Continuar con Google",
      "Continuar con GitHub",
      "Continuar con Microsoft",
    ]);
  });

  it("envía el proveedor elegido y el volver a la action", async () => {
    signInSocialAction.mockResolvedValue({ status: "idle" });
    render(<SocialButtons providers={["google", "github"]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Continuar con GitHub" }));

    const data: FormData = signInSocialAction.mock.calls[0][1];
    expect(data.get("provider")).toBe("github");
    expect(data.get("volver")).toBe("/blog/senales-sistema-a-medida");
  });

  it("mientras envía deshabilita todos los botones y marca aria-busy el elegido", async () => {
    let finish!: () => void;
    signInSocialAction.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ status: "idle" });
      }),
    );
    render(<SocialButtons providers={["google", "github"]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Continuar con Google" }));

    const google = screen.getByRole("button", { name: "Continuar con Google" });
    const github = screen.getByRole("button", { name: "Continuar con GitHub" });
    expect(google).toBeDisabled();
    expect(github).toBeDisabled();
    expect(google).toHaveAttribute("aria-busy", "true");
    expect(github).toHaveAttribute("aria-busy", "false");
    finish();
    await waitFor(() => expect(google).toBeEnabled());
  });

  it("muestra el error de la action con role=alert", async () => {
    signInSocialAction.mockResolvedValue({
      status: "error",
      message: "Demasiados intentos. Probá de nuevo en un minuto.",
    });
    render(<SocialButtons providers={["github"]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Continuar con GitHub" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos");
  });
});
