import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteUserDialog } from "@/app/(admin)/admin/users/delete-user-dialog";
import type { AdminUserRow } from "@/db/admin-users";

const { deleteUserAction, notify } = vi.hoisted(() => ({
  deleteUserAction: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/actions/admin/users", () => ({ deleteUserAction }));
vi.mock("@/components/admin/toast", () => ({ notify }));

const lector = {
  id: "u1",
  name: "Lola",
  email: "lola@mail.com",
  comments: 4,
  ratings: 2,
  votes: 7,
} as AdminUserRow;

const confirmar = () => screen.getByRole("textbox", { name: "Escribí lola@mail.com para confirmar" });
const borrar = () => screen.getByRole("button", { name: "Borrar cuenta" });

beforeEach(() => {
  deleteUserAction.mockReset();
  notify.mockReset();
});

describe("DeleteUserDialog", () => {
  it("lista comentarios, puntuaciones y votos, y avisa de las imágenes", () => {
    render(<DeleteUserDialog user={lector} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Borrar la cuenta de Lola" })).toBeInTheDocument();
    expect(screen.getByText("4 comentarios")).toBeInTheDocument();
    expect(screen.getByText("2 puntuaciones")).toBeInTheDocument();
    expect(screen.getByText("7 votos en comentarios")).toBeInTheDocument();
    expect(
      screen.getByText("Las imágenes que subió quedan en Medios. No se puede deshacer."),
    ).toBeInTheDocument();
  });

  it("omite los que valen 0", () => {
    render(<DeleteUserDialog user={{ ...lector, ratings: 0, votes: 0 }} onClose={() => {}} />);
    expect(screen.getByText("4 comentarios")).toBeInTheDocument();
    expect(screen.queryByText(/puntuacion/)).not.toBeInTheDocument();
    expect(screen.queryByText(/votos/)).not.toBeInTheDocument();
  });

  it("con todo en 0 lo dice", () => {
    render(<DeleteUserDialog user={{ ...lector, comments: 0, ratings: 0, votes: 0 }} onClose={() => {}} />);
    expect(screen.getByText("No tiene comentarios ni puntuaciones.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("usa el singular con 1", () => {
    render(<DeleteUserDialog user={{ ...lector, comments: 1, ratings: 1, votes: 1 }} onClose={() => {}} />);
    expect(screen.getByText("1 comentario")).toBeInTheDocument();
    expect(screen.getByText("1 puntuación")).toBeInTheDocument();
    expect(screen.getByText("1 voto en comentarios")).toBeInTheDocument();
  });

  it("Borrar cuenta sigue deshabilitado hasta escribir el email exacto", async () => {
    const user = userEvent.setup();
    render(<DeleteUserDialog user={lector} onClose={() => {}} />);
    expect(borrar()).toBeDisabled();
    await user.type(confirmar(), "lola@mail.co");
    expect(borrar()).toBeDisabled();
    await user.type(confirmar(), "m");
    expect(borrar()).toBeEnabled();
    await user.clear(confirmar());
    await user.type(confirmar(), "  LOLA@Mail.com ");
    expect(borrar()).toBeEnabled();
  });

  it("envía id y email, avisa y cierra al terminar", async () => {
    deleteUserAction.mockResolvedValue({ status: "success", message: "Se borró la cuenta de Lola." });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DeleteUserDialog user={lector} onClose={onClose} />);
    await user.type(confirmar(), "lola@mail.com");
    await user.click(borrar());

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    const data: FormData = deleteUserAction.mock.calls[0][1];
    expect(data.get("id")).toBe("u1");
    expect(data.get("confirmEmail")).toBe("lola@mail.com");
    expect(notify).toHaveBeenCalledWith({ status: "success", message: "Se borró la cuenta de Lola." });
  });

  it("si el servidor dice que no coincide, lo muestra en el campo y no cierra", async () => {
    deleteUserAction.mockResolvedValue({
      status: "error",
      fieldErrors: { confirmEmail: "El email no coincide." },
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DeleteUserDialog user={lector} onClose={onClose} />);
    await user.type(confirmar(), "lola@mail.com");
    await user.click(borrar());

    expect(await screen.findByText("El email no coincide.")).toBeInTheDocument();
    expect(confirmar()).toHaveFocus();
    expect(confirmar()).toHaveAttribute("aria-invalid", "true");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("un error general (por ejemplo, es autor) va al aviso y deja el diálogo abierto", async () => {
    deleteUserAction.mockResolvedValue({ status: "error", message: "No se puede borrar: es autor de 2 artículos." });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<DeleteUserDialog user={lector} onClose={onClose} />);
    await user.type(confirmar(), "lola@mail.com");
    await user.click(borrar());

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
