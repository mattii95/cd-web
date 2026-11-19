import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditablePost } from "@/db/admin-posts";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/actions/admin/articles", () => ({ saveArticleAction: vi.fn(), deletePostAction: vi.fn() }));
vi.mock("@/components/admin/toast", () => ({ notify: vi.fn() }));
vi.mock("@/actions/admin/media", () => ({ searchMediaAction: vi.fn(), uploadPickerMediaAction: vi.fn() }));

import { deletePostAction, saveArticleAction } from "@/actions/admin/articles";
import { searchMediaAction } from "@/actions/admin/media";
import { notify } from "@/components/admin/toast";
import { ArticleEditor } from "@/components/admin/article-editor/article-editor";
import { EditorToolbar } from "@/components/admin/article-editor/editor-toolbar";
import { createExtensions } from "@/components/admin/article-editor/extensions";
import { insertImage } from "@/components/admin/article-editor/insert-image";
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

describe("ArticleEditor: salir, conflicto y eliminar", () => {
  const unload = () => {
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  };

  it("con cambios sin guardar, ← Artículos abre ¿Salir sin guardar? y beforeunload avisa", async () => {
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    expect(unload()).toBe(false);
    await user.type(screen.getByLabelText("Título del artículo"), " 2");
    expect(unload()).toBe(true);

    await user.click(screen.getByRole("link", { name: /Artículos/ }));
    const dialog = await screen.findByRole("dialog", { name: "¿Salir sin guardar?" });
    expect(within(dialog).getByText("Los cambios que no guardaste se pierden.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Salir" }));
    expect(router.push).toHaveBeenCalledWith("/admin/articles");
  });

  it("sin cambios, ← Artículos no pregunta", async () => {
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    await user.click(screen.getByRole("link", { name: /Artículos/ }));
    expect(screen.queryByRole("dialog", { name: "¿Salir sin guardar?" })).not.toBeInTheDocument();
  });

  it("después de guardar, el aviso se apaga", async () => {
    vi.mocked(saveArticleAction).mockResolvedValue({
      status: "success",
      message: "Borrador guardado.",
      id: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11",
      slug: "mi-articulo",
      postStatus: "borrador",
      updatedAt: "2026-11-18T10:00:00.000Z",
    });
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    await user.type(screen.getByLabelText("Título del artículo"), " 2");
    expect(unload()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(unload()).toBe(false));
  });

  it("un conflicto se muestra como toast y no cambia el estado guardado", async () => {
    vi.mocked(saveArticleAction).mockResolvedValue({
      status: "error",
      message: "Alguien modificó este artículo. Recargá para ver los cambios.",
    });
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith({
        status: "error",
        message: "Alguien modificó este artículo. Recargá para ver los cambios.",
      }),
    );
  });

  it("Eliminar artículo pide confirmación, borra y vuelve a la tabla", async () => {
    vi.mocked(deletePostAction).mockResolvedValue({ status: "success", message: "Artículo eliminado." });
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    await user.click(screen.getByRole("button", { name: "Eliminar artículo" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Eliminar el artículo?" });
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/articles"));
    expect(vi.mocked(deletePostAction).mock.calls[0][1].get("id")).toBe(post().id);
    expect(notify).toHaveBeenCalledWith({ status: "success", message: "Artículo eliminado." });
  });

  it("en /new no hay botón Eliminar artículo", () => {
    render(<ArticleEditor post={null} categories={categories} tagOptions={[]} />);
    expect(screen.queryByRole("button", { name: "Eliminar artículo" })).not.toBeInTheDocument();
  });
});

describe("ArticleEditor: portada", () => {
  const MID = "7f2b9c62-3c4d-4e5f-8a61-2c3d4e5f6071";
  const M1 = { id: MID, src: `/media/${MID}`, alt: "Equipo en la oficina", width: 1200, height: 800 };
  const saved = {
    status: "success",
    message: "Borrador guardado.",
    id: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11",
    slug: "mi-articulo",
    postStatus: "borrador",
    updatedAt: "2026-11-18T10:00:00.000Z",
  } as const;

  const elegir = async (user: ReturnType<typeof userEvent.setup>) => {
    vi.mocked(searchMediaAction).mockResolvedValue({ status: "success", items: [M1], nextCursor: null });
    await user.click(screen.getByRole("button", { name: /^(Elegir|Cambiar) portada$/ }));
    await user.click(await screen.findByRole("button", { name: M1.alt }));
    await user.click(screen.getByRole("button", { name: "Usar como portada" }));
  };

  it("sin portada muestra 'Sin portada' y 'Elegir portada'", () => {
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    expect(screen.getByText("Sin portada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elegir portada" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar portada" })).not.toBeInTheDocument();
  });

  it("elegir una portada muestra su miniatura y alt, y deja cambios sin guardar", async () => {
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    await elegir(user);
    expect(screen.getByText(M1.alt)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar portada" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar portada" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Artículos/ }));
    expect(await screen.findByRole("dialog", { name: "¿Salir sin guardar?" })).toBeInTheDocument();
  });

  it("quitar la portada vuelve a 'Sin portada' y cuenta como cambio", async () => {
    const user = userEvent.setup();
    const cover = { id: MID, src: M1.src, alt: M1.alt };
    render(<ArticleEditor post={post({ cover })} categories={categories} tagOptions={[]} />);
    expect(screen.getByText(M1.alt)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar portada" }));
    expect(screen.getByText("Sin portada")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Artículos/ }));
    expect(await screen.findByRole("dialog", { name: "¿Salir sin guardar?" })).toBeInTheDocument();
  });

  it("guardar envía coverMediaId: el elegido, el que ya tenía o vacío si se quitó", async () => {
    vi.mocked(saveArticleAction).mockResolvedValue(saved);
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    await elegir(user);
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(saveArticleAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveArticleAction).mock.calls[0][1].get("coverMediaId")).toBe(MID);

    await user.click(screen.getByRole("button", { name: "Quitar portada" }));
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(saveArticleAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(saveArticleAction).mock.calls[1][1].get("coverMediaId")).toBe("");
  });

  it("después de guardar, la portada elegida ya no cuenta como cambio", async () => {
    vi.mocked(saveArticleAction).mockResolvedValue(saved);
    const user = userEvent.setup();
    render(<ArticleEditor post={post()} categories={categories} tagOptions={[]} />);
    await elegir(user);
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(notify).toHaveBeenCalled());
    await user.click(screen.getByRole("link", { name: /Artículos/ }));
    expect(screen.queryByRole("dialog", { name: "¿Salir sin guardar?" })).not.toBeInTheDocument();
  });
});

describe("EditorToolbar", () => {
  const onInsertImage = vi.fn();
  function setup(content: object) {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: createExtensions(),
      content,
    });
    render(<EditorToolbar editor={editor} onInsertImage={onInsertImage} />);
    return editor;
  }
  const doc = (...c: object[]) => ({ type: "doc", content: [{ type: "paragraph", content: c }] });

  it("todos los botones tienen aria-label y Negrita queda presionada sobre texto en negrita", async () => {
    const editor = setup(doc({ type: "text", text: "Hola", marks: [{ type: "bold" }] }));
    expect(screen.getByRole("toolbar", { name: "Formato del texto" })).toBeInTheDocument();
    for (const name of [
      "Deshacer", "Rehacer", "Título H2", "Subtítulo H3", "Negrita", "Cursiva", "Enlace",
      "Lista con viñetas", "Lista numerada", "Cita", "Consejo", "En resumen", "Insertar imagen",
    ])
      expect(screen.getByRole("button", { name })).toBeInTheDocument();

    act(() => {
      editor.commands.setTextSelection(2);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Negrita" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: "Cursiva" })).toHaveAttribute("aria-pressed", "false");
  });

  it("'Insertar imagen' va después de 'En resumen' y abre el selector", async () => {
    setup(doc({ type: "text", text: "Hola" }));
    const names = within(screen.getByRole("toolbar", { name: "Formato del texto" }))
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"));
    expect(names.indexOf("Insertar imagen")).toBe(names.indexOf("En resumen") + 1);
    await userEvent.click(screen.getByRole("button", { name: "Insertar imagen" }));
    expect(onInsertImage).toHaveBeenCalledTimes(1);
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

describe("insertImage", () => {
  const MID = "7f2b9c62-3c4d-4e5f-8a61-2c3d4e5f6071";
  const item = { id: MID, src: `/media/${MID}`, alt: "Equipo" };
  const para = (text?: string) => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) });
  const make = (...content: object[]) =>
    new Editor({ element: document.createElement("div"), extensions: createExtensions(), content: { type: "doc", content } });
  const types = (e: Editor) => e.getJSON().content?.map((n) => n.type);

  it("con el cursor en el segundo párrafo la deja después de ese párrafo, seleccionada y con alt y pie en null", () => {
    const editor = make(para("uno"), para("dos"), para("tres"));
    editor.commands.setTextSelection(7); // dentro de "dos"
    const images = {};
    insertImage(editor, images, item);
    expect(types(editor)).toEqual(["paragraph", "paragraph", "image", "paragraph"]);
    expect(editor.getJSON().content?.[2].attrs).toEqual({ mediaId: MID, alt: null, caption: null });
    expect(editor.state.selection).toMatchObject({ node: { type: { name: "image" } } });
    expect(images).toEqual({ [MID]: { src: item.src, alt: "Equipo" } });
  });

  it("con el cursor dentro de una lista la deja después de la lista", () => {
    const editor = make(
      { type: "bulletList", content: [{ type: "listItem", content: [para("a")] }, { type: "listItem", content: [para("b")] }] },
      para("fin"),
    );
    editor.commands.setTextSelection(5); // dentro de "a"
    insertImage(editor, {}, item);
    expect(types(editor)).toEqual(["bulletList", "image", "paragraph"]);
  });

  it("con el cursor dentro de una cita la deja después de la cita", () => {
    const editor = make({ type: "blockquote", content: [para("cita")] }, para("fin"));
    editor.commands.setTextSelection(3);
    insertImage(editor, {}, item);
    expect(types(editor)).toEqual(["blockquote", "image", "paragraph"]);
  });

  it("si el bloque es un párrafo vacío, la imagen lo reemplaza", () => {
    const editor = make(para("uno"), para());
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    insertImage(editor, {}, item);
    // StarterKit agrega un párrafo vacío después de una imagen final, para poder seguir escribiendo.
    expect(types(editor)).toEqual(["paragraph", "image", "paragraph"]);
  });

  it("con otra imagen seleccionada la deja después de esa imagen", () => {
    const editor = make(
      para("uno"),
      { type: "image", attrs: { mediaId: "otra", alt: null, caption: null } },
      para("dos"),
    );
    editor.commands.setNodeSelection(5);
    insertImage(editor, {}, item);
    expect(types(editor)).toEqual(["paragraph", "image", "image", "paragraph"]);
  });
});
