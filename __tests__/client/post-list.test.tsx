import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostList } from "@/components/blog/post-list";
import { blogPosts } from "@/lib/blog-posts";

const setup = () =>
  render(<PostList posts={blogPosts} featuredDate="5 mar 2026" />);
const tagGroup = () =>
  screen.getByRole("group", { name: "Filtrar por etiqueta" });
const tagButton = (name: RegExp | string) =>
  within(tagGroup()).getByRole("button", { name });
// Artículos visibles: el destacado y las tarjetas son enlaces a /blog/[slug].
const articles = () =>
  screen
    .queryAllByRole("link")
    .filter((l) => l.getAttribute("href")?.startsWith("/blog/")).length;

describe("PostList · filtro por etiqueta", () => {
  it("muestra Todas activo y las 11 etiquetas con su cantidad", () => {
    setup();
    const buttons = within(tagGroup()).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Todas",
      "Automatización3",
      "Pymes3",
      "Gestión2",
      "MVP2",
      "Validación2",
      "Ventas2",
      "Atención al cliente1",
      "Chatbots1",
      "Landing page1",
      "Rendimiento1",
      "SEO1",
    ]);
    expect(tagButton("Todas")).toHaveAttribute("aria-pressed", "true");
  });

  it("activar una etiqueta filtra y desactiva Todas; Todas restaura", () => {
    setup();
    fireEvent.click(tagButton(/^Pymes/));
    expect(tagButton(/^Pymes/)).toHaveAttribute("aria-pressed", "true");
    expect(tagButton("Todas")).toHaveAttribute("aria-pressed", "false");
    const filtered = articles();
    fireEvent.click(tagButton("Todas"));
    expect(articles()).toBeGreaterThan(filtered);
    expect(filtered).toBe(3);
    expect(articles()).toBe(8);
  });

  it("combina categoría y etiqueta con AND", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "IA" }));
    fireEvent.click(tagButton(/^Pymes/));
    expect(articles()).toBe(1);
  });

  it("muestra el estado vacío cuando la combinación no deja posts", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Desarrollo web" }));
    fireEvent.click(tagButton(/^Chatbots/));
    expect(
      screen.getByText("No hay artículos con esa combinación."),
    ).toBeInTheDocument();
    expect(articles()).toBe(0);
  });
});
