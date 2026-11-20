import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRowMenu } from "@/app/(admin)/admin/users/user-row-menu";
import type { AdminUserRow } from "@/db/admin-users";

const { resendUserVerificationAction, unbanUserAction, revokeUserSessionsAction, notify } = vi.hoisted(
  () => ({
    resendUserVerificationAction: vi.fn(),
    unbanUserAction: vi.fn(),
    revokeUserSessionsAction: vi.fn(),
    notify: vi.fn(),
  }),
);
vi.mock("@/actions/admin/users", () => ({
  resendUserVerificationAction,
  unbanUserAction,
  revokeUserSessionsAction,
  banUserAction: vi.fn(),
}));
vi.mock("@/components/admin/toast", () => ({ notify }));

const lector: AdminUserRow = {
  id: "u1",
  name: "Lola",
  email: "lola@mail.com",
  image: null,
  role: "lector",
  status: "activo",
  bannedAt: null,
  banReason: null,
  bannedByName: null,
  methods: ["credential"],
  lastActiveAt: null,
  sessions: 2,
  posts: 0,
  comments: 0,
  ratings: 0,
  votes: 0,
  createdAt: new Date("2026-01-01"),
};

async function open(user: AdminUserRow, isSelf = false) {
  const ui = userEvent.setup();
  render(<UserRowMenu user={user} isSelf={isSelf} />);
  await ui.click(screen.getByRole("button", { name: `Más acciones: ${user.name}` }));
  return ui;
}
const names = () => screen.getAllByRole("menuitem").map((e) => e.firstChild?.textContent);
const item = (name: string) => screen.getByRole("menuitem", { name: new RegExp(`^${name}`) });

describe("UserRowMenu", () => {
  beforeEach(() => {
    resendUserVerificationAction.mockReset().mockResolvedValue({ status: "success", message: "ok" });
    unbanUserAction.mockReset().mockResolvedValue({ status: "success", message: "desbloqueado" });
    revokeUserSessionsAction.mockReset().mockResolvedValue({ status: "success", message: "cerradas" });
    notify.mockReset();
  });

  it("un lector activo ve Bloquear, Cerrar sesiones y Borrar cuenta, todos habilitados", async () => {
    await open(lector);
    expect(names()).toEqual(["Bloquear", "Cerrar sesiones", "Borrar cuenta"]);
    for (const e of screen.getAllByRole("menuitem")) expect(e).not.toHaveAttribute("aria-disabled");
  });

  it("un admin tiene Bloquear y Borrar cuenta deshabilitados con su motivo", async () => {
    await open({ ...lector, role: "admin", name: "Ana" });
    expect(item("Bloquear")).toHaveAttribute("aria-disabled", "true");
    expect(item("Bloquear")).toHaveAccessibleDescription("Los administradores no se pueden bloquear.");
    expect(item("Borrar cuenta")).toHaveAttribute("aria-disabled", "true");
    expect(item("Borrar cuenta")).toHaveAccessibleDescription("Los administradores no se pueden borrar.");
  });

  it("el admin que mira no puede cerrar su propia sesión desde el menú", async () => {
    await open({ ...lector, role: "admin", name: "Ana" }, true);
    expect(item("Cerrar sesiones")).toHaveAttribute("aria-disabled", "true");
    expect(item("Cerrar sesiones")).toHaveAccessibleDescription("Para cerrar tu sesión usá «Cerrar sesión».");
  });

  it("sin sesiones abiertas, Cerrar sesiones queda deshabilitado", async () => {
    await open({ ...lector, sessions: 0 });
    expect(item("Cerrar sesiones")).toHaveAccessibleDescription("No tiene sesiones abiertas.");
  });

  it("un autor no se puede borrar y el motivo dice cuántos artículos tiene", async () => {
    await open({ ...lector, posts: 3 });
    expect(item("Borrar cuenta")).toHaveAttribute("aria-disabled", "true");
    expect(item("Borrar cuenta")).toHaveAccessibleDescription("Es autor de 3 artículos: no se puede borrar.");
  });

  it("un bloqueado muestra Desbloquear en lugar de Bloquear", async () => {
    await open({ ...lector, status: "bloqueado", bannedAt: new Date() });
    expect(names()).toEqual(["Desbloquear", "Cerrar sesiones", "Borrar cuenta"]);
  });

  it("Reenviar verificación solo aparece para un sin verificar no bloqueado", async () => {
    await open({ ...lector, status: "sin-verificar" });
    expect(names()).toContain("Reenviar verificación");
  });

  it("no ofrece Reenviar verificación a activos ni a bloqueados", async () => {
    await open(lector);
    expect(names()).not.toContain("Reenviar verificación");
  });

  it("un bloqueado sin verificar no ofrece Reenviar verificación", async () => {
    await open({ ...lector, status: "bloqueado", bannedAt: new Date() });
    expect(names()).not.toContain("Reenviar verificación");
  });

  it("Reenviar verificación llama a la action con el id y muestra el aviso", async () => {
    const ui = await open({ ...lector, status: "sin-verificar" });
    await ui.click(item("Reenviar verificación"));
    expect(resendUserVerificationAction).toHaveBeenCalledOnce();
    const data: FormData = resendUserVerificationAction.mock.calls[0][1];
    expect(data.get("id")).toBe("u1");
    expect(notify).toHaveBeenCalledWith({ status: "success", message: "ok" });
  });

  it("un ítem deshabilitado no hace nada al hacer clic", async () => {
    const ui = await open({ ...lector, role: "admin" });
    await ui.click(item("Bloquear"));
    expect(screen.getByRole("menu")).toBeInTheDocument(); // sigue abierto
  });

  it("Bloquear abre el diálogo con el motivo", async () => {
    const ui = await open(lector);
    await ui.click(item("Bloquear"));
    expect(await screen.findByRole("heading", { name: "Bloquear a Lola" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Motivo/ })).toBeInTheDocument();
  });

  it("Desbloquear pide confirmar con la fecha, quién bloqueó y el motivo", async () => {
    const ui = await open({
      ...lector,
      status: "bloqueado",
      bannedAt: new Date("2026-03-05T12:00:00Z"),
      banReason: "spam",
      bannedByName: "Ana",
    });
    await ui.click(item("Desbloquear"));
    const dialog = await screen.findByRole("dialog", { name: "¿Desbloquear a Lola?" });
    expect(dialog).toHaveAccessibleDescription(
      "Bloqueado el 5 de marzo de 2026 por Ana. Motivo: «spam». Va a poder volver a iniciar sesión.",
    );
    await ui.click(screen.getByRole("button", { name: "Desbloquear" }));
    expect(unbanUserAction).toHaveBeenCalledOnce();
    expect((unbanUserAction.mock.calls[0][1] as FormData).get("id")).toBe("u1");
  });

  it("Desbloquear sin admin guardado dice «un administrador»", async () => {
    const ui = await open({
      ...lector,
      status: "bloqueado",
      bannedAt: new Date("2026-03-05T12:00:00Z"),
      banReason: "spam",
      bannedByName: null,
    });
    await ui.click(item("Desbloquear"));
    expect(await screen.findByRole("dialog", { name: "¿Desbloquear a Lola?" })).toHaveAccessibleDescription(
      /por un administrador\./,
    );
  });

  it("Cerrar sesiones pide confirmar con la cantidad y llama a la action", async () => {
    const ui = await open(lector);
    await ui.click(item("Cerrar sesiones"));
    const dialog = await screen.findByRole("dialog", { name: "¿Cerrar las sesiones de Lola?" });
    expect(dialog).toHaveAccessibleDescription("Se cierran sus 2 sesiones abiertas. Puede volver a iniciar sesión.");
    await ui.click(screen.getByRole("button", { name: "Cerrar sesiones" }));
    expect(revokeUserSessionsAction).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: /Más acciones/ })).toBeInTheDocument();
  });

  it("Cancelar en el diálogo de confirmación no llama a la action", async () => {
    const ui = await open(lector);
    await ui.click(item("Cerrar sesiones"));
    await ui.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(revokeUserSessionsAction).not.toHaveBeenCalled();
  });
});
