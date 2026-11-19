import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaToolbar } from "@/app/(admin)/admin/media/media-toolbar";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

describe("MediaToolbar", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("escribir llama a router.replace una sola vez, 300 ms después de la última tecla", () => {
    render(<MediaToolbar query={{ q: null, uso: null }} />);
    const input = screen.getByRole("searchbox", {
      name: "Buscar por texto alternativo o nombre de archivo",
    });
    fireEvent.change(input, { target: { value: "eq" } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(input, { target: { value: "equipo" } });
    act(() => vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/admin/media?q=equipo", { scroll: false });
  });

  it("elegir 'Sin usar' agrega ?uso=sin-usar y 'Todas' lo quita", () => {
    render(<MediaToolbar query={{ q: null, uso: null }} />);
    expect(screen.getByRole("radiogroup", { name: "Filtrar por uso" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Todas" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Sin usar" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/media?uso=sin-usar", { scroll: false });
    expect(screen.getByRole("radio", { name: "Sin usar" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Todas" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/media", { scroll: false });
  });

  it("el filtro conserva la búsqueda escrita y cancela la espera pendiente", () => {
    render(<MediaToolbar query={{ q: null, uso: null }} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "equipo" } });
    fireEvent.click(screen.getByRole("radio", { name: "En uso" }));
    act(() => vi.advanceTimersByTime(500));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/admin/media?q=equipo&uso=en-uso", { scroll: false });
  });

  it("arranca con la búsqueda y el filtro de la URL", () => {
    render(<MediaToolbar query={{ q: "equipo", uso: "en-uso" }} />);
    expect(screen.getByRole("searchbox")).toHaveValue("equipo");
    expect(screen.getByRole("radio", { name: "En uso" })).toBeChecked();
  });
});
