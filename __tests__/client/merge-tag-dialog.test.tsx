import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MergeTagDialog } from "@/app/(admin)/admin/tags/merge-tag-dialog";
import type { AdminTagRow } from "@/db/admin-tags";

const { merge, search, notify } = vi.hoisted(() => ({ merge: vi.fn(), search: vi.fn(), notify: vi.fn() }));
vi.mock("@/actions/admin/tags", () => ({ mergeTagsAction: merge, searchTagOptionsAction: search }));
vi.mock("@/components/admin/toast", () => ({ notify }));

const source: AdminTagRow = {
  id: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11",
  slug: "seo",
  name: "SEO",
  published: 3,
  total: 4,
};
const SEM = { id: "7d2f0a52-3a43-4e1e-8f17-5c7b2c6b9d01", name: "SEM", total: 2 };

const combo = () => screen.getByRole("combobox", { name: "Etiqueta que queda" });
const fusionar = () => screen.getByRole("button", { name: "Fusionar" });

beforeEach(() => {
  merge.mockReset();
  search.mockReset();
  notify.mockReset();
  search.mockResolvedValue([SEM]);
});

describe("MergeTagDialog", () => {
  it("el título nombra la etiqueta de origen y Fusionar empieza deshabilitado", () => {
    render(<MergeTagDialog source={source} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Fusionar «SEO»" })).toBeInTheDocument();
    expect(fusionar()).toBeDisabled();
  });

  it("busca en el servidor sin la etiqueta de origen", async () => {
    const user = userEvent.setup();
    render(<MergeTagDialog source={source} onClose={() => {}} />);
    await user.type(combo(), "se");
    expect(await screen.findByRole("option", { name: /SEM/ })).toBeInTheDocument();
    await waitFor(() => expect(search).toHaveBeenLastCalledWith({ query: "se", excludeId: source.id }));
  });

  it("al elegir el destino habilita Fusionar y explica qué pasa", async () => {
    const user = userEvent.setup();
    render(<MergeTagDialog source={source} onClose={() => {}} />);
    await user.click(combo());
    await user.click(await screen.findByRole("option", { name: /SEM/ }));
    expect(fusionar()).toBeEnabled();
    expect(
      screen.getByText("Los 4 artículos de «SEO» pasan a «SEM» y «SEO» se borra. No se puede deshacer."),
    ).toBeInTheDocument();
  });

  it("escribir de nuevo después de elegir vuelve a deshabilitar Fusionar", async () => {
    const user = userEvent.setup();
    render(<MergeTagDialog source={source} onClose={() => {}} />);
    await user.click(combo());
    await user.click(await screen.findByRole("option", { name: /SEM/ }));
    await user.type(combo(), "x");
    expect(fusionar()).toBeDisabled();
  });

  it("con el teclado Enter elige la opción resaltada sin enviar el formulario", async () => {
    const user = userEvent.setup();
    render(<MergeTagDialog source={source} onClose={() => {}} />);
    await user.click(combo());
    await screen.findByRole("option", { name: /SEM/ });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(combo()).toHaveValue("SEM");
    expect(merge).not.toHaveBeenCalled();
  });

  it("fusiona con los ids, avisa y cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    merge.mockResolvedValue({ status: "success", message: "Listo: 4 artículos pasaron a «SEM»." });
    render(<MergeTagDialog source={source} onClose={onClose} />);
    await user.click(combo());
    await user.click(await screen.findByRole("option", { name: /SEM/ }));
    await user.click(fusionar());
    expect(Object.fromEntries(merge.mock.calls[0][1] as FormData)).toEqual({
      sourceId: source.id,
      targetId: SEM.id,
    });
    expect(notify).toHaveBeenCalledWith({ status: "success", message: "Listo: 4 artículos pasaron a «SEM»." });
    expect(onClose).toHaveBeenCalled();
  });

  it("si la fusión falla muestra el error y no cierra", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    merge.mockResolvedValue({ status: "error", message: "Esa etiqueta ya no existe." });
    render(<MergeTagDialog source={source} onClose={onClose} />);
    await user.click(combo());
    await user.click(await screen.findByRole("option", { name: /SEM/ }));
    await user.click(fusionar());
    expect(notify).toHaveBeenCalledWith({ status: "error", message: "Esa etiqueta ya no existe." });
    expect(onClose).not.toHaveBeenCalled();
  });
});
