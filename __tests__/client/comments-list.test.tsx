import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommentsList } from "@/app/(admin)/admin/comments/comments-list";
import { AdminToaster } from "@/components/admin/toast";
import type { AdminCommentRow } from "@/db/admin-comments";

const { setStatus, undo } = vi.hoisted(() => ({ setStatus: vi.fn(), undo: vi.fn() }));
vi.mock("@/actions/admin/comments", () => ({
  setCommentStatusAction: setStatus,
  undoCommentStatusAction: undo,
}));

const row = (id: string, name: string, extra: Partial<AdminCommentRow> = {}): AdminCommentRow => ({
  id,
  text: `texto ${id}`,
  status: "pendiente",
  createdAt: new Date("2026-11-10T12:00:00Z"),
  usefulCount: 0,
  reply: null,
  author: { id: `u-${id}`, name, email: `${id}@demo.invalid`, image: null },
  post: { id: "p1", title: "Artículo", slug: "articulo", published: true },
  ...extra,
});
const items = [row("c1", "Ana"), row("c2", "Beto"), row("c3", "Carla")];

const setup = () => {
  render(
    <>
      <CommentsList items={items} />
      <AdminToaster />
    </>,
  );
};
const check = (name: string) =>
  userEvent.click(screen.getByRole("checkbox", { name: `Seleccionar el comentario de ${name}` }));

describe("CommentsList: selección", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sin selección no muestra la barra de lote", () => {
    setup();
    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();
  });

  it("tildar 2 tarjetas muestra '2 seleccionados' con Aprobar y Ocultar en lote", async () => {
    setup();
    await check("Ana");
    await check("Beto");
    const bar = screen.getByText("2 seleccionados").parentElement!;
    expect(bar).toHaveTextContent("Aprobar");
    expect(bar).toHaveTextContent("Ocultar");
    expect(bar).toHaveTextContent("Quitar selección");
  });

  it("'Seleccionar todos los de esta página' tilda todas", async () => {
    setup();
    await userEvent.click(screen.getByRole("checkbox", { name: "Seleccionar todos los de esta página" }));
    expect(screen.getByText("3 seleccionados")).toBeInTheDocument();
    for (const n of ["Ana", "Beto", "Carla"]) {
      expect(screen.getByRole("checkbox", { name: `Seleccionar el comentario de ${n}` })).toBeChecked();
    }
  });

  it("'Quitar selección' oculta la barra", async () => {
    setup();
    await check("Ana");
    await userEvent.click(screen.getByRole("button", { name: "Quitar selección" }));
    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Seleccionar el comentario de Ana" })).not.toBeChecked();
  });
});

describe("CommentsList: aprobar, ocultar y deshacer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aprobar en lote manda los ids y el estado, y limpia la selección", async () => {
    setStatus.mockResolvedValue({ status: "success", message: "Se aprobaron 2 comentarios." });
    setup();
    await check("Ana");
    await check("Carla");
    const bar = screen.getByText("2 seleccionados").parentElement!;
    await userEvent.click(bar.querySelector("button")!); // Aprobar
    await waitFor(() => expect(setStatus).toHaveBeenCalledTimes(1));
    const data = setStatus.mock.calls[0][1] as FormData;
    expect(data.getAll("id")).toEqual(["c1", "c3"]);
    expect(data.get("status")).toBe("aprobado");
    expect(await screen.findByText("Se aprobaron 2 comentarios.")).toBeInTheDocument();
    expect(screen.queryByText(/seleccionad/)).not.toBeInTheDocument();
  });

  it("al aprobar una tarjeta se muestra el toast con Deshacer, que llama a la action con el undo", async () => {
    const undoItems = [{ id: "c1", status: "pendiente" as const }];
    setStatus.mockResolvedValue({ status: "success", message: "Comentario aprobado.", undo: undoItems });
    undo.mockResolvedValue({ status: "success", message: "Se deshizo el cambio." });
    setup();
    const card = screen.getByText("texto c1").closest("article")!;
    await userEvent.click(card.querySelector("button")!); // Aprobar
    expect(await screen.findByText("Comentario aprobado.")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Deshacer" }));
    await waitFor(() => expect(undo).toHaveBeenCalledWith(undoItems));
    expect(await screen.findByText("Se deshizo el cambio.")).toBeInTheDocument();
  });

  it("si ninguno cambió, avisa sin botón Deshacer", async () => {
    setStatus.mockResolvedValue({ status: "success", message: "Esos comentarios ya estaban aprobados." });
    setup();
    const card = screen.getByText("texto c1").closest("article")!;
    await userEvent.click(card.querySelector("button")!);
    expect(await screen.findByText("Esos comentarios ya estaban aprobados.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deshacer" })).not.toBeInTheDocument();
  });

  it("un error de la action muestra el mensaje", async () => {
    setStatus.mockResolvedValue({ status: "error", message: "Ese comentario ya no existe." });
    setup();
    const card = screen.getByText("texto c2").closest("article")!;
    await userEvent.click(card.querySelector("button")!);
    expect(await screen.findByText("Ese comentario ya no existe.")).toBeInTheDocument();
  });
});
