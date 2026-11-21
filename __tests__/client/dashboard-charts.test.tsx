import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityChart } from "@/app/(admin)/admin/_inicio/charts/activity-chart";
import { CategoryChart } from "@/app/(admin)/admin/_inicio/charts/category-chart";
import { CommentStatusChart } from "@/app/(admin)/admin/_inicio/charts/comment-status-chart";
import { RatingChart } from "@/app/(admin)/admin/_inicio/charts/rating-chart";

// ResponsiveContainer mide 0 en jsdom: se verifica la tabla `sr-only`, no el SVG.
const cells = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((r) => [...r.querySelectorAll("th, td")].map((c) => c.textContent));

const activity = [
  { key: "2026-11-20", users: 1, comments: 2, ratings: 0 },
  { key: "2026-11-21", users: 0, comments: 3, ratings: 4 },
];
const stars = [
  { stars: 5 as const, count: 3 },
  { stars: 4 as const, count: 0 },
  { stars: 3 as const, count: 1 },
  { stars: 2 as const, count: 0 },
  { stars: 1 as const, count: 0 },
];
const categories = [
  { id: "a", label: "Sistemas", count: 4 },
  { id: "b", label: "Web", count: 0 },
];

describe("gráficos del Inicio", () => {
  it("cada gráfico es un figure con su figcaption y una tabla con los valores recibidos", () => {
    const { unmount } = render(<ActivityChart data={activity} bucket="day" scope="Últimos 7 días" />);
    expect(screen.getByRole("figure").querySelector("figcaption")).toHaveTextContent("Actividad");
    expect(cells(screen.getByRole("table"))).toEqual([
      ["Día", "Altas de usuarios", "Comentarios", "Valoraciones"],
      ["20 nov", "1", "2", "0"],
      ["21 nov", "0", "3", "4"],
    ]);
    unmount();

    const status = render(
      <CommentStatusChart data={{ pendiente: 2, aprobado: 5, oculto: 1 }} scope="Últimos 30 días" />,
    );
    expect(screen.getByText("Comentarios por estado")).toBeInTheDocument();
    expect(cells(screen.getByRole("table"))).toEqual([
      ["Estado", "Comentarios"],
      ["Pendientes", "2"],
      ["Aprobados", "5"],
      ["Ocultos", "1"],
    ]);
    status.unmount();

    const rating = render(<RatingChart data={stars} scope="Últimos 30 días" />);
    expect(screen.getByText("Distribución de estrellas")).toBeInTheDocument();
    expect(cells(screen.getByRole("table")).slice(1, 3)).toEqual([
      ["5 ★", "3"],
      ["4 ★", "0"],
    ]);
    rating.unmount();

    render(<CategoryChart data={categories} scope="En total" />);
    expect(screen.getByText("Artículos por categoría")).toBeInTheDocument();
    expect(cells(screen.getByRole("table")).slice(1)).toEqual([
      ["Sistemas", "4"],
      ["Web", "0"],
    ]);
  });

  it("con 90 días rotula la primera columna como Semana", () => {
    render(<ActivityChart data={[{ key: "2026-11-17", users: 1, comments: 0, ratings: 0 }]} bucket="week" scope="Últimos 90 días" />);
    expect(cells(screen.getByRole("table"))[1][0]).toBe("Sem. 17 nov");
    expect(screen.getByRole("columnheader", { name: "Semana" })).toBeInTheDocument();
  });

  it.each([
    ["Actividad", <ActivityChart key="a" data={[{ key: "2026-11-21", users: 0, comments: 0, ratings: 0 }]} bucket="day" scope="x" />, "No hubo actividad en este período."],
    ["Comentarios por estado", <CommentStatusChart key="c" data={{ pendiente: 0, aprobado: 0, oculto: 0 }} scope="x" />, "No hubo comentarios en este período."],
    ["Distribución de estrellas", <RatingChart key="r" data={stars.map((s) => ({ ...s, count: 0 }))} scope="x" />, "No hubo valoraciones en este período."],
    ["Artículos por categoría", <CategoryChart key="k" data={categories.map((c) => ({ ...c, count: 0 }))} scope="x" />, "Todavía no hay artículos publicados."],
  ])("%s sin datos muestra su estado vacío y no renderiza la tabla", (_title, ui, text) => {
    render(ui);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
