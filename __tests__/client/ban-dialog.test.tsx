import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BanDialog } from "@/app/(admin)/admin/users/ban-dialog";
import type { AdminUserRow } from "@/db/admin-users";

const { banUserAction, notify } = vi.hoisted(() => ({ banUserAction: vi.fn(), notify: vi.fn() }));
vi.mock("@/actions/admin/users", () => ({ banUserAction }));
vi.mock("@/components/admin/toast", () => ({ notify }));

const lector = {
  id: "u1",
  name: "Lola",
  sessions: 2,
} as AdminUserRow;

const motivo = () => screen.getByRole("textbox", { name: /Motivo/ });
const bloquear = () => screen.getByRole("button", { name: "Bloquear" });

beforeEach(() => {
  banUserAction.mockReset();
  notify.mockReset();
});

describe("BanDialog", () => {
  it("explica qué pasa e incluye las sesiones abiertas", () => {
    render(<BanDialog user={lector} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Bloquear a Lola" })).toBeInTheDocument();
    expect(
      screen.getByText("No va a poder iniciar sesión y se cierran sus 2 sesiones abiertas. Sus comentarios siguen publicados."),
    ).toBeInTheDocument();
  });

  it("sin sesiones abiertas no las menciona", () => {
    render(<BanDialog user={{ ...lector, sessions: 0 }} onClose={() => {}} />);
    expect(
      screen.getByText("No va a poder iniciar sesión. Sus comentarios siguen publicados."),
    ).toBeInTheDocument();
  });

  it("con el motivo vacío muestra el error, enfoca el campo y no llama a la action", async () => {
    const user = userEvent.setup();
    render(<BanDialog user={lector} onClose={() => {}} />);
    await user.type(motivo(), "   ");
    await user.click(bloquear());

    expect(await screen.findByText("Escribí el motivo del bloqueo.")).toBeInTheDocument();
    expect(motivo()).toHaveFocus();
    expect(motivo()).toHaveAttribute("aria-invalid", "true");
    expect(motivo()).toHaveAccessibleDescription(/Escribí el motivo del bloqueo\./);
    expect(banUserAction).not.toHaveBeenCalled();
  });

  it("con más de 300 caracteres avisa y no llama a la action", async () => {
    const user = userEvent.setup();
    render(<BanDialog user={lector} onClose={() => {}} />);
    await user.click(motivo());
    await user.paste("a".repeat(301));
    expect(screen.getByText("301/300")).toBeInTheDocument();
    await user.click(bloquear());
    expect(await screen.findByText("El motivo puede tener hasta 300 caracteres.")).toBeInTheDocument();
    expect(banUserAction).not.toHaveBeenCalled();
  });

  it("envía id y motivo, avisa y cierra al terminar", async () => {
    banUserAction.mockResolvedValue({ status: "success", message: "Lola quedó bloqueado." });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BanDialog user={lector} onClose={onClose} />);
    await user.type(motivo(), "  spam  ");
    await user.click(bloquear());

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    const data: FormData = banUserAction.mock.calls[0][1];
    expect(data.get("id")).toBe("u1");
    expect(data.get("reason")).toBe("  spam  "); // el servidor recorta
    expect(notify).toHaveBeenCalledWith({ status: "success", message: "Lola quedó bloqueado." });
  });

  it("si la action falla con un mensaje general, lo muestra y deja el diálogo abierto", async () => {
    banUserAction.mockResolvedValue({ status: "error", message: "Ese usuario ya no existe." });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BanDialog user={lector} onClose={onClose} />);
    await user.type(motivo(), "spam");
    await user.click(bloquear());

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Cancelar cierra sin llamar a la action", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BanDialog user={lector} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(banUserAction).not.toHaveBeenCalled();
  });
});
