import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagDialog } from "@/app/(admin)/admin/tags/tag-dialog";
import type { AdminTagRow } from "@/db/admin-tags";

const { save, notify } = vi.hoisted(() => ({ save: vi.fn(), notify: vi.fn() }));
vi.mock("@/actions/admin/tags", () => ({ saveTagAction: save }));
vi.mock("@/components/admin/toast", () => ({ notify }));

const existing = (over: Partial<AdminTagRow> = {}): AdminTagRow => ({
  id: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11",
  slug: "seo",
  name: "SEO",
  published: 0,
  total: 0,
  ...over,
});
const nombre = () => screen.getByRole("textbox", { name: "Nombre" });
const url = () => screen.getByRole("textbox", { name: "URL" });

beforeEach(() => {
  save.mockReset();
  notify.mockReset();
});

describe("TagDialog", () => {
  it("al crear, la URL sigue al nombre hasta que se edita a mano", async () => {
    const user = userEvent.setup();
    render(<TagDialog tag={null} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Nueva etiqueta" })).toBeInTheDocument();
    await user.type(nombre(), "Atención al cliente");
    expect(url()).toHaveValue("atencion-al-cliente");
    await user.clear(url());
    await user.type(url(), "cliente");
    await user.type(nombre(), "s");
    expect(url()).toHaveValue("cliente");
  });

  it("con artículos publicados la URL es de solo lectura y lo explica", async () => {
    const user = userEvent.setup();
    render(<TagDialog tag={existing({ published: 3, total: 3 })} onClose={() => {}} />);
    expect(url()).toHaveAttribute("readonly");
    expect(url()).toHaveAccessibleDescription("La URL no cambia porque la etiqueta tiene artículos publicados.");
    // Renombrar no mueve la URL bloqueada.
    await user.clear(nombre());
    await user.type(nombre(), "Posicionamiento");
    expect(url()).toHaveValue("seo");
  });

  it("sin publicados la URL se puede editar", () => {
    render(<TagDialog tag={existing()} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Editar etiqueta" })).toBeInTheDocument();
    expect(url()).not.toHaveAttribute("readonly");
  });

  it("sin nombre muestra el error y enfoca el campo, sin llamar al servidor", async () => {
    const user = userEvent.setup();
    render(<TagDialog tag={null} onClose={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Crear etiqueta" }));
    expect(nombre()).toBeInvalid();
    expect(nombre()).toHaveFocus();
    expect(save).not.toHaveBeenCalled();
  });

  it("guarda, avisa y cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    save.mockResolvedValue({ status: "success", message: "Etiqueta creada." });
    render(<TagDialog tag={null} onClose={onClose} />);
    await user.type(nombre(), "Nube");
    await user.click(screen.getByRole("button", { name: "Crear etiqueta" }));
    expect(Object.fromEntries(save.mock.calls[0][1] as FormData)).toEqual({ id: "", name: "Nube", slug: "nube" });
    expect(notify).toHaveBeenCalledWith({ status: "success", message: "Etiqueta creada." });
    expect(onClose).toHaveBeenCalled();
  });

  it("el error de nombre repetido sale debajo del campo y no cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const message = "Ya hay una etiqueta con ese nombre. Usá «Fusionar con…» para unirlas.";
    save.mockResolvedValue({ status: "error", fieldErrors: { name: message } });
    render(<TagDialog tag={existing()} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(nombre()).toHaveAccessibleDescription(message);
    expect(nombre()).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Cancelar cierra sin guardar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TagDialog tag={null} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
