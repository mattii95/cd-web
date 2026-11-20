import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommentCard } from "@/app/(admin)/admin/comments/comment-card";
import type { AdminCommentRow } from "@/db/admin-comments";

const { deleteAction } = vi.hoisted(() => ({ deleteAction: vi.fn() }));
vi.mock("@/actions/admin/comments", () => ({ deleteCommentAsAdminAction: deleteAction }));

const row = (extra: Partial<AdminCommentRow> = {}): AdminCommentRow => ({
  id: "c1",
  text: "Muy útil, gracias.",
  status: "pendiente",
  createdAt: new Date("2026-11-10T12:00:00Z"),
  usefulCount: 0,
  reply: null,
  author: { id: "u1", name: "Lía Lectora", email: "lia@demo.invalid", image: null },
  post: { id: "p1", title: "Señales de un sistema a medida", slug: "senales", published: true },
  ...extra,
});

const setup = (extra: Partial<AdminCommentRow> = {}, onSetStatus = vi.fn()) => {
  render(
    <CommentCard comment={row(extra)} selected={false} onSelect={vi.fn()} onSetStatus={onSetStatus} />,
  );
  return { onSetStatus };
};
// Solo los botones de moderación: el del menú "Más acciones" no tiene texto.
const names = () =>
  screen
    .queryAllByRole("button")
    .map((b) => b.textContent)
    .filter((t) => t === "Aprobar" || t === "Ocultar");

describe("CommentCard: botones por estado", () => {
  it("un pendiente muestra Aprobar y Ocultar", () => {
    setup({ status: "pendiente" });
    expect(names()).toEqual(["Aprobar", "Ocultar"]);
  });

  it("un aprobado muestra solo Ocultar", () => {
    setup({ status: "aprobado" });
    expect(names()).toEqual(["Ocultar"]);
  });

  it("un oculto muestra solo Aprobar", () => {
    setup({ status: "oculto" });
    expect(names()).toEqual(["Aprobar"]);
  });

  it("los botones avisan con el estado elegido", async () => {
    const { onSetStatus } = setup({ status: "pendiente" });
    await userEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await userEvent.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(onSetStatus).toHaveBeenNthCalledWith(1, "aprobado");
    expect(onSetStatus).toHaveBeenNthCalledWith(2, "oculto");
  });
});

describe("CommentCard: contenido", () => {
  it("un artículo publicado lleva un enlace a /blog/{slug}#valoraciones", () => {
    setup();
    const link = screen.getByRole("link", { name: "Señales de un sistema a medida" });
    expect(link).toHaveAttribute("href", "/blog/senales#valoraciones");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
    expect(screen.queryByText("Artículo no publicado")).not.toBeInTheDocument();
  });

  it("un artículo no publicado muestra la etiqueta y el título sin enlace", () => {
    setup({ post: { id: "p1", title: "Borrador", slug: "borrador", published: false } });
    expect(screen.getByText("Artículo no publicado")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("muestra la respuesta del autor solo si hay", () => {
    const { unmount } = render(
      <CommentCard comment={row()} selected={false} onSelect={vi.fn()} onSetStatus={vi.fn()} />,
    );
    expect(screen.queryByText("Respuesta del autor")).not.toBeInTheDocument();
    unmount();
    setup({ reply: { text: "Gracias por leer", repliedAt: new Date("2026-11-12T12:00:00Z") } });
    expect(screen.getByText("Respuesta del autor")).toBeInTheDocument();
    expect(screen.getByText("Gracias por leer")).toBeInTheDocument();
  });

  it("muestra 'Útil · N' solo si N > 0", () => {
    const { unmount } = render(
      <CommentCard comment={row()} selected={false} onSelect={vi.fn()} onSetStatus={vi.fn()} />,
    );
    expect(screen.queryByText(/Útil/)).not.toBeInTheDocument();
    unmount();
    setup({ usefulCount: 3 });
    expect(screen.getByText("Útil · 3")).toBeInTheDocument();
  });

  it("muestra el texto como texto plano, sin interpretar HTML", () => {
    setup({ text: "<b>hola</b>\nsegunda línea" });
    const p = screen.getByText(/segunda línea/);
    expect(p.textContent).toBe("<b>hola</b>\nsegunda línea");
    expect(p.querySelector("b")).toBeNull();
    expect(p.className).toContain("whitespace-pre-line");
  });

  it("tiene el checkbox con el nombre del autor", () => {
    setup();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar el comentario de Lía Lectora" }),
    ).toBeInTheDocument();
  });
});

describe("CommentCard: menú y borrar", () => {
  const openMenu = () =>
    userEvent.click(screen.getByRole("button", { name: "Más acciones: Lía Lectora" }));
  const openDelete = async () => {
    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Borrar" }));
  };

  it("el menú tiene 'Ver usuario' hacia /admin/users?q={email} y 'Borrar'", async () => {
    setup();
    await openMenu();
    expect(screen.getByRole("menuitem", { name: "Ver usuario" })).toHaveAttribute(
      "href",
      "/admin/users?q=lia%40demo.invalid",
    );
    expect(screen.getByRole("menuitem", { name: "Borrar" })).toBeInTheDocument();
  });

  it("Borrar abre la confirmación con la cantidad de votos y no llama a la action hasta confirmar", async () => {
    deleteAction.mockReset();
    deleteAction.mockResolvedValue({ status: "success", message: "Comentario borrado." });
    setup({
      usefulCount: 3,
      reply: { text: "Gracias", repliedAt: new Date("2026-11-12T12:00:00Z") },
    });
    await openDelete();
    expect(
      screen.getByRole("heading", { name: "¿Borrar el comentario de Lía Lectora?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Se borran el comentario, su respuesta y sus 3 votos. No se puede deshacer."),
    ).toBeInTheDocument();
    expect(deleteAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(deleteAction).toHaveBeenCalledTimes(1);
    expect((deleteAction.mock.calls[0][1] as FormData).get("id")).toBe("c1");
  });

  it("sin votos ni respuesta, la confirmación solo nombra el comentario", async () => {
    setup();
    await openDelete();
    expect(screen.getByText("Se borra el comentario. No se puede deshacer.")).toBeInTheDocument();
  });

  it("sin votos y con respuesta: 'el comentario y su respuesta'", async () => {
    setup({ reply: { text: "Gracias", repliedAt: new Date("2026-11-12T12:00:00Z") } });
    await openDelete();
    expect(
      screen.getByText("Se borran el comentario y su respuesta. No se puede deshacer."),
    ).toBeInTheDocument();
  });

  it("Cancelar no llama a la action", async () => {
    deleteAction.mockReset();
    setup();
    await openDelete();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteAction).not.toHaveBeenCalled();
  });
});
