import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PickerItem } from "@/actions/admin/media";
import { MediaPicker } from "@/components/admin/media-picker/media-picker";

const { searchMediaAction, uploadPickerMediaAction } = vi.hoisted(() => ({
  searchMediaAction: vi.fn(),
  uploadPickerMediaAction: vi.fn(),
}));

vi.mock("@/actions/admin/media", () => ({ searchMediaAction, uploadPickerMediaAction }));

const item = (n: number): PickerItem => ({
  id: `id-${n}`,
  src: `/media/id-${n}`,
  alt: `Alt ${n}`,
  width: 1920,
  height: 1080,
});
const page = (from: number, to: number, nextCursor: string | null = null) => ({
  status: "success" as const,
  items: Array.from({ length: to - from + 1 }, (_, i) => item(from + i)),
  nextCursor,
});

const setup = (over: Partial<Parameters<typeof MediaPicker>[0]> = {}) => {
  const props = { open: true, mode: "body" as const, onSelect: vi.fn(), onClose: vi.fn(), ...over };
  render(<MediaPicker {...props} />);
  return props;
};

beforeEach(() => {
  vi.clearAllMocks();
  searchMediaAction.mockResolvedValue(page(1, 3));
});

describe("MediaPicker", () => {
  it("en modo cover usa 'Elegir portada' y 'Usar como portada'; en body, 'Insertar imagen' e 'Insertar'", async () => {
    const { unmount } = render(
      <MediaPicker open mode="cover" onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByRole("dialog", { name: "Elegir portada" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Usar como portada" })).toBeTruthy();
    unmount();
    setup();
    expect(screen.getByRole("dialog", { name: "Insertar imagen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Insertar" })).toBeTruthy();
  });

  it("abre en Biblioteca, con dos pestañas", async () => {
    setup();
    expect(screen.getByRole("tab", { name: "Biblioteca" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Subir imagen" })).toHaveAttribute("aria-selected", "false");
    expect(await screen.findByRole("button", { name: "Alt 1" })).toBeTruthy();
  });

  it("el botón principal está deshabilitado hasta elegir; la elegida tiene aria-pressed", async () => {
    const props = setup();
    const primary = screen.getByRole("button", { name: "Insertar" });
    expect(primary).toBeDisabled();
    const thumb = await screen.findByRole("button", { name: "Alt 2" });
    expect(thumb).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(thumb);
    expect(thumb).toHaveAttribute("aria-pressed", "true");
    expect(primary).toBeEnabled();
    await userEvent.click(primary);
    expect(props.onSelect).toHaveBeenCalledWith(item(2));
  });

  it("doble clic sobre una miniatura la confirma", async () => {
    const props = setup();
    await userEvent.dblClick(await screen.findByRole("button", { name: "Alt 3" }));
    expect(props.onSelect).toHaveBeenCalledWith(item(3));
  });

  it("en modo cover con selectedId, esa miniatura aparece elegida al abrir", async () => {
    setup({ mode: "cover", selectedId: "id-2" });
    expect(await screen.findByRole("button", { name: "Alt 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Usar como portada" })).toBeEnabled();
  });

  it("escribir busca una sola vez, 300 ms después de la última tecla", async () => {
    setup();
    await screen.findByRole("button", { name: "Alt 1" });
    expect(searchMediaAction).toHaveBeenCalledTimes(1);
    expect(searchMediaAction).toHaveBeenLastCalledWith({ query: "", cursor: null });
    await userEvent.type(screen.getByRole("searchbox"), "equipo");
    expect(searchMediaAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(searchMediaAction).toHaveBeenCalledTimes(2));
    expect(searchMediaAction).toHaveBeenLastCalledWith({ query: "equipo", cursor: null });
  });

  it("'Cargar más' agrega miniaturas sin quitar las anteriores y desaparece sin nextCursor", async () => {
    searchMediaAction.mockResolvedValueOnce(page(1, 2, "c2")).mockResolvedValueOnce(page(3, 4));
    setup();
    await screen.findByRole("button", { name: "Alt 1" });
    await userEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(await screen.findByRole("button", { name: "Alt 4" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Alt 1" })).toBeTruthy();
    expect(searchMediaAction).toHaveBeenLastCalledWith({ query: "", cursor: "c2" });
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("biblioteca vacía invita a subir, y el enlace abre 'Subir imagen'", async () => {
    searchMediaAction.mockResolvedValue({ status: "success", items: [], nextCursor: null });
    setup();
    expect(await screen.findByText(/Todavía no hay imágenes\./)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Subí la primera." }));
    expect(screen.getByRole("tab", { name: "Subir imagen" })).toHaveAttribute("aria-selected", "true");
  });

  it("sin resultados nombra la búsqueda", async () => {
    setup();
    await screen.findByRole("button", { name: "Alt 1" });
    searchMediaAction.mockResolvedValue({ status: "success", items: [], nextCursor: null });
    await userEvent.type(screen.getByRole("searchbox"), "xyz");
    expect(await screen.findByText("No hay imágenes que coincidan con «xyz».")).toBeTruthy();
  });

  it("un error muestra el mensaje y 'Reintentar' vuelve a pedir", async () => {
    searchMediaAction
      .mockResolvedValueOnce({ status: "error", message: "No pudimos cargar las imágenes." })
      .mockResolvedValueOnce(page(1, 1));
    setup();
    expect(await screen.findByText("No pudimos cargar las imágenes.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Alt 1" })).toBeTruthy();
    expect(screen.queryByText("No pudimos cargar las imágenes.")).toBeNull();
  });

  it("subir con éxito vuelve a Biblioteca con la imagen primera y elegida, y lo anuncia", async () => {
    uploadPickerMediaAction.mockResolvedValue({
      status: "success",
      message: "Imagen subida.",
      item: item(9),
    });
    setup();
    await screen.findByRole("button", { name: "Alt 1" });
    await userEvent.click(screen.getByRole("tab", { name: "Subir imagen" }));
    await userEvent.upload(
      screen.getByLabelText("Imagen"),
      new File(["x"], "a.png", { type: "image/png" }),
    );
    await userEvent.type(screen.getByLabelText("Texto alternativo"), "Nueva");
    // jsdom no ve el archivo de userEvent.upload en la validación `required`: se envía el form directo.
    fireEvent.submit(screen.getByRole("button", { name: "Subir imagen" }).closest("form")!);

    const nueva = await screen.findByRole("button", { name: "Alt 9" });
    expect(screen.getByRole("tab", { name: "Biblioteca" })).toHaveAttribute("aria-selected", "true");
    expect(nueva).toHaveAttribute("aria-pressed", "true");
    const grid = screen.getAllByRole("listitem");
    expect(grid[0]).toContainElement(nueva);
    expect(screen.getByRole("status")).toHaveTextContent("Imagen subida.");
  });

  it("un error de subida se muestra bajo el formulario", async () => {
    uploadPickerMediaAction.mockResolvedValue({ status: "error", message: "El archivo no es una imagen." });
    setup();
    await userEvent.click(screen.getByRole("tab", { name: "Subir imagen" }));
    await userEvent.upload(
      screen.getByLabelText("Imagen"),
      new File(["x"], "a.png", { type: "image/png" }),
    );
    await userEvent.type(screen.getByLabelText("Texto alternativo"), "Algo");
    // jsdom no ve el archivo de userEvent.upload en la validación `required`: se envía el form directo.
    fireEvent.submit(screen.getByRole("button", { name: "Subir imagen" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("El archivo no es una imagen.");
  });

  it("Escape y Cancelar llaman a onClose sin llamar a onSelect", async () => {
    const props = setup();
    await screen.findByRole("button", { name: "Alt 1" });
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(props.onClose).toHaveBeenCalledTimes(3);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("cerrado no se ve", () => {
    setup({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(searchMediaAction).not.toHaveBeenCalled();
  });
});
