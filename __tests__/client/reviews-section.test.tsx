import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicComment, RatingSummary } from "@/db/blog";
import type { ViewerState } from "@/db/blog-community";

const loadMoreCommentsAction = vi.fn();
vi.mock("@/app/(site)/blog/actions", () => ({
  loadMoreCommentsAction: (...args: unknown[]) =>
    loadMoreCommentsAction(...args),
}));

const rateAction = vi.fn();
const toggleVoteAction = vi.fn();
const createCommentAction = vi.fn();
const deleteCommentAction = vi.fn();
const saveReplyAction = vi.fn();
const deleteReplyAction = vi.fn();
vi.mock("@/app/(site)/blog/community-actions", () => ({
  rateAction: (...args: unknown[]) => rateAction(...args),
  toggleVoteAction: (...args: unknown[]) => toggleVoteAction(...args),
  createCommentAction: (...args: unknown[]) => createCommentAction(...args),
  deleteCommentAction: (...args: unknown[]) => deleteCommentAction(...args),
  saveReplyAction: (...args: unknown[]) => saveReplyAction(...args),
  deleteReplyAction: (...args: unknown[]) => deleteReplyAction(...args),
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
  toggleVoteAction.mockReset();
  createCommentAction.mockReset();
  deleteCommentAction.mockReset();
  saveReplyAction.mockReset();
  deleteReplyAction.mockReset();
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

describe("ReviewsSection · Útil", () => {
  it("sin sesión es un enlace a login con volver y no hay Responder", () => {
    setup({ initialComments: [comment(1, { usefulCount: 12 })] });
    const link = screen.getByRole("link", { name: "Útil · 12" });
    expect(link.getAttribute("href")).toBe(
      "/cuenta/login?volver=/blog/un-post",
    );
    expect(screen.queryByRole("button", { name: "Útil · 12" })).toBeNull();
    expect(screen.queryByText("Responder")).toBeNull();
  });

  it("con sesión cambia al instante y después toma el conteo de la acción", async () => {
    let resolver!: (v: unknown) => void;
    toggleVoteAction.mockReturnValue(new Promise((r) => (resolver = r)));
    setup({
      viewer: viewerOf(),
      initialComments: [comment(1, { usefulCount: 12 })],
    });
    fireEvent.click(screen.getByRole("button", { name: "Útil · 12" }));
    const pressed = screen.getByRole("button", { name: "Útil · 13" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    resolver({ status: "success", voted: true, usefulCount: 20 });
    await screen.findByRole("button", { name: "Útil · 20" });
    expect(toggleVoteAction).toHaveBeenCalledWith("c-1");
  });

  it("arranca marcado según viewer.votedCommentIds y un segundo clic quita el voto", async () => {
    toggleVoteAction.mockResolvedValue({
      status: "success",
      voted: false,
      usefulCount: 11,
    });
    setup({
      viewer: viewerOf({ votedCommentIds: ["c-1"] }),
      initialComments: [comment(1, { usefulCount: 12 })],
    });
    const btn = screen.getByRole("button", { name: "Útil · 12" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(btn);
    const off = await screen.findByRole("button", { name: "Útil · 11" });
    expect(off.getAttribute("aria-pressed")).toBe("false");
  });

  it("si la acción falla vuelve atrás y muestra el error en un status", async () => {
    toggleVoteAction.mockResolvedValue({
      status: "error",
      message: "No pudimos registrar tu voto.",
    });
    setup({
      viewer: viewerOf(),
      initialComments: [comment(1, { usefulCount: 12 })],
    });
    fireEvent.click(screen.getByRole("button", { name: "Útil · 12" }));
    const status = await screen.findByText("No pudimos registrar tu voto.");
    expect(status.getAttribute("role")).toBe("status");
    const btn = screen.getByRole("button", { name: "Útil · 12" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("en comentarios propios muestra Útil · N como texto, no como botón", () => {
    setup({
      viewer: viewerOf({ ownCommentIds: ["c-1"] }),
      initialComments: [comment(1, { usefulCount: 3 })],
    });
    expect(screen.getByText("Útil · 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Útil · 3" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Útil · 3" })).toBeNull();
  });

  it("los comentarios de Ver más usan el mismo viewer", async () => {
    loadMoreCommentsAction.mockResolvedValue({
      status: "success",
      items: [comment(2)],
      nextCursor: null,
    });
    setup({
      viewer: viewerOf({ votedCommentIds: ["c-2"] }),
      initialComments: [comment(1)],
      initialCursor: "cur",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ver más comentarios" }),
    );
    const btn = await screen.findByRole("button", { name: "Útil · 2" });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("ReviewsSection · Responder", () => {
  const withReply = comment(1, {
    reply: {
      text: "Gracias por leerlo",
      repliedAt: new Date(Date.UTC(2026, 10, 17)),
    },
  });

  it("un lector que no es el autor del post no ve Responder, Editar ni Borrar en las respuestas", () => {
    setup({
      viewer: viewerOf(),
      initialComments: [comment(2), withReply],
    });
    expect(screen.queryByText("Responder")).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar" })).toBeNull();
    expect(screen.getByText("Gracias por leerlo")).toBeInTheDocument();
  });

  it("el autor ve Responder solo en los aprobados sin respuesta", () => {
    setup({
      viewer: viewerOf({ isPostAuthor: true }),
      initialComments: [comment(2), withReply],
    });
    expect(screen.getAllByRole("button", { name: "Responder" })).toHaveLength(
      1,
    );
  });

  it("publica una respuesta y la muestra con el badge Autor", async () => {
    saveReplyAction.mockResolvedValue({
      status: "success",
      reply: { text: "Gracias", repliedAt: new Date(Date.UTC(2026, 10, 17)) },
    });
    setup({
      viewer: viewerOf({ isPostAuthor: true }),
      initialComments: [comment(2)],
    });
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    const publicar = screen.getByRole("button", {
      name: "Publicar respuesta",
    }) as HTMLButtonElement;
    expect(publicar.disabled).toBe(true);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Escribí una respuesta" }),
      {
        target: { value: "Gracias" },
      },
    );
    fireEvent.click(publicar);
    await screen.findByText("Autor");
    expect(saveReplyAction).toHaveBeenCalledWith("c-2", "Gracias");
    expect(screen.getByText("Gracias")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Responder" })).toBeNull();
  });

  it("Cancelar cierra el editor sin guardar", () => {
    setup({
      viewer: viewerOf({ isPostAuthor: true }),
      initialComments: [comment(2)],
    });
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("textbox", { name: "Escribí una respuesta" }),
    ).toBeNull();
    expect(saveReplyAction).not.toHaveBeenCalled();
  });

  it("Editar abre el textarea con el texto actual y reemplaza la respuesta", async () => {
    saveReplyAction.mockResolvedValue({
      status: "success",
      reply: {
        text: "Texto nuevo",
        repliedAt: new Date(Date.UTC(2026, 10, 18)),
      },
    });
    setup({
      viewer: viewerOf({ isPostAuthor: true }),
      initialComments: [withReply],
    });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const area = screen.getByRole("textbox", {
      name: "Escribí una respuesta",
    }) as HTMLTextAreaElement;
    expect(area.value).toBe("Gracias por leerlo");
    fireEvent.change(area, { target: { value: "Texto nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar respuesta" }));
    await screen.findByText("Texto nuevo");
    expect(screen.queryByText("Gracias por leerlo")).toBeNull();
  });

  it("Borrar pide confirmación inline y quita la respuesta", async () => {
    deleteReplyAction.mockResolvedValue({ status: "success" });
    setup({
      viewer: viewerOf({ isPostAuthor: true }),
      initialComments: [withReply],
    });
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    const group = screen.getByRole("group", {
      name: "Confirmar borrado de la respuesta",
    });
    expect(within(group).getByText(/¿Borrar respuesta\?/)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("button", { name: "Sí, borrar" }));
    await waitFor(() =>
      expect(screen.queryByText("Gracias por leerlo")).toBeNull(),
    );
    expect(deleteReplyAction).toHaveBeenCalledWith("c-1");
    expect(
      screen.getByRole("button", { name: "Responder" }),
    ).toBeInTheDocument();
  });

  it("si falla al responder muestra el mensaje en un status y deja el editor abierto", async () => {
    saveReplyAction.mockResolvedValue({
      status: "error",
      message: "No pudimos guardar la respuesta.",
    });
    setup({
      viewer: viewerOf({ isPostAuthor: true }),
      initialComments: [comment(2)],
    });
    fireEvent.click(screen.getByRole("button", { name: "Responder" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Escribí una respuesta" }),
      {
        target: { value: "Gracias" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Publicar respuesta" }));
    const status = await screen.findByText("No pudimos guardar la respuesta.");
    expect(status.getAttribute("role")).toBe("status");
    expect(
      screen.getByRole("textbox", { name: "Escribí una respuesta" }),
    ).toBeInTheDocument();
  });

  it("si falla al borrar la respuesta la deja y muestra el mensaje", async () => {
    deleteReplyAction.mockResolvedValue({
      status: "error",
      message: "No pudimos guardar la respuesta.",
    });
    setup({
      viewer: viewerOf({ isPostAuthor: true }),
      initialComments: [withReply],
    });
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    await screen.findByText("No pudimos guardar la respuesta.");
    expect(screen.getByText("Gracias por leerlo")).toBeInTheDocument();
  });
});
