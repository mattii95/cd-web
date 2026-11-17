import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicComment, RatingSummary } from "@/db/blog";

const loadMoreCommentsAction = vi.fn();
vi.mock("@/app/(site)/blog/actions", () => ({
  loadMoreCommentsAction: (...args: unknown[]) =>
    loadMoreCommentsAction(...args),
}));

import { ReviewsSection } from "@/components/blog/reviews-section";

const POST_ID = "7f3c1b9e-0000-4000-8000-000000000001";
const author = {
  name: "Matías Courroux",
  image: null,
  jobTitle: "Fundador",
  bio: null,
};
const summary: RatingSummary = {
  average: 4.5,
  total: 4,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 2 },
};
const empty: RatingSummary = {
  average: 0,
  total: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const comment = (
  n: number,
  over: Partial<PublicComment> = {},
): PublicComment => ({
  id: `c-${n}`,
  authorName: `Autor ${n}`,
  authorImage: null,
  rating: 5,
  text: `Texto ${n}`,
  usefulCount: n,
  createdAt: new Date(Date.UTC(2026, 10, 16)),
  reply: null,
  ...over,
});
const many = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => comment(from + i));

const setup = (
  props: Partial<React.ComponentProps<typeof ReviewsSection>> = {},
) =>
  render(
    <ReviewsSection
      postId={POST_ID}
      slug="un-post"
      author={author}
      summary={summary}
      initialComments={[]}
      initialCursor={null}
      viewer={null}
      {...props}
    />,
  );
const items = () => screen.queryAllByRole("listitem").length;

beforeEach(() => loadMoreCommentsAction.mockReset());

describe("ReviewsSection · resumen", () => {
  it("muestra el promedio, el total y las barras", () => {
    setup();
    expect(screen.getByText("4,5")).toBeInTheDocument();
    expect(screen.getByText("4 valoraciones")).toBeInTheDocument();
    expect(screen.queryByText("Todavía no hay valoraciones")).toBeNull();
  });

  it("sin valoraciones muestra el estado vacío en vez del promedio", () => {
    setup({ summary: empty });
    expect(screen.getByText("Todavía no hay valoraciones")).toBeInTheDocument();
    expect(screen.queryByText("0,0")).toBeNull();
  });

  it("sin comentarios muestra el estado vacío", () => {
    setup();
    expect(screen.getByText("Todavía no hay comentarios")).toBeInTheDocument();
  });

  it("no tiene el selector de orden", () => {
    setup({ initialComments: many(1, 3) });
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/Ordenar por/)).toBeNull();
  });
});

describe("ReviewsSection · comentarios", () => {
  it("muestra la fecha absoluta, las iniciales y las estrellas solo si hay rating", () => {
    setup({
      initialComments: [
        comment(1, { authorName: "Lucía Fernández" }),
        comment(2, { rating: null }),
      ],
    });
    expect(screen.getAllByText("16 nov 2026")).toHaveLength(2);
    expect(screen.getByText("LF")).toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: /^\d de 5 estrellas$/ }),
    ).toHaveLength(1);
  });

  it("muestra la respuesta del autor con su fecha", () => {
    setup({
      initialComments: [
        comment(1, {
          reply: {
            text: "Gracias",
            repliedAt: new Date(Date.UTC(2026, 10, 17)),
          },
        }),
      ],
    });
    expect(screen.getByText("Gracias")).toBeInTheDocument();
    expect(screen.getByText("17 nov 2026")).toBeInTheDocument();
    expect(screen.getByText("Autor")).toBeInTheDocument();
  });

  it("Útil arranca en usefulCount y suma 1 solo en el cliente", () => {
    setup({ initialComments: [comment(1, { usefulCount: 12 })] });
    const btn = screen.getByRole("button", { name: "Útil · 12" });
    fireEvent.click(btn);
    expect(
      screen.getByRole("button", { name: "Útil · 13" }),
    ).toBeInTheDocument();
    expect(loadMoreCommentsAction).not.toHaveBeenCalled();
  });
});

describe("ReviewsSection · Ver más comentarios", () => {
  it("no se muestra sin cursor", () => {
    setup({ initialComments: many(1, 3) });
    expect(
      screen.queryByRole("button", { name: "Ver más comentarios" }),
    ).toBeNull();
  });

  it("con 25 comentarios muestra 20 y al hacer clic suma 5 y el botón desaparece", async () => {
    loadMoreCommentsAction.mockResolvedValue({
      status: "success",
      items: many(21, 25),
      nextCursor: null,
    });
    setup({ initialComments: many(1, 20), initialCursor: "c1" });
    expect(items()).toBe(20);
    fireEvent.click(
      screen.getByRole("button", { name: "Ver más comentarios" }),
    );
    await waitFor(() => expect(items()).toBe(25));
    expect(loadMoreCommentsAction).toHaveBeenCalledWith(POST_ID, "c1");
    expect(
      screen.queryByRole("button", { name: "Ver más comentarios" }),
    ).toBeNull();
  });

  it("si la acción devuelve error muestra el aviso y habilita el botón", async () => {
    loadMoreCommentsAction.mockResolvedValue({ status: "error", message: "x" });
    setup({ initialComments: many(1, 20), initialCursor: "c1" });
    fireEvent.click(
      screen.getByRole("button", { name: "Ver más comentarios" }),
    );
    expect(
      await screen.findByText("No pudimos cargar más comentarios."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ver más comentarios" }),
    ).toBeEnabled();
    expect(items()).toBe(20);
  });

  it("mientras carga queda deshabilitado con aria-busy", async () => {
    let resolve!: (v: unknown) => void;
    loadMoreCommentsAction.mockReturnValue(new Promise((r) => (resolve = r)));
    setup({ initialComments: many(1, 20), initialCursor: "c1" });
    fireEvent.click(
      screen.getByRole("button", { name: "Ver más comentarios" }),
    );
    const busy = await screen.findByRole("button", { name: "Cargando…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    resolve({ status: "success", items: [], nextCursor: null });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cargando…" })).toBeNull(),
    );
  });
});
