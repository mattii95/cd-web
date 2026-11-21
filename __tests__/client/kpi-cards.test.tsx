import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KpiCards } from "@/app/(admin)/admin/_inicio/kpi-cards";
import type { DashboardKpis } from "@/db/admin-dashboard";

const kpis: DashboardKpis = {
  users: { total: 120, signups: { current: 6, previous: 6 } },
  comments: { created: { current: 12, previous: 10 }, pending: 4 },
  posts: { published: 9, drafts: 2, publishedInPeriod: { current: 1, previous: 0 } },
  ratings: { count: { current: 8, previous: 16 }, average: 4.25 },
};
const setup = (over: Partial<DashboardKpis> = {}) =>
  render(<KpiCards kpis={{ ...kpis, ...over }} periodo={30} />);

describe("KpiCards", () => {
  it("muestra una suba como '↑ 20 %' con su nombre accesible", () => {
    setup();
    expect(screen.getByText("↑ 20 %")).toBe(
      screen.getByRole("img", { name: "20 % más que los 30 días anteriores" }),
    );
  });

  it("muestra una baja, 'Sin cambios' y 'Nuevo' con sus nombres accesibles", () => {
    setup();
    expect(screen.getByRole("img", { name: "50 % menos que los 30 días anteriores" })).toHaveTextContent("↓ 50 %");
    expect(screen.getByRole("img", { name: "Sin cambios respecto de los 30 días anteriores" })).toHaveTextContent("Sin cambios");
    expect(screen.getByRole("img", { name: "Sin datos en los 30 días anteriores" })).toHaveTextContent("Nuevo");
  });

  it("el promedio lleva un decimal y coma; sin valoraciones es '—'", () => {
    const { unmount } = setup();
    expect(screen.getByText("4,3 ★")).toBeInTheDocument();
    expect(screen.getByText("8 valoraciones")).toBeInTheDocument();
    unmount();
    setup({ ratings: { count: { current: 0, previous: 3 }, average: null } });
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Sin valoraciones en el período")).toBeInTheDocument();
  });

  it("muestra '{N} pendientes' con enlace a /admin/comments", () => {
    setup();
    expect(screen.getByRole("link", { name: "4 pendientes" })).toHaveAttribute("href", "/admin/comments");
  });

  it("enlaza usuarios, comentarios y artículos; valoraciones no tiene enlace", () => {
    setup();
    expect(screen.getByRole("link", { name: "Usuarios" })).toHaveAttribute("href", "/admin/users");
    expect(screen.getByRole("link", { name: "Comentarios" })).toHaveAttribute("href", "/admin/comments");
    expect(screen.getByRole("link", { name: "Artículos" })).toHaveAttribute("href", "/admin/articles");
    expect(screen.queryByRole("link", { name: "Valoraciones" })).toBeNull();
  });

  it("muestra los totales y los borradores", () => {
    setup();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("2 borradores")).toBeInTheDocument();
    expect(screen.getByText(/\+1 publicado en el período/)).toBeInTheDocument();
  });
});
