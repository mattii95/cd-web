import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditablePost } from "@/db/admin-posts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/actions/admin/articles", () => ({ saveArticleAction: vi.fn() }));
vi.mock("@/components/admin/toast", () => ({ notify: vi.fn() }));

import { saveArticleAction } from "@/actions/admin/articles";
import { ArticleEditor } from "@/components/admin/article-editor/article-editor";
import { EditorToolbar } from "@/components/admin/article-editor/editor-toolbar";
import { createExtensions } from "@/components/admin/article-editor/extensions";
import { LINK_ERROR } from "@/components/admin/article-editor/link-popover";

// ProseMirror pide medidas que jsdom no calcula.
beforeAll(() => {
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {} };
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => vi.clearAllMocks());

const C1 = "5d0f7a40-1a2b-4c3d-8e4f-0a1b2c3d4e5f";
const C2 = "6e1a8b51-2b3c-4d4e-9f50-1b2c3d4e5f60";
const categories = [
  { id: C1, label: "Sistemas" },
  { id: C2, label: "SEO" },
];
const post = (over: Partial<EditablePost> = {}): EditablePost => ({
  id: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11",
  slug: "mi-articulo",
  title: "Mi artículo",
  excerpt: "Resumen",
  cta: "Escribinos",
  categoryId: C1,
  body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hola" }] }] },
  tags: [],
  status: "borrador",
  publishedAt: null,
  updatedAt: new Date("2026-11-10T12:00:00Z"),
  cover: null,
  images: {},
  ...over,
});

describe("ArticleEditor", () => {
  it("en /new muestra Guardar borrador y Publicar", () => {
    render(<ArticleEditor post={null} categories={categories} tagOptions={[]} />);
    expect(screen.getByRole("heading", { level: 1, name: "Nuevo artículo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeInTheDocument();
  });

  it("con un post publicado muestra Pasar a borrador y Guardar cambios", () => {
    render(
      <ArticleEditor
        post={post({ status: "publicado", publishedAt: new Date("2026-11-11") })}
        categories={categories}
        tagOptions={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "Pasar a borrador" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publicar" })).not.toBeInTheDocument();
  });

  it("el título llena el slug y editarlo a mano corta el seguimiento", async () => {
    const user = userEvent.setup();
    render(<ArticleEditor post={null} categories={categories} tagOptions={[]} />);
    const slug = screen.getByLabelText("Dirección del artículo");
    await user.type(screen.getByLabelText("Título del artículo"), "¿Qué es SaaS?");
    expect(slug).toHaveValue("que-es-saas");

    await user.clear(slug);
    // Borrarlo entero vuelve a seguir al título.
    expect(slug).toHaveValue("que-es-saas");
    await user.type(slug, "-x");
    await user.type(screen.getByLabelText("Título del artículo"), " Hoy");
    expect(slug).toHaveValue("que-es-saas-x");
  });

  it("con publishedAt el slug es de solo lectura y muestra la nota", () => {
    render(
      <ArticleEditor
        post={post({ status: "publicado", publishedAt: new Date("2026-11-11") })}
        categories={categories}
        tagOptions={[]}
      />,
    );
    expect(screen.getByLabelText("Dirección del artículo")).toHaveAttribute("readonly");
    expect(screen.getByText("La URL no cambia porque el artículo ya se publicó.")).toBeInTheDocument();
  });

  it("Publicar sin resumen muestra el error, mueve el foco y no abre el modal", async () => {
    const user = userEvent.setup();
    render(<ArticleEditor post={post({ excerpt: "" })} categories={categories} tagOptions={[]} />);
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    const excerpt = screen.getByLabelText("Resumen que aparece debajo del título");
    expect(excerpt).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Escribí el resumen.")).toBeInTheDocument();
    expect(excerpt).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(saveArticleAction).not.toHaveBeenCalled();
  });

  it("Publicar con todo completo abre el modal y confirmar guarda con intent publish", async () => {
    vi.mocked(saveArticleAction).mockResolvedValue({
      status: "success",
      message: "Artículo publicado.",
      id: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11",
      slug: "mi-articulo",
      postStatus: "publicado",
      updatedAt: "2026-11-18T10:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(saveArticleAction).toHaveBeenCalled());
    const data = vi.mocked(saveArticleAction).mock.calls[0][1];
    expect(data.get("intent")).toBe("publish");
    expect(data.get("title")).toBe("Mi artículo");
    await waitFor(() => expect(screen.getByLabelText("Dirección del artículo")).toHaveAttribute("readonly"));
  });
});

describe("EditorToolbar", () => {
  function setup(content: object) {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: createExtensions(),
      content,
    });
    render(<EditorToolbar editor={editor} />);
    return editor;
  }
  const doc = (...c: object[]) => ({ type: "doc", content: [{ type: "paragraph", content: c }] });

  it("todos los botones tienen aria-label y Negrita queda presionada sobre texto en negrita", async () => {
    const editor = setup(doc({ type: "text", text: "Hola", marks: [{ type: "bold" }] }));
    expect(screen.getByRole("toolbar", { name: "Formato del texto" })).toBeInTheDocument();
    for (const name of [
      "Deshacer", "Rehacer", "Título H2", "Subtítulo H3", "Negrita", "Cursiva", "Enlace",
      "Lista con viñetas", "Lista numerada", "Cita", "Consejo", "En resumen",
    ])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();

    act(() => {
      editor.commands.setTextSelection(2);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Negrita" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "Cursiva" })).toHaveAttribute("aria-pressed", "false");
  });

  it("el botón Enlace está deshabilitado sin selección", () => {
    setup(doc({ type: "text", text: "Hola" }));
    expect(screen.getByRole("button", { name: "Enlace" })).toBeDisabled();
  });

  it("el popover rechaza javascript: y acepta /servicios", async () => {
    const user = userEvent.setup();
    const editor = setup(doc({ type: "text", text: "Hola mundo" }));
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 5 });
    });
    await user.click(await screen.findByRole("button", { name: "Enlace" }));

    const url = screen.getByLabelText("URL");
    await user.type(url, "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(screen.getByText(LINK_ERROR)).toBeInTheDocument();
    expect(JSON.stringify(editor.getJSON())).not.toContain("javascript");

    await user.clear(url);
    await user.type(url, "/servicios");
    await user.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(JSON.stringify(editor.getJSON())).toContain('"href":"/servicios"');
    expect(screen.queryByLabelText("URL")).not.toBeInTheDocument();
  });

  it("Escape cierra el popover", async () => {
    const user = userEvent.setup();
    const editor = setup(doc({ type: "text", text: "Hola mundo" }));
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 5 });
    });
    await user.click(await screen.findByRole("button", { name: "Enlace" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("URL")).not.toBeInTheDocument();
  });
});
