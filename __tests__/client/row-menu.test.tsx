import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RowMenu } from "@/app/(admin)/admin/articles/row-menu";

const { publishPostAction, unpublishPostAction, deletePostAction } = vi.hoisted(() => ({
  publishPostAction: vi.fn(),
  unpublishPostAction: vi.fn(),
  deletePostAction: vi.fn(),
}));
vi.mock("@/actions/admin/articles", () => ({
  publishPostAction,
  unpublishPostAction,
  deletePostAction,
}));
vi.mock("@/components/admin/toast", () => ({ notify: vi.fn() }));

const ok = { status: "success", message: "ok" };
const draft = { id: "id-1", slug: "mi-post", title: "Mi post", status: "borrador" } as const;
const published = { ...draft, status: "publicado" } as const;

const openMenu = async (props: typeof draft | typeof published) => {
  const user = userEvent.setup();
  render(<RowMenu {...props} />);
  await user.click(screen.getByRole("button", { name: "Más acciones: Mi post" }));
  return user;
};
const items = () => screen.getAllByRole("menuitem").map((e) => e.textContent?.trim());

describe("RowMenu", () => {
  beforeEach(() => {
    publishPostAction.mockReset().mockResolvedValue(ok);
    unpublishPostAction.mockReset().mockResolvedValue(ok);
    deletePostAction.mockReset().mockResolvedValue(ok);
  });

  it("un borrador muestra Publicar y Eliminar", async () => {
    await openMenu(draft);
    expect(items()).toEqual(["Editar", "Publicar", "Eliminar"]);
  });

  it("un publicado muestra Ver en el blog, Pasar a borrador y Eliminar", async () => {
    await openMenu(published);
    expect(items()).toEqual(["Editar", "Ver en el blog", "Pasar a borrador", "Eliminar"]);
    const link = screen.getByRole("menuitem", { name: "Ver en el blog" });
    expect(link).toHaveAttribute("href", "/blog/mi-post");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  it.each([["borrador", draft], ["publicado", published]] as const)(
    "un %s muestra Editar primero, con enlace al editor",
    async (_, props) => {
      await openMenu(props);
      expect(items()[0]).toBe("Editar");
      expect(screen.getByRole("menuitem", { name: "Editar" })).toHaveAttribute("href", "/admin/articles/id-1/edit");
    },
  );

  it("el botón expone aria-expanded y Escape cierra el menú", async () => {
    const user = await openMenu(draft);
    const trigger = screen.getByRole("button", { name: "Más acciones: Mi post" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Eliminar abre el modal con el título y no llama a la action hasta confirmar", async () => {
    const user = await openMenu(published);
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    const dialog = screen.getByRole("dialog", { name: "¿Eliminar el artículo?" });
    expect(dialog).toHaveTextContent("«Mi post»");
    expect(deletePostAction).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(deletePostAction).toHaveBeenCalledTimes(1));
    expect(deletePostAction.mock.calls[0][1].get("id")).toBe("id-1");
  });

  it("Cancelar en el modal no llama a la action", async () => {
    const user = await openMenu(draft);
    await user.click(screen.getByRole("menuitem", { name: "Publicar" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "¿Publicar el artículo?" })).getByRole("button", {
        name: "Cancelar",
      }),
    );
    expect(publishPostAction).not.toHaveBeenCalled();
  });

  it("Pasar a borrador confirma y llama a unpublishPostAction", async () => {
    const user = await openMenu(published);
    await user.click(screen.getByRole("menuitem", { name: "Pasar a borrador" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Pasar a borrador" }),
    );
    await waitFor(() => expect(unpublishPostAction).toHaveBeenCalledTimes(1));
  });
});
