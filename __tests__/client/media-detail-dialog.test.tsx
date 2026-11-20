import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardItem } from "@/app/(admin)/admin/media/card-item";
import { MediaDetailDialog } from "@/app/(admin)/admin/media/media-detail-dialog";
import { AdminToaster } from "@/components/admin/toast";

const { updateMediaAction, deleteMediaAction } = vi.hoisted(() => ({
  updateMediaAction: vi.fn(),
  deleteMediaAction: vi.fn(),
}));
vi.mock("@/actions/admin/media", () => ({ updateMediaAction, deleteMediaAction }));

const card = (n: number, usage: CardItem["usage"] = []): CardItem => ({
  id: `3f2b8c1e-9d4a-4c7e-8b21-5a6f0e9d1c3${n}`,
  src: `/media/id-${n}`,
  alt: `Alt ${n}`,
  originalName: `f${n}.webp`,
  width: 1920,
  height: 1080,
  bytes: 204800,
  usage,
  date: "16 nov 2026",
});

const used = (n: number) =>
  card(n, [
    { postId: "p1", title: "Señales", as: "portada" },
    { postId: "p2", title: "Otro", as: "cuerpo" },
  ]);

// Hace de grilla: guarda la imagen abierta, los cambios y los borrados.
function Harness({ initial, start = 0, onClose = vi.fn() }: { initial: CardItem[]; start?: number; onClose?: () => void }) {
  const [items, setItems] = useState(initial);
  const [id, setId] = useState<string | null>(initial[start].id);
  return (
    <>
      <button type="button">miniatura</button>
      {id && (
        <MediaDetailDialog
          items={items}
          id={id}
          onNavigate={setId}
          onClose={() => {
            onClose();
            setId(null);
          }}
          onSaved={(sid, changes) => setItems((p) => p.map((m) => (m.id === sid ? { ...m, ...changes } : m)))}
          onDeleted={(did) => {
            setItems((p) => p.filter((m) => m.id !== did));
            setId(null);
          }}
        />
      )}
      <AdminToaster />
    </>
  );
}

describe("MediaDetailDialog", () => {
  beforeEach(() => {
    updateMediaAction.mockReset();
    deleteMediaAction.mockReset();
  });

  it("muestra alt, nombre, medidas, peso, fecha y el uso con enlaces a los editores", () => {
    render(<Harness initial={[used(1)]} />);
    const dialog = screen.getByRole("dialog", { name: "Alt 1" });
    expect(within(dialog).getByText("f1.webp")).toBeInTheDocument();
    expect(within(dialog).getByText("1920 × 1080 px")).toBeInTheDocument();
    expect(within(dialog).getByText("200 KB")).toBeInTheDocument();
    expect(within(dialog).getByText("16 nov 2026")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Señales · portada" })).toHaveAttribute("href", "/admin/articles/p1/edit");
    expect(within(dialog).getByRole("link", { name: "Otro · cuerpo" })).toHaveAttribute("href", "/admin/articles/p2/edit");
  });

  it("sin uso dice 'Sin usar' y Borrar está habilitado", () => {
    render(<Harness initial={[card(1)]} />);
    expect(screen.getByText("Sin usar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar" })).toBeEnabled();
  });

  it("con uso, Borrar está deshabilitado y explica por qué", () => {
    render(<Harness initial={[used(1)]} />);
    expect(screen.getByRole("button", { name: "Borrar" })).toBeDisabled();
    expect(screen.getByText("Está en uso: quitala de esos artículos para borrarla.")).toBeInTheDocument();
  });

  it("'Abrir original' apunta a /media/{id} en otra pestaña", () => {
    render(<Harness initial={[card(1)]} />);
    const link = screen.getByRole("link", { name: "Abrir original" });
    expect(link).toHaveAttribute("href", "/media/id-1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  it("copia la URL y el id y lo anuncia", async () => {
    const user = userEvent.setup(); // instala su propio portapapeles: el espía va después
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Harness initial={[card(1)]} />);

    await user.click(screen.getByRole("button", { name: "Copiar URL" }));
    expect(writeText).toHaveBeenLastCalledWith(`${location.origin}/media/id-1`);
    expect(await screen.findByText("URL copiada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copiar id" }));
    expect(writeText).toHaveBeenLastCalledWith(card(1).id);
    expect(await screen.findByText("Id copiado")).toBeInTheDocument();
  });

  describe("editar", () => {
    it("sobre una imagen en uso muestra el aviso con los títulos; sin uso no", async () => {
      const user = userEvent.setup();
      const { unmount } = render(<Harness initial={[used(1)]} />);
      await user.click(screen.getByRole("button", { name: "Editar" }));
      expect(screen.getByText(/Esta imagen está en uso en: Señales, Otro\./)).toBeInTheDocument();
      unmount();

      render(<Harness initial={[card(1)]} />);
      await user.click(screen.getByRole("button", { name: "Editar" }));
      expect(screen.queryByText(/Esta imagen está en uso en/)).toBeNull();
    });

    it("con alt vacío muestra el error, enfoca el campo y no llama a la action", async () => {
      const user = userEvent.setup();
      render(<Harness initial={[card(1)]} />);
      await user.click(screen.getByRole("button", { name: "Editar" }));
      const alt = screen.getByRole("textbox", { name: "Texto alternativo" });
      await user.clear(alt);
      await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

      expect(await screen.findByText("El texto alternativo no puede estar vacío.")).toBeInTheDocument();
      expect(alt).toHaveAttribute("aria-invalid", "true");
      expect(alt).toHaveFocus();
      expect(updateMediaAction).not.toHaveBeenCalled();
    });

    it("al guardar avisa, vuelve a los datos y el título muestra el alt nuevo", async () => {
      const user = userEvent.setup();
      updateMediaAction.mockResolvedValue({ status: "success", message: "Cambios guardados." });
      render(<Harness initial={[card(1)]} />);
      await user.click(screen.getByRole("button", { name: "Editar" }));
      const alt = screen.getByRole("textbox", { name: "Texto alternativo" });
      await user.clear(alt);
      await user.type(alt, "  Nuevo alt ");
      await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

      expect(await screen.findByText("Cambios guardados.")).toBeInTheDocument();
      const data = updateMediaAction.mock.calls[0][1] as FormData;
      expect(data.get("id")).toBe(card(1).id);
      expect(data.get("originalName")).toBe("f1.webp");
      expect(await screen.findByRole("heading", { name: "Nuevo alt" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    });

    it("Cancelar vuelve a los datos sin llamar a la action", async () => {
      const user = userEvent.setup();
      render(<Harness initial={[card(1)]} />);
      await user.click(screen.getByRole("button", { name: "Editar" }));
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(updateMediaAction).not.toHaveBeenCalled();
    });
  });

  describe("borrar", () => {
    it("pide confirmación y, al confirmar, avisa y cierra el modal", async () => {
      const user = userEvent.setup();
      deleteMediaAction.mockResolvedValue({ status: "success", message: "Imagen borrada." });
      render(<Harness initial={[card(1), card(2)]} />);
      await user.click(screen.getByRole("button", { name: "Borrar" }));
      const confirm = screen.getByRole("dialog", { name: "¿Borrar la imagen?" });
      expect(deleteMediaAction).not.toHaveBeenCalled();

      await user.click(within(confirm).getByRole("button", { name: "Borrar" }));
      await waitFor(() => expect(deleteMediaAction).toHaveBeenCalledTimes(1));
      expect((deleteMediaAction.mock.calls[0][1] as FormData).get("id")).toBe(card(1).id);
      expect(await screen.findByText("Imagen borrada.")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("si la action falla muestra el error y el modal sigue abierto", async () => {
      const user = userEvent.setup();
      deleteMediaAction.mockResolvedValue({ status: "error", message: "Esa imagen ya no existe." });
      render(<Harness initial={[card(1)]} />);
      await user.click(screen.getByRole("button", { name: "Borrar" }));
      await user.click(within(screen.getByRole("dialog", { name: "¿Borrar la imagen?" })).getByRole("button", { name: "Borrar" }));
      expect(await screen.findByText("Esa imagen ya no existe.")).toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Alt 1" })).toBeInTheDocument();
    });
  });

  describe("navegación", () => {
    const three = [card(1), card(2), card(3)];

    it("→ pasa a la siguiente y ← a la anterior; muestra la posición", () => {
      render(<Harness initial={three} />);
      expect(screen.getByText("1 de 3")).toBeInTheDocument();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
      expect(screen.getByRole("dialog", { name: "Alt 2" })).toBeInTheDocument();
      expect(screen.getByText("2 de 3")).toBeInTheDocument();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
      expect(screen.getByRole("dialog", { name: "Alt 1" })).toBeInTheDocument();
    });

    it("en la primera 'Imagen anterior' está deshabilitado y en la última 'Imagen siguiente'", () => {
      const { unmount } = render(<Harness initial={three} />);
      expect(screen.getByRole("button", { name: "Imagen anterior" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Imagen siguiente" })).toBeEnabled();
      unmount();
      render(<Harness initial={three} start={2} />);
      expect(screen.getByRole("button", { name: "Imagen siguiente" })).toBeDisabled();
    });

    it("los botones navegan", async () => {
      const user = userEvent.setup();
      render(<Harness initial={three} />);
      await user.click(screen.getByRole("button", { name: "Imagen siguiente" }));
      expect(screen.getByRole("dialog", { name: "Alt 2" })).toBeInTheDocument();
    });

    it("con el foco en un input no navega, ni mientras se edita", async () => {
      const user = userEvent.setup();
      render(<Harness initial={three} />);
      await user.click(screen.getByRole("button", { name: "Editar" }));
      const alt = screen.getByRole("textbox", { name: "Texto alternativo" });
      fireEvent.keyDown(alt, { key: "ArrowRight" });
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
      expect(screen.getByRole("dialog", { name: "Alt 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Imagen siguiente" })).toBeDisabled();
    });
  });

  it("Escape cierra", () => {
    const onClose = vi.fn();
    render(<Harness initial={[card(1)]} onClose={onClose} />);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("el botón Cerrar cierra", async () => {
    const onClose = vi.fn();
    render(<Harness initial={[card(1)]} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("al cerrar devuelve el foco a quien lo abrió", async () => {
    const user = userEvent.setup();

    function Opener() {
      const [open, setOpen] = useState(false);
      const items = [card(1)];
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            miniatura
          </button>
          {open && (
            <MediaDetailDialog items={items} id={items[0].id} onNavigate={() => {}} onClose={() => setOpen(false)} onSaved={() => {}} onDeleted={() => {}} />
          )}
        </>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "miniatura" });
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(opener).toHaveFocus();
  });
});
