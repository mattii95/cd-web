import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicComment, RatingSummary } from "@/db/blog";
import type { ViewerState } from "@/db/blog-community";

const loadMoreCommentsAction = vi.fn();
vi.mock("@/app/(site)/blog/actions", () => ({
  loadMoreCommentsAction: (...args: unknown[]) =>
    loadMoreCommentsAction(...args),
}));

const rateAction = vi.fn();
const createCommentAction = vi.fn();
const deleteCommentAction = vi.fn();
vi.mock("@/app/(site)/blog/community-actions", () => ({
  rateAction: (...args: unknown[]) => rateAction(...args),
  createCommentAction: (...args: unknown[]) => createCommentAction(...args),
  deleteCommentAction: (...args: unknown[]) => deleteCommentAction(...args),
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

beforeEach(() => {
  loadMoreCommentsAction.mockReset();
  rateAction.mockReset();
  createCommentAction.mockReset();
  deleteCommentAction.mockReset();
});

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

const viewerOf = (over: Partial<ViewerState> = {}): ViewerState => ({
  rating: null,
  votedCommentIds: [],
  ownCommentIds: [],
  pending: [],
  isPostAuthor: false,
  ...over,
});

describe("ReviewsSection · sin sesión", () => {
  it("muestra el bloque de login y no el de opinión", () => {
    setup();
    expect(
      screen.getByText("Iniciá sesión para comentar y puntuar"),
    ).toBeTruthy();
    expect(screen.queryByText("Tu opinión")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});

describe("ReviewsSection · Tu opinión", () => {
  it("reemplaza al bloque de login y marca la valoración guardada", () => {
    setup({ viewer: viewerOf({ rating: 4 }) });
    expect(screen.getByText("Tu opinión")).toBeTruthy();
    expect(
      screen.queryByText("Iniciá sesión para comentar y puntuar"),
    ).toBeNull();
    expect(screen.getByText("Tu valoración")).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(
      screen
        .getByRole("radio", { name: "4 estrellas" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "5 estrellas" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("al elegir una valoración la guarda", async () => {
    rateAction.mockResolvedValue({ status: "success" });
    setup({ viewer: viewerOf() });
    fireEvent.click(screen.getByRole("radio", { name: "3 estrellas" }));
    await waitFor(() => expect(rateAction).toHaveBeenCalledWith(POST_ID, 3));
    expect(
      screen
        .getByRole("radio", { name: "3 estrellas" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("si falla al valorar, vuelve al valor anterior y muestra el error en un status", async () => {
    rateAction.mockResolvedValue({
      status: "error",
      message: "No pudimos guardar tu valoración.",
    });
    setup({ viewer: viewerOf({ rating: 2 }) });
    fireEvent.click(screen.getByRole("radio", { name: "5 estrellas" }));
    const status = await screen.findByText("No pudimos guardar tu valoración.");
    expect(status.getAttribute("role")).toBe("status");
    expect(
      screen
        .getByRole("radio", { name: "2 estrellas" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "5 estrellas" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("Publicar está deshabilitado con el textarea vacío o con un solo carácter", () => {
    setup({ viewer: viewerOf() });
    const publicar = screen.getByRole("button", {
      name: "Publicar",
    }) as HTMLButtonElement;
    const area = screen.getByRole("textbox", { name: "Escribí un comentario" });
    expect(publicar.disabled).toBe(true);
    fireEvent.change(area, { target: { value: " a " } });
    expect(publicar.disabled).toBe(true);
    expect(screen.getByText("3/2000")).toBeTruthy();
    fireEvent.change(area, { target: { value: "ok" } });
    expect(publicar.disabled).toBe(false);
  });

  it("al publicar muestra el comentario arriba con En revisión, el mensaje y vacía el textarea", async () => {
    createCommentAction.mockResolvedValue({
      status: "success",
      comment: comment(99, { authorName: "Yo", text: "Mi comentario" }),
    });
    setup({ viewer: viewerOf(), initialComments: [comment(1)] });
    const area = screen.getByRole("textbox", {
      name: "Escribí un comentario",
    }) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: "Mi comentario" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await screen.findByText("Tu comentario quedó en revisión.");
    expect(createCommentAction).toHaveBeenCalledWith(POST_ID, "Mi comentario");
    expect(area.value).toBe("");
    const first = screen.getAllByRole("listitem")[0];
    expect(first.textContent).toContain("Mi comentario");
    expect(first.textContent).toContain("En revisión");
    expect(first.textContent).not.toContain("Útil");
    expect(first.textContent).not.toContain("Responder");
  });

  it("si falla al publicar muestra el mensaje y conserva el texto", async () => {
    createCommentAction.mockResolvedValue({
      status: "error",
      message: "No pudimos publicar tu comentario.",
    });
    setup({ viewer: viewerOf() });
    const area = screen.getByRole("textbox", {
      name: "Escribí un comentario",
    }) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: "Mi comentario" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await screen.findByText("No pudimos publicar tu comentario.");
    expect(area.value).toBe("Mi comentario");
    expect(items()).toBe(0);
  });

  it("muestra los pendientes del lector arriba de los aprobados", () => {
    setup({
      viewer: viewerOf({ pending: [comment(50, { text: "Pendiente" })] }),
      initialComments: [comment(1)],
    });
    const lis = screen.getAllByRole("listitem");
    expect(lis[0].textContent).toContain("Pendiente");
    expect(lis[0].textContent).toContain("En revisión");
    expect(lis[1].textContent).not.toContain("En revisión");
  });
});

describe("ReviewsSection · borrar", () => {
  it("solo los comentarios propios muestran Borrar", () => {
    setup({
      viewer: viewerOf({ ownCommentIds: ["c-2"] }),
      initialComments: [comment(1), comment(2)],
    });
    expect(screen.getAllByRole("button", { name: "Borrar" })).toHaveLength(1);
  });

  it("pide confirmación inline y Cancelar no borra", () => {
    setup({
      viewer: viewerOf({ ownCommentIds: ["c-2"] }),
      initialComments: [comment(2)],
    });
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    expect(screen.getByText(/¿Borrar comentario\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText(/¿Borrar comentario\?/)).toBeNull();
    expect(deleteCommentAction).not.toHaveBeenCalled();
    expect(items()).toBe(1);
  });

  it("Sí, borrar quita el comentario de la lista", async () => {
    deleteCommentAction.mockResolvedValue({ status: "success" });
    setup({
      viewer: viewerOf({ ownCommentIds: ["c-2"] }),
      initialComments: [comment(1), comment(2)],
    });
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() => expect(items()).toBe(1));
    expect(deleteCommentAction).toHaveBeenCalledWith("c-2");
    expect(screen.queryByText("Texto 2")).toBeNull();
  });

  it("borra también un comentario pendiente", async () => {
    deleteCommentAction.mockResolvedValue({ status: "success" });
    setup({ viewer: viewerOf({ pending: [comment(50)] }) });
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() => expect(items()).toBe(0));
  });

  it("si falla al borrar muestra el mensaje en un status y deja el comentario", async () => {
    deleteCommentAction.mockResolvedValue({
      status: "error",
      message: "No pudimos borrar el comentario.",
    });
    setup({
      viewer: viewerOf({ ownCommentIds: ["c-2"] }),
      initialComments: [comment(2)],
    });
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    const status = await screen.findByText("No pudimos borrar el comentario.");
    expect(status.getAttribute("role")).toBe("status");
    expect(items()).toBe(1);
  });
});
