import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor, EditorContent } from "@tiptap/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { searchMediaAction } = vi.hoisted(() => ({ searchMediaAction: vi.fn() }));
vi.mock("@/actions/admin/media", () => ({ searchMediaAction, uploadPickerMediaAction: vi.fn() }));

import { createExtensions } from "@/components/admin/article-editor/extensions";
import { insertImage } from "@/components/admin/article-editor/insert-image";

// ProseMirror pide medidas que jsdom no calcula.
beforeAll(() => {
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {} };
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
});
beforeEach(() => vi.clearAllMocks());

const M1 = "7f2b9c62-3c4d-4e5f-8a61-2c3d4e5f6071";
const M2 = "8a3c0d73-4d5e-4f60-9b72-3d4e5f607182";
const images = { [M1]: { src: `/media/${M1}`, alt: "Alt de Medios" } };

const imageNode = (attrs: { alt?: string | null; caption?: string | null } = {}) => ({
  type: "image",
  attrs: { mediaId: M1, alt: null, caption: null, ...attrs },
});

async function setup(attrs?: { alt?: string | null; caption?: string | null }, select = true) {
  const editor = new Editor({
    extensions: createExtensions({ ...images }),
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hola" }] }, imageNode(attrs)] },
  });
  render(<EditorContent editor={editor} />);
  await screen.findByRole("img");
  if (select) {
    act(() => {
      editor.commands.setNodeSelection(editor.state.doc.firstChild!.nodeSize);
    });
    await screen.findByRole("toolbar", { name: "Opciones de la imagen" });
  }
  const attrsNow = () => editor.getJSON().content?.[1].attrs;
  return { editor, attrsNow };
}

describe("ImageNodeView", () => {
  it("sin seleccionar no muestra la barra", async () => {
    await setup(undefined, false);
    expect(screen.queryByRole("toolbar", { name: "Opciones de la imagen" })).toBeNull();
  });

  it("seleccionada muestra sus cuatro botones", async () => {
    await setup();
    const bar = screen.getByRole("toolbar", { name: "Opciones de la imagen" });
    for (const name of ["Texto alternativo", "Pie de foto", "Cambiar imagen", "Quitar imagen"])
      expect(within(bar).getByRole("button", { name })).toBeInTheDocument();
  });

  it("la miniatura usa el alt propio y si no el de Medios", async () => {
    await setup({ alt: "Alt propio" }, false);
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Alt propio");
  });

  it("sin alt propio usa el de Medios", async () => {
    await setup(undefined, false);
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Alt de Medios");
  });

  it("aplicar un texto alternativo con espacios lo guarda con trim", async () => {
    const user = userEvent.setup();
    const { attrsNow } = await setup();
    await user.click(screen.getByRole("button", { name: "Texto alternativo" }));
    const group = await screen.findByRole("group", { name: "Texto alternativo" });
    expect(within(group).getByText(/Si lo dejás vacío se usa el de Medios: «Alt de Medios»\./)).toBeInTheDocument();
    await user.type(within(group).getByRole("textbox"), "Gráfico de ventas ");
    await user.click(within(group).getByRole("button", { name: "Aplicar" }));
    expect(attrsNow()).toMatchObject({ alt: "Gráfico de ventas" });
    expect(screen.queryByRole("group", { name: "Texto alternativo" })).toBeNull();
  });

  it("aplicar vacío o 'Usar el de Medios' deja alt en null", async () => {
    const user = userEvent.setup();
    const { attrsNow } = await setup({ alt: "Propio" });
    await user.click(screen.getByRole("button", { name: "Texto alternativo" }));
    let group = await screen.findByRole("group", { name: "Texto alternativo" });
    await user.clear(within(group).getByRole("textbox"));
    await user.type(within(group).getByRole("textbox"), "   ");
    await user.click(within(group).getByRole("button", { name: "Aplicar" }));
    expect(attrsNow()).toMatchObject({ alt: null });

    await user.click(screen.getByRole("button", { name: "Texto alternativo" }));
    group = await screen.findByRole("group", { name: "Texto alternativo" });
    await user.type(within(group).getByRole("textbox"), "Otro");
    await user.click(within(group).getByRole("button", { name: "Aplicar" }));
    expect(attrsNow()).toMatchObject({ alt: "Otro" });
    await user.click(screen.getByRole("button", { name: "Texto alternativo" }));
    group = await screen.findByRole("group", { name: "Texto alternativo" });
    await user.click(within(group).getByRole("button", { name: "Usar el de Medios" }));
    expect(attrsNow()).toMatchObject({ alt: null });
  });

  it("el pie se aplica, se muestra y 'Quitar pie' lo borra", async () => {
    const user = userEvent.setup();
    const { attrsNow } = await setup();
    await user.click(screen.getByRole("button", { name: "Pie de foto" }));
    const group = await screen.findByRole("group", { name: "Pie de foto" });
    expect(within(group).queryByText(/Si lo dejás vacío/)).toBeNull();
    await user.type(within(group).getByRole("textbox"), "Diagrama del flujo");
    await user.click(within(group).getByRole("button", { name: "Aplicar" }));
    expect(attrsNow()).toMatchObject({ caption: "Diagrama del flujo" });
    expect(await screen.findByText("Diagrama del flujo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pie de foto" }));
    await user.click(within(await screen.findByRole("group", { name: "Pie de foto" })).getByRole("button", { name: "Quitar pie" }));
    expect(attrsNow()).toMatchObject({ caption: null });
  });

  it("el input limita a 300 caracteres", async () => {
    const user = userEvent.setup();
    await setup();
    await user.click(screen.getByRole("button", { name: "Pie de foto" }));
    expect(within(await screen.findByRole("group", { name: "Pie de foto" })).getByRole("textbox")).toHaveAttribute("maxlength", "300");
  });

  it("Escape cierra el popover y devuelve el foco al editor sin cambiar nada", async () => {
    const user = userEvent.setup();
    const { editor, attrsNow } = await setup();
    await user.click(screen.getByRole("button", { name: "Texto alternativo" }));
    const group = await screen.findByRole("group", { name: "Texto alternativo" });
    await user.type(within(group).getByRole("textbox"), "x{Escape}");
    expect(screen.queryByRole("group", { name: "Texto alternativo" })).toBeNull();
    expect(attrsNow()).toMatchObject({ alt: null });
    // Tiptap enfoca en requestAnimationFrame.
    await waitFor(() => expect(editor.view.hasFocus()).toBe(true));
  });

  it("'Cambiar imagen' cambia mediaId, pone alt en null y conserva el pie", async () => {
    const user = userEvent.setup();
    searchMediaAction.mockResolvedValue({
      status: "success",
      items: [{ id: M2, src: `/media/${M2}`, alt: "Otra imagen", width: 10, height: 10 }],
      nextCursor: null,
    });
    const { attrsNow } = await setup({ alt: "Propio", caption: "Mi pie" });
    await user.click(screen.getByRole("button", { name: "Cambiar imagen" }));
    await user.click(await screen.findByRole("button", { name: "Otra imagen" }));
    await user.click(screen.getByRole("button", { name: "Insertar" }));
    await waitFor(() => expect(attrsNow()).toEqual({ mediaId: M2, alt: null, caption: "Mi pie" }));
    expect(await screen.findByRole("img")).toHaveAttribute("alt", "Otra imagen");
    expect(screen.queryByRole("dialog", { name: "Insertar imagen" })).toBeNull();
  });

  it("una imagen insertada que no estaba en el mapa inicial muestra su miniatura sin recargar", async () => {
    const { editor } = await setup(undefined, false);
    act(() => {
      insertImage(editor, { id: M2, src: `/media/${M2}`, alt: "Recién elegida" });
    });
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect(screen.getByRole("img", { name: "Recién elegida" })).toHaveAttribute("src", `/media/${M2}`);
  });

  it("'Quitar imagen' borra el nodo sin pedir confirmación, y Deshacer lo recupera", async () => {
    const user = userEvent.setup();
    const { editor } = await setup();
    await user.click(screen.getByRole("button", { name: "Quitar imagen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(editor.getJSON().content?.some((n) => n.type === "image")).toBe(false);
    act(() => {
      editor.commands.undo();
    });
    expect(editor.getJSON().content?.some((n) => n.type === "image")).toBe(true);
  });
});
