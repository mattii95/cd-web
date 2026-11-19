import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardItem } from "@/app/(admin)/admin/media/card-item";
import { MediaGrid } from "@/app/(admin)/admin/media/media-grid";
import { AdminToaster } from "@/components/admin/toast";
import type { AdminMediaQuery } from "@/lib/admin/media-params";

const { loadMoreMediaAction } = vi.hoisted(() => ({
  loadMoreMediaAction: vi.fn(),
}));

vi.mock("@/actions/admin/media", () => ({ loadMoreMediaAction }));

const card = (n: number, inUse = false): CardItem => ({
  id: `id-${n}`,
  src: `/media/id-${n}`,
  alt: `Alt ${n}`,
  originalName: `f${n}.webp`,
  width: 640,
  height: 360,
  bytes: 2048,
  usage: inUse ? [{ postId: `p-${n}`, title: `Post ${n}`, as: "portada" }] : [],
  date: "16 nov 2026",
});

const cards = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => card(from + i));

const ALL: AdminMediaQuery = { q: null, uso: null };

const grid = (
  items: CardItem[],
  over: { cursor?: string | null; total?: number; query?: AdminMediaQuery } = {},
) => (
  <MediaGrid
    initialItems={items}
    initialCursor={over.cursor ?? null}
    initialTotal={over.total ?? items.length}
    query={over.query ?? ALL}
  />
);

describe("MediaGrid", () => {
  beforeEach(() => loadMoreMediaAction.mockReset());

  it("sin nextCursor no muestra Cargar más y cuenta el total real", () => {
    render(grid(cards(1, 3)));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("3 imágenes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("usa el singular con una sola imagen", () => {
    render(grid(cards(1, 1)));
    expect(screen.getByText("1 imagen")).toBeInTheDocument();
  });

  it("el contador muestra el total, no las cargadas", () => {
    render(grid(cards(1, 2), { cursor: "c1", total: 30 }));
    expect(screen.getByText("30 imágenes")).toBeInTheDocument();
  });

  it("cada miniatura es un botón 'Ver detalles de {alt}' con su insignia de uso", () => {
    render(grid([card(1, true), card(2)]));
    expect(screen.getByRole("button", { name: "Ver detalles de Alt 1" })).toHaveTextContent("En uso");
    expect(screen.getByRole("button", { name: "Ver detalles de Alt 2" })).toHaveTextContent("Sin usar");
  });

  it.each([
    [ALL, "Todavía no hay imágenes."],
    [{ q: "x", uso: null }, "No hay imágenes que coincidan con «x»."],
    [{ q: null, uso: "en-uso" }, "No hay imágenes en uso."],
    [{ q: null, uso: "sin-usar" }, "No hay imágenes sin usar."],
  ] as const)("sin resultados con %j dice %s", (query, text) => {
    render(grid([], { query }));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("al cargar más deshabilita el botón, suma miniaturas y lo oculta si no hay más", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    loadMoreMediaAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(grid(cards(1, 2), { cursor: "c1", total: 4 }));

    await user.click(screen.getByRole("button", { name: "Cargar más" }));
    const busy = screen.getByRole("button", { name: "Cargando…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(loadMoreMediaAction).toHaveBeenCalledWith({ cursor: "c1", query: "", usage: null });

    resolve({ status: "success", items: cards(3, 4), nextCursor: null });
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(4));
    expect(screen.queryByRole("button", { name: /Carg/ })).toBeNull();
  });

  it("pasa la búsqueda y el filtro a Cargar más", async () => {
    const user = userEvent.setup();
    loadMoreMediaAction.mockResolvedValue({ status: "success", items: [], nextCursor: null });
    render(grid(cards(1, 2), { cursor: "c1", total: 4, query: { q: "equipo", uso: "sin-usar" } }));
    await user.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(loadMoreMediaAction).toHaveBeenCalledWith({
      cursor: "c1",
      query: "equipo",
      usage: "unused",
    });
  });

  it("mantiene el botón si hay otro nextCursor", async () => {
    const user = userEvent.setup();
    loadMoreMediaAction.mockResolvedValue({
      status: "success",
      items: cards(3, 4),
      nextCursor: "c2",
    });
    render(grid(cards(1, 2), { cursor: "c1", total: 6 }));
    await user.click(screen.getByRole("button", { name: "Cargar más" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(4));
    expect(screen.getByRole("button", { name: "Cargar más" })).toBeEnabled();
  });

  it("si la acción falla muestra el error y vuelve a habilitar el botón", async () => {
    const user = userEvent.setup();
    loadMoreMediaAction.mockResolvedValue({
      status: "error",
      message: "No pudimos cargar más imágenes.",
    });
    render(
      <>
        {grid(cards(1, 2), { cursor: "c1", total: 4 })}
        <AdminToaster />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(await screen.findByText("No pudimos cargar más imágenes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargar más" })).toBeEnabled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
