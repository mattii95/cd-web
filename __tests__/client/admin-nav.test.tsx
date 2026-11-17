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

  it("en /admin/medios marca Medios y no Inicio", () => {
    pathname.mockReturnValue("/admin/medios");
    render(<AdminNav />);
    expect(current().map((l) => l.textContent)).toEqual(["Medios"]);
  });

  it("en una subruta marca su ítem", () => {
    pathname.mockReturnValue("/admin/articulos/nuevo");
    render(<AdminNav />);
    expect(current().map((l) => l.textContent)).toEqual(["Artículos"]);
  });

  it("lista Inicio, Artículos, Medios y Usuarios en ese orden", () => {
    pathname.mockReturnValue("/admin");
    render(<AdminNav />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Inicio",
      "Artículos",
      "Medios",
      "Usuarios",
    ]);
  });
});
