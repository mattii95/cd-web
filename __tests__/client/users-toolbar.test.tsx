import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UsersToolbar } from "@/app/(admin)/admin/users/users-toolbar";
import type { AdminUserQuery } from "@/lib/admin/user-params";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const base: AdminUserQuery = { q: null, estado: null, rol: null, page: 1 };
const setup = (query: Partial<AdminUserQuery> = {}) =>
  render(<UsersToolbar query={{ ...base, ...query }} />);
const search = () => screen.getByLabelText("Buscar por nombre o email");

describe("UsersToolbar", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("escribir llama a router.replace una sola vez, 300 ms después de la última tecla y sin page", () => {
    setup({ page: 3 });
    fireEvent.change(search(), { target: { value: "an" } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(search(), { target: { value: "ana" } });
    act(() => vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/admin/users?q=ana", { scroll: false });
  });

  it("elegir Bloqueados navega con ?estado=bloqueados y elegir Todos lo quita", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "bloqueados" } });
    expect(replace).toHaveBeenLastCalledWith("/admin/users?estado=bloqueados", { scroll: false });

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "" } });
    expect(replace).toHaveBeenLastCalledWith("/admin/users", { scroll: false });
  });

  it("cambiar un filtro conserva los demás y vuelve a la página 1", () => {
    setup({ q: "ana", estado: "activos", page: 4 });
    fireEvent.change(screen.getByLabelText("Rol"), { target: { value: "admins" } });
    expect(replace).toHaveBeenCalledWith("/admin/users?q=ana&estado=activos&rol=admins", {
      scroll: false,
    });
  });

  it("muestra los valores de la URL en los controles", () => {
    setup({ q: "ana", estado: "sin-verificar", rol: "lectores" });
    expect(search()).toHaveValue("ana");
    expect(screen.getByLabelText("Estado")).toHaveValue("sin-verificar");
    expect(screen.getByLabelText("Rol")).toHaveValue("lectores");
  });

  it("vaciar el campo quita ?q de la URL", () => {
    setup({ q: "ana" });
    fireEvent.change(search(), { target: { value: "" } });
    act(() => vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledWith("/admin/users", { scroll: false });
  });
});
