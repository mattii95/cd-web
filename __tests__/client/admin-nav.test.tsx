import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminNav } from "@/components/admin/admin-nav";

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: pathname }));

const current = () =>
  screen.queryAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");

describe("AdminNav", () => {
  beforeEach(() => pathname.mockReset());

  it("en /admin marca solo Inicio", () => {
    pathname.mockReturnValue("/admin");
    render(<AdminNav />);
    expect(current().map((l) => l.textContent)).toEqual(["Inicio"]);
  });

  it("en /admin/media marca Medios y no Inicio", () => {
    pathname.mockReturnValue("/admin/media");
    render(<AdminNav />);
    expect(current().map((l) => l.textContent)).toEqual(["Medios"]);
  });

  it("en una subruta marca su ítem", () => {
    pathname.mockReturnValue("/admin/articles/nuevo");
    render(<AdminNav />);
    expect(current().map((l) => l.textContent)).toEqual(["Artículos"]);
  });

  it.each([
    ["/admin/categories", "Categorías"],
    ["/admin/tags", "Etiquetas"],
  ])("en %s marca %s", (path, name) => {
    pathname.mockReturnValue(path);
    render(<AdminNav />);
    expect(current().map((l) => l.textContent)).toEqual([name]);
  });

  it("en /admin/comments marca Comentarios", () => {
    pathname.mockReturnValue("/admin/comments");
    render(<AdminNav />);
    expect(current().map((l) => l.textContent)).toEqual(["Comentarios"]);
  });

  it("lista Inicio, Artículos, Categorías, Etiquetas, Medios, Comentarios y Usuarios en ese orden", () => {
    pathname.mockReturnValue("/admin");
    render(<AdminNav />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Inicio",
      "Artículos",
      "Categorías",
      "Etiquetas",
      "Medios",
      "Comentarios",
      "Usuarios",
    ]);
  });

  it("con badges muestra la insignia junto a Comentarios, sin cambiar el nombre del enlace", () => {
    pathname.mockReturnValue("/admin");
    render(
      <AdminNav
        badges={{ "/admin/comments": <span role="img" aria-label="3 pendientes">3</span> }}
      />,
    );
    expect(screen.getByRole("img", { name: "3 pendientes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Comentarios" })).toBeInTheDocument();
  });

  it("sin badges no muestra insignia", () => {
    pathname.mockReturnValue("/admin");
    render(<AdminNav />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
