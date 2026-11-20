import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentsToolbar } from "@/app/(admin)/admin/comments/comments-toolbar";
import type { AdminCommentQuery } from "@/lib/admin/comment-params";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const ID = "0b9c1f4e-6a1d-4c5b-8f0e-2d7a9b3c4e51";
const posts = [
  { id: ID, title: "Señales" },
  { id: "6f1d2c3b-9a8e-4d7c-b6a5-1e2f3a4b5c6d", title: "Otro" },
];
const base: AdminCommentQuery = { estado: "pendientes", articulo: null, q: null, page: 1 };
const setup = (query: Partial<AdminCommentQuery> = {}) =>
  render(<CommentsToolbar query={{ ...base, ...query }} posts={posts} />);
const search = () => screen.getByLabelText("Buscar en el texto, nombre o email");

describe("CommentsToolbar", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("escribir llama a router.replace una sola vez, 300 ms después de la última tecla y sin page", () => {
    setup({ page: 3 });
    fireEvent.change(search(), { target: { value: "sp" } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(search(), { target: { value: "spam" } });
    act(() => vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/admin/comments?q=spam", { scroll: false });
  });

  it("elegir un artículo navega con ?articulo=<id>", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Artículo"), { target: { value: ID } });
    expect(replace).toHaveBeenLastCalledWith(`/admin/comments?articulo=${ID}`, { scroll: false });
  });

  it("elegir Todos los artículos lo quita y mantiene estado", () => {
    setup({ estado: "ocultos", articulo: ID });
    fireEvent.change(screen.getByLabelText("Artículo"), { target: { value: "" } });
    expect(replace).toHaveBeenLastCalledWith("/admin/comments?estado=ocultos", { scroll: false });
  });

  it("cambiar un filtro conserva los demás y vuelve a la página 1", () => {
    setup({ estado: "aprobados", q: "ana", page: 4 });
    fireEvent.change(screen.getByLabelText("Artículo"), { target: { value: ID } });
    expect(replace).toHaveBeenCalledWith(
      `/admin/comments?estado=aprobados&articulo=${ID}&q=ana`,
      { scroll: false },
    );
  });

  it("muestra los valores de la URL en los controles y lista los artículos", () => {
    setup({ q: "ana", articulo: ID });
    expect(search()).toHaveValue("ana");
    expect(screen.getByLabelText("Artículo")).toHaveValue(ID);
    expect(screen.getByRole("option", { name: "Todos los artículos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Otro" })).toBeInTheDocument();
  });

  it("vaciar el campo quita ?q de la URL", () => {
    setup({ q: "ana" });
    fireEvent.change(search(), { target: { value: "" } });
    act(() => vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledWith("/admin/comments", { scroll: false });
  });
});
