import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardItem } from "@/app/(admin)/admin/medios/card-item";
import { MediaGrid } from "@/app/(admin)/admin/medios/media-grid";
import { AdminToaster } from "@/components/admin/toast";

const { loadMoreMediaAction } = vi.hoisted(() => ({
  loadMoreMediaAction: vi.fn(),
}));

vi.mock("@/actions/admin/medios", () => ({
  loadMoreMediaAction,
  updateMediaAltAction: vi.fn(),
  deleteMediaAction: vi.fn(),
}));

const card = (n: number): CardItem => ({
  id: `id-${n}`,
  src: `/media/id-${n}`,
  alt: `Alt ${n}`,
  width: 640,
  height: 360,
  bytes: 2048,
  titles: [],
  date: "16 nov 2026",
});

const cards = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => card(from + i));

describe("MediaGrid", () => {
  beforeEach(() => loadMoreMediaAction.mockReset());

  it("sin nextCursor no muestra Cargar más y cuenta el total real", () => {
    render(
      <MediaGrid
        initialItems={cards(1, 3)}
        initialCursor={null}
        initialTotal={3}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("3 imágenes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("usa el singular con una sola imagen", () => {
    render(
      <MediaGrid
        initialItems={cards(1, 1)}
        initialCursor={null}
        initialTotal={1}
      />,
    );
    expect(screen.getByText("1 imagen")).toBeInTheDocument();
  });

  it("el contador muestra el total, no las cargadas", () => {
    render(
      <MediaGrid
        initialItems={cards(1, 2)}
        initialCursor="c1"
        initialTotal={30}
      />,
    );
    expect(screen.getByText("30 imágenes")).toBeInTheDocument();
  });

  it("al cargar más deshabilita el botón, suma tarjetas y lo oculta si no hay más", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    loadMoreMediaAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(
      <MediaGrid
        initialItems={cards(1, 2)}
        initialCursor="c1"
        initialTotal={4}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cargar más" }));
    const busy = screen.getByRole("button", { name: "Cargando…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(loadMoreMediaAction).toHaveBeenCalledWith("c1");

    resolve({ status: "success", items: cards(3, 4), nextCursor: null });
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(4),
    );
    expect(screen.queryByRole("button", { name: /Carg/ })).toBeNull();
  });

  it("mantiene el botón si hay otro nextCursor", async () => {
    const user = userEvent.setup();
    loadMoreMediaAction.mockResolvedValue({
      status: "success",
      items: cards(3, 4),
      nextCursor: "c2",
    });
    render(
      <MediaGrid
        initialItems={cards(1, 2)}
        initialCursor="c1"
        initialTotal={6}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cargar más" }));
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(4),
    );
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
        <MediaGrid
          initialItems={cards(1, 2)}
          initialCursor="c1"
          initialTotal={4}
        />
        <AdminToaster />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(
      await screen.findByText("No pudimos cargar más imágenes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargar más" })).toBeEnabled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
