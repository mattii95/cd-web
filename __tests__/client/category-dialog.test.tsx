import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryDialog } from "@/app/(admin)/admin/categories/category-dialog";
import type { AdminCategoryRow } from "@/db/admin-categories";

const { save, notify } = vi.hoisted(() => ({ save: vi.fn(), notify: vi.fn() }));
vi.mock("@/actions/admin/categories", () => ({ saveCategoryAction: save }));
vi.mock("@/components/admin/toast", () => ({ notify }));

const existing = (over: Partial<AdminCategoryRow> = {}): AdminCategoryRow => ({
  id: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11",
  label: "Sistemas",
  filterLabel: "Sistemas",
  slug: "sistemas",
  serviceSlug: "sistemas-a-medida",
  icon: "layers",
  position: 1,
  published: 0,
  total: 0,
  ...over,
});

const nombre = () => screen.getByRole("textbox", { name: "Nombre" });
const filtro = () => screen.getByRole("textbox", { name: "Texto del filtro" });
const url = () => screen.getByRole("textbox", { name: "URL" });

beforeEach(() => {
  save.mockReset();
  notify.mockReset();
});

describe("CategoryDialog", () => {
  it("al crear, el texto del filtro y la URL siguen al nombre", async () => {
    const user = userEvent.setup();
    render(<CategoryDialog category={null} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Nueva categoría" })).toBeInTheDocument();
    await user.type(nombre(), "Marketing digital");
    expect(filtro()).toHaveValue("Marketing digital");
    expect(url()).toHaveValue("marketing-digital");
  });

  it("editar la URL a mano corta el seguimiento", async () => {
    const user = userEvent.setup();
    render(<CategoryDialog category={null} onClose={() => {}} />);
    await user.type(nombre(), "Marketing");
    await user.clear(url());
    await user.type(url(), "mkt");
    await user.type(nombre(), " digital");
    expect(url()).toHaveValue("mkt");
    expect(filtro()).toHaveValue("Marketing digital"); // el filtro sigue enganchado
  });

  it("editar el texto del filtro corta su seguimiento y borrarlo lo vuelve a enganchar", async () => {
    const user = userEvent.setup();
    render(<CategoryDialog category={null} onClose={() => {}} />);
    await user.type(nombre(), "Web");
    await user.clear(filtro());
    await user.type(filtro(), "W");
    await user.type(nombre(), "s");
    expect(filtro()).toHaveValue("W");
    await user.clear(filtro());
    await user.type(nombre(), "!");
    expect(filtro()).toHaveValue("Webs!");
  });

  it("con artículos publicados la URL es de solo lectura y lo explica", () => {
    render(<CategoryDialog category={existing({ published: 2, total: 2 })} onClose={() => {}} />);
    expect(url()).toHaveAttribute("readonly");
    expect(url()).toHaveAccessibleDescription(
      "La URL no cambia porque la categoría tiene artículos publicados.",
    );
  });

  it("sin publicados la URL se puede editar", () => {
    render(<CategoryDialog category={existing()} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Editar categoría" })).toBeInTheDocument();
    expect(url()).not.toHaveAttribute("readonly");
  });

  it("sin servicio ni ícono muestra los dos errores y enfoca el servicio", async () => {
    const user = userEvent.setup();
    render(<CategoryDialog category={null} onClose={() => {}} />);
    await user.type(nombre(), "Marketing");
    await user.click(screen.getByRole("button", { name: "Crear categoría" }));
    const servicio = screen.getByRole("combobox", { name: "Servicio del CTA" });
    expect(servicio).toBeInvalid();
    expect(servicio).toHaveAccessibleDescription("Elegí un servicio.");
    expect(screen.getByRole("radiogroup", { name: "Ícono" })).toHaveAccessibleDescription("Elegí un ícono.");
    expect(servicio).toHaveFocus();
    expect(save).not.toHaveBeenCalled();
  });

  it("el selector de ícono es un radiogroup que se recorre con flechas", async () => {
    const user = userEvent.setup();
    render(<CategoryDialog category={null} onClose={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Ícono" });
    const names = screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent);
    expect(names).toEqual(["Código", "Capas", "Nube", "Destellos", "Rayo", "Chat"]);
    expect(group).toBeInTheDocument();
    await user.tab(); // Nombre
    await user.click(screen.getByRole("radio", { name: "Código" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Capas" })).toBeChecked();
  });

  it("guarda con los datos del formulario, avisa y cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    save.mockResolvedValue({ status: "success", message: "Categoría creada." });
    render(<CategoryDialog category={null} onClose={onClose} />);
    await user.type(nombre(), "Marketing digital");
    await user.selectOptions(screen.getByRole("combobox", { name: "Servicio del CTA" }), "Desarrollo web");
    await user.click(screen.getByRole("radio", { name: "Rayo" }));
    await user.click(screen.getByRole("button", { name: "Crear categoría" }));

    const data = save.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(data)).toEqual({
      id: "",
      label: "Marketing digital",
      filterLabel: "Marketing digital",
      slug: "marketing-digital",
      serviceSlug: "desarrollo-web",
      icon: "bolt",
    });
    expect(notify).toHaveBeenCalledWith({ status: "success", message: "Categoría creada." });
    expect(onClose).toHaveBeenCalled();
  });

  it("muestra el error del servidor debajo del campo y no cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    save.mockResolvedValue({ status: "error", fieldErrors: { slug: "Ya hay una categoría con esa URL." } });
    render(<CategoryDialog category={existing()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(url()).toBeInvalid();
    expect(url()).toHaveAccessibleDescription("Ya hay una categoría con esa URL.");
    expect(url()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Cancelar cierra sin guardar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CategoryDialog category={null} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
