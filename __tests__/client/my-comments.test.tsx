import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserComment } from "@/db/blog-community";

const deleteCommentAction = vi.fn();
const loadMoreUserCommentsAction = vi.fn();
vi.mock("@/actions/blog/comunidad", () => ({
  deleteCommentAction: (...args: unknown[]) => deleteCommentAction(...args),
  loadMoreUserCommentsAction: (...args: unknown[]) =>
    loadMoreUserCommentsAction(...args),
}));

import { MyComments } from "@/components/account/my-comments";

const item = (n: number, over: Partial<UserComment> = {}): UserComment => ({
  id: `c-${n}`,
  text: `Texto ${n}`,
  status: "aprobado",
  createdAt: new Date(Date.UTC(2026, 10, 16)),
  post: { slug: `post-${n}`, title: `Título ${n}`, published: true },
  reply: null,
  ...over,
});

const setup = (items: UserComment[], cursor: string | null = null) =>
  render(<MyComments initialItems={items} initialCursor={cursor} />);

beforeEach(() => {
  deleteCommentAction.mockReset();
  loadMoreUserCommentsAction.mockReset();
});

describe("MyComments", () => {
  it("muestra el badge según el estado de cada comentario", () => {
    setup([
      item(1, { status: "pendiente" }),
      item(2, { status: "aprobado" }),
      item(3, { status: "oculto" }),
    ]);
    const lis = screen.getAllByRole("listitem");
    expect(within(lis[0]).getByText("En revisión")).toBeInTheDocument();
    expect(within(lis[1]).getByText("Publicado")).toBeInTheDocument();
    expect(within(lis[2]).getByText("Oculto")).toBeInTheDocument();
  });

  it("el título de un post publicado enlaza a /blog/<slug>#valoraciones y el de un borrador no", () => {
    setup([
      item(1),
      item(2, {
        post: { slug: "post-2", title: "Título 2", published: false },
      }),
    ]);
    expect(
      screen.getByRole("link", { name: "Título 1" }).getAttribute("href"),
    ).toBe("/blog/post-1#valoraciones");
    expect(screen.getByText("Título 2")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Título 2" })).toBeNull();
  });

  it("muestra el texto completo, la fecha y la respuesta del autor", () => {
    setup([
      item(1, {
        reply: {
          text: "Gracias por leerlo",
          repliedAt: new Date(Date.UTC(2026, 10, 17)),
        },
      }),
    ]);
    expect(screen.getByText("Texto 1")).toBeInTheDocument();
    expect(screen.getByText("16 nov 2026")).toBeInTheDocument();
    expect(screen.getByText("Respuesta del autor")).toBeInTheDocument();
    expect(screen.getByText("Gracias por leerlo")).toBeInTheDocument();
    expect(screen.getByText("17 nov 2026")).toBeInTheDocument();
  });

  it("sin comentarios muestra el mensaje y el enlace al blog", () => {
    setup([]);
    expect(
      screen.getByText("Todavía no comentaste ningún artículo."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir al blog" }).getAttribute("href"),
    ).toBe("/blog");
  });

  it("Borrar pide confirmación inline y Cancelar no borra", () => {
    setup([item(1)]);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(screen.getByText(/¿Borrar comentario\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText(/¿Borrar comentario\?/)).toBeNull();
    expect(deleteCommentAction).not.toHaveBeenCalled();
  });

  it("Sí, borrar quita el comentario de la lista", async () => {
    deleteCommentAction.mockResolvedValue({ status: "success" });
    setup([item(1), item(2)]);
    fireEvent.click(screen.getAllByRole("button", { name: "Borrar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(1),
    );
    expect(deleteCommentAction).toHaveBeenCalledWith("c-1");
    expect(screen.queryByText("Texto 1")).toBeNull();
  });

  it("si falla al borrar muestra el mensaje en un status y deja el comentario", async () => {
    deleteCommentAction.mockResolvedValue({
      status: "error",
      message: "No pudimos borrar el comentario.",
    });
    setup([item(1)]);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    const status = await screen.findByText("No pudimos borrar el comentario.");
    expect(status.getAttribute("role")).toBe("status");
    expect(screen.getByText("Texto 1")).toBeInTheDocument();
  });

  it("borrar el último comentario de la lista muestra el estado vacío", async () => {
    deleteCommentAction.mockResolvedValue({ status: "success" });
    setup([item(1)]);
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    await screen.findByText("Todavía no comentaste ningún artículo.");
  });
});

describe("MyComments · Ver más comentarios", () => {
  it("no se muestra sin cursor", () => {
    setup([item(1)]);
    expect(
      screen.queryByRole("button", { name: "Ver más comentarios" }),
    ).toBeNull();
  });

  it("agrega la página siguiente y desaparece al terminar", async () => {
    loadMoreUserCommentsAction.mockResolvedValue({
      status: "success",
      items: [item(2), item(3)],
      nextCursor: null,
    });
    setup([item(1)], "cur-1");
    fireEvent.click(
      screen.getByRole("button", { name: "Ver más comentarios" }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(3),
    );
    expect(loadMoreUserCommentsAction).toHaveBeenCalledWith("cur-1");
    expect(
      screen.queryByRole("button", { name: "Ver más comentarios" }),
    ).toBeNull();
  });

  it("si falla muestra el error y conserva el botón", async () => {
    loadMoreUserCommentsAction.mockResolvedValue({
      status: "error",
      message: "No pudimos cargar más comentarios.",
    });
    setup([item(1)], "cur-1");
    fireEvent.click(
      screen.getByRole("button", { name: "Ver más comentarios" }),
    );
    await screen.findByText("No pudimos cargar más comentarios.");
    expect(
      screen.getByRole("button", { name: "Ver más comentarios" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
