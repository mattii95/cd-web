import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

const base = {
  title: "¿Eliminar el artículo?",
  description: "No se puede deshacer.",
  confirmLabel: "Eliminar",
  pendingLabel: "Eliminando…",
  pending: false,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("abierto tiene título, descripción y el foco en Cancelar", () => {
    render(<ConfirmDialog {...base} open />);
    const dialog = screen.getByRole("dialog", { name: "¿Eliminar el artículo?" });
    expect(dialog).toHaveAccessibleDescription("No se puede deshacer.");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("cerrado no se ve", () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Cancelar y Escape llaman a onCancel; Confirmar a onConfirm", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} open onCancel={onCancel} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);

    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("con pending deshabilita ambos botones, muestra la espera y Escape no cierra", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open pending onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Eliminando…" })).toBeDisabled();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("el tono danger pinta el botón de confirmar en rojo", () => {
    render(<ConfirmDialog {...base} open tone="danger" />);
    expect(screen.getByRole("button", { name: "Eliminar" }).className).toContain("bg-red-700");
  });
});
