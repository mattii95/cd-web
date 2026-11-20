import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadDialog } from "@/app/(admin)/admin/media/upload-dialog";

const { uploadMediaAction } = vi.hoisted(() => ({ uploadMediaAction: vi.fn() }));
vi.mock("@/actions/admin/media", () => ({ uploadMediaAction }));

const createObjectURL = vi.fn((f: File) => `blob:${f.name}`);
const revokeObjectURL = vi.fn();
Object.assign(URL, { createObjectURL, revokeObjectURL });

const png = (name: string, size = 1024) => {
  const f = new File(["x"], name, { type: "image/png" });
  Object.defineProperty(f, "size", { value: size });
  return f;
};
const pick = (...files: File[]) =>
  fireEvent.change(screen.getByLabelText("Elegir archivos"), { target: { files } });
const altOf = (name: string) => screen.getByRole("textbox", { name: `Texto alternativo de ${name}` });
const fillAlts = async (user: ReturnType<typeof userEvent.setup>, ...names: string[]) => {
  for (const n of names) await user.type(altOf(n), `Alt ${n}`);
};
const cancel = () => fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));

describe("UploadDialog", () => {
  beforeEach(() => {
    uploadMediaAction.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    uploadMediaAction.mockResolvedValue({ status: "success", message: "Imagen subida." });
  });

  it("agregar 12 archivos deja 10 filas y avisa del límite", () => {
    render(<UploadDialog onClose={vi.fn()} />);
    pick(...Array.from({ length: 12 }, (_, i) => png(`f${i}.png`)));
    expect(screen.getAllByRole("textbox")).toHaveLength(10);
    expect(screen.getByText("Podés subir hasta 10 imágenes a la vez.")).toBeInTheDocument();
  });

  it("un .gif entra como fila con el error y no cuenta en 'Subir N imágenes'", () => {
    render(<UploadDialog onClose={vi.fn()} />);
    pick(png("a.png"), new File(["x"], "b.gif", { type: "image/gif" }));
    expect(screen.getByText(/^Formato no soportado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir 1 imagen" })).toBeInTheDocument();
  });

  it("un archivo de más de 10 MB entra con el error de tamaño", () => {
    render(<UploadDialog onClose={vi.fn()} />);
    pick(png("grande.png", 10 * 1024 * 1024 + 1));
    expect(screen.getByText("La imagen supera el máximo de 10 MB.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir 0 imágenes" })).toBeDisabled();
  });

  it("'Subir N imágenes' está deshabilitado mientras falte un alt", async () => {
    const user = userEvent.setup();
    render(<UploadDialog onClose={vi.fn()} />);
    pick(png("a.png"), png("b.png"));
    expect(screen.getByRole("button", { name: "Subir 2 imágenes" })).toBeDisabled();
    await fillAlts(user, "a.png");
    expect(screen.getByRole("button", { name: "Subir 2 imágenes" })).toBeDisabled();
    await fillAlts(user, "b.png");
    expect(screen.getByRole("button", { name: "Subir 2 imágenes" })).toBeEnabled();
  });

  it("Quitar saca la fila y libera su vista previa", async () => {
    const user = userEvent.setup();
    render(<UploadDialog onClose={vi.fn()} />);
    pick(png("a.png"), png("b.png"));
    await user.click(screen.getByRole("button", { name: "Quitar a.png" }));
    expect(screen.queryByRole("textbox", { name: "Texto alternativo de a.png" })).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:a.png");
  });

  it("sube de a uno y en orden con el alt recortado", async () => {
    const user = userEvent.setup();
    render(<UploadDialog onClose={vi.fn()} />);
    pick(png("a.png"), png("b.png"));
    await user.type(altOf("a.png"), "  Primera ");
    await fillAlts(user, "b.png");
    await user.click(screen.getByRole("button", { name: "Subir 2 imágenes" }));

    await screen.findByText("Se subieron 2.");
    expect(uploadMediaAction).toHaveBeenCalledTimes(2);
    const [first, second] = uploadMediaAction.mock.calls.map((c) => c[1] as FormData);
    expect((first.get("file") as File).name).toBe("a.png");
    expect(first.get("alt")).toBe("Primera");
    expect((second.get("file") as File).name).toBe("b.png");
    expect(screen.getAllByText("Subida.")).toHaveLength(2);
  });

  it("si la action falla en el segundo, sube el primero y el tercero y deja Reintentar", async () => {
    const user = userEvent.setup();
    uploadMediaAction
      .mockResolvedValueOnce({ status: "success", message: "Imagen subida." })
      .mockResolvedValueOnce({ status: "error", message: "La imagen supera los 40 megapíxeles." })
      .mockResolvedValueOnce({ status: "success", message: "Imagen subida." });
    render(<UploadDialog onClose={vi.fn()} />);
    pick(png("a.png"), png("b.png"), png("c.png"));
    await fillAlts(user, "a.png", "b.png", "c.png");
    await user.click(screen.getByRole("button", { name: "Subir 3 imágenes" }));

    expect(await screen.findByText("Se subieron 2. 1 con error.")).toBeInTheDocument();
    expect(screen.getByText("La imagen supera los 40 megapíxeles.")).toBeInTheDocument();

    uploadMediaAction.mockResolvedValueOnce({ status: "success", message: "Imagen subida." });
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Se subieron 3.")).toBeInTheDocument();
    expect(uploadMediaAction).toHaveBeenCalledTimes(4);
  });

  it("una imagen repetida queda como 'Esa imagen ya estaba subida.'", async () => {
    const user = userEvent.setup();
    uploadMediaAction.mockResolvedValue({ status: "success", message: "Esa imagen ya estaba subida." });
    render(<UploadDialog onClose={vi.fn()} />);
    pick(png("a.png"));
    await fillAlts(user, "a.png");
    await user.click(screen.getByRole("button", { name: "Subir 1 imagen" }));
    expect(await screen.findByText("1 ya estaban.")).toBeInTheDocument();
    expect(screen.getByText("Esa imagen ya estaba subida.")).toBeInTheDocument();
  });

  it("al terminar el botón pasa a 'Listo' y cierra sin preguntar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<UploadDialog onClose={onClose} />);
    pick(png("a.png"));
    await fillAlts(user, "a.png");
    await user.click(screen.getByRole("button", { name: "Subir 1 imagen" }));
    await user.click(await screen.findByRole("button", { name: "Listo" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mientras sube, Escape, Cancelar y Cerrar no cierran", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let resolve!: (v: unknown) => void;
    uploadMediaAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<UploadDialog onClose={onClose} />);
    pick(png("a.png"));
    await fillAlts(user, "a.png");
    await user.click(screen.getByRole("button", { name: "Subir 1 imagen" }));

    expect(await screen.findByText("Subiendo…", { selector: "p" })).toBeInTheDocument();
    cancel();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Quitar a.png" })).toBeNull(); // la fila que sube no se quita
    expect(screen.getByLabelText("Elegir archivos")).toBeDisabled();
    expect(screen.queryByText(/sin subir/)).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => resolve({ status: "success", message: "Imagen subida." }));
    await screen.findByText("Se subieron 1.");
  });

  describe("cerrar con filas sin subir", () => {
    const setup = async (onClose = vi.fn()) => {
      const user = userEvent.setup();
      render(<UploadDialog onClose={onClose} />);
      pick(png("a.png"), png("b.png"));
      return { user, onClose };
    };

    it("Cancelar, Cerrar y Escape piden confirmación y enfocan 'Seguir editando'", async () => {
      const { user, onClose } = await setup();
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.getByText("Tenés 2 imágenes sin subir. ¿Descartarlas?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Seguir editando" })).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Seguir editando" }));
      await user.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(screen.getByText(/Tenés 2 imágenes sin subir/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Seguir editando" }));
      cancel();
      expect(screen.getByText(/Tenés 2 imágenes sin subir/)).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("usa el singular con una sola fila", async () => {
      const user = userEvent.setup();
      render(<UploadDialog onClose={vi.fn()} />);
      pick(png("a.png"));
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      expect(screen.getByText("Tenés 1 imagen sin subir. ¿Descartarla?")).toBeInTheDocument();
    });

    it("'Seguir editando' y un segundo Escape vuelven al pie normal con las filas intactas", async () => {
      const { user } = await setup();
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      await user.click(screen.getByRole("button", { name: "Seguir editando" }));
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(screen.getAllByRole("textbox")).toHaveLength(2);

      cancel(); // primer Escape: pregunta
      expect(screen.getByRole("button", { name: "Seguir editando" })).toBeInTheDocument();
      cancel(); // segundo Escape: equivale a Seguir editando
      expect(screen.queryByRole("button", { name: "Seguir editando" })).toBeNull();
      expect(screen.getAllByRole("textbox")).toHaveLength(2);
    });

    it("'Descartar' llama a onClose y libera las vistas previas", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const { unmount } = render(<UploadDialog onClose={onClose} />);
      pick(png("a.png"), png("b.png"));
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      await user.click(screen.getByRole("button", { name: "Descartar" }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(uploadMediaAction).not.toHaveBeenCalled();
      unmount(); // lo que hace el padre al cerrar
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:a.png");
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:b.png");
    });

    it("al desmontar libera las vistas previas", async () => {
      const { unmount } = render(<UploadDialog onClose={vi.fn()} />);
      pick(png("a.png"));
      unmount();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:a.png");
    });
  });

  it("con la cola vacía cerrar no pregunta", async () => {
    const onClose = vi.fn();
    render(<UploadDialog onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("una fila con solo el error de formato no cuenta como sin subir", async () => {
    const onClose = vi.fn();
    render(<UploadDialog onClose={onClose} />);
    pick(new File(["x"], "b.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("soltar archivos en la zona los agrega", () => {
    render(<UploadDialog onClose={vi.fn()} />);
    const zone = screen.getByText("Arrastrá imágenes acá o elegí archivos").parentElement as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [png("a.png")] } });
    expect(within(screen.getByRole("dialog")).getByRole("textbox", { name: "Texto alternativo de a.png" })).toBeInTheDocument();
  });
});
