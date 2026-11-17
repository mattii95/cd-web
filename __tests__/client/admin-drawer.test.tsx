import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminDrawer } from "@/components/admin/admin-drawer";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

const setup = async () => {
  const user = userEvent.setup();
  render(<AdminDrawer />);
  const trigger = screen.getByRole("button", { name: "Abrir menú" });
  await user.click(trigger);
  return { user, trigger };
};

describe("AdminDrawer", () => {
  it("empieza cerrado", () => {
    render(<AdminDrawer />);
    const trigger = screen.getByRole("button", { name: "Abrir menú" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre, enfoca el botón de cerrar y bloquea el scroll del body", async () => {
    const { trigger } = await setup();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("Escape cierra y devuelve el foco a Abrir menú", async () => {
    const { user, trigger } = await setup();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("Tab desde el último elemento vuelve al primero", async () => {
    const { user } = await setup();
    screen.getByRole("link", { name: "Usuarios" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveFocus();
  });

  it("Shift+Tab desde el primero va al último", async () => {
    const { user } = await setup();
    await user.tab({ shift: true });
    expect(screen.getByRole("link", { name: "Usuarios" })).toHaveFocus();
  });

  it("elegir un ítem cierra el panel", async () => {
    const { user } = await setup();
    await user.click(screen.getByRole("link", { name: "Medios" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
