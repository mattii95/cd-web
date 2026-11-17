import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogCategoryRow, PostSummary, TagRow } from "@/db/blog";

const loadMorePostsAction = vi.fn();
vi.mock("@/actions/blog", () => ({
  loadMorePostsAction: (...args: unknown[]) => loadMorePostsAction(...args),
}));

import { PostList } from "@/components/blog/post-list";

const categories: BlogCategoryRow[] = [
  {
    slug: "sistemas",
    label: "Sistemas",
    filterLabel: "Sistemas",
    serviceSlug: "sistemas-a-medida",
  },
  {
    slug: "ia",
    label: "Inteligencia artificial",
    filterLabel: "IA",
    serviceSlug: "inteligencia-artificial",
  },
];
const tags: TagRow[] = [
  { slug: "pymes", name: "Pymes", count: 3 },
  { slug: "mvp", name: "MVP", count: 2 },
];

const post = (n: number): PostSummary => ({
  id: `id-${n}`,
  slug: `post-${n}`,
  title: `Post ${n}`,
  excerpt: "extracto",
  readingMinutes: 5,
  publishedAt: new Date(Date.UTC(2026, 10, 30 - n)),
  category: categories[0],
  author: { name: "Matías Courroux", image: null, jobTitle: null, bio: null },
  cover: null,
  tags: [],
});

const setup = (props: Partial<React.ComponentProps<typeof PostList>> = {}) =>
  render(
    <PostList
      initialPosts={[post(1), post(2), post(3)]}
      initialCursor={null}
      categories={categories}
      tags={tags}
      {...props}
    />,
  );
// El destacado y las tarjetas son enlaces a /blog/[slug].
const articles = () =>
  screen
    .queryAllByRole("link")
    .filter((l) => l.getAttribute("href")?.startsWith("/blog/")).length;

beforeEach(() => loadMorePostsAction.mockReset());

describe("PostList · filtros en la URL", () => {
  it("los filtros son enlaces y Todos/Todas quitan su parámetro", () => {
    setup({ categoria: "sistemas", etiqueta: "pymes" });
    const cat = screen.getByRole("group", { name: "Filtrar por categoría" });
    expect(within(cat).getByRole("link", { name: "Todos" })).toHaveAttribute(
      "href",
      "/blog?etiqueta=pymes",
    );
    expect(within(cat).getByRole("link", { name: "IA" })).toHaveAttribute(
      "href",
      "/blog?categoria=ia&etiqueta=pymes",
    );
    const tag = screen.getByRole("group", { name: "Filtrar por etiqueta" });
    expect(within(tag).getByRole("link", { name: "Todas" })).toHaveAttribute(
      "href",
      "/blog?categoria=sistemas",
    );
    expect(within(tag).getByRole("link", { name: /^MVP/ })).toHaveAttribute(
      "href",
      "/blog?categoria=sistemas&etiqueta=mvp",
    );
  });

  it("marca la categoría y la etiqueta activas con aria-current", () => {
    setup({ categoria: "ia", etiqueta: "mvp" });
    expect(screen.getByRole("link", { name: "IA" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "Todos" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: /^MVP/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("sin filtros, Todos y Todas están activos", () => {
    setup();
    expect(screen.getByRole("link", { name: "Todos" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "Todas" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("muestra cada etiqueta con su cantidad", () => {
    setup();
    const links = within(
      screen.getByRole("group", { name: "Filtrar por etiqueta" }),
    ).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Todas",
      "Pymes3",
      "MVP2",
    ]);
  });

  it("el primer post es el destacado y el resto va a la grilla", () => {
    setup();
    expect(screen.getByText("Destacado")).toBeInTheDocument();
    expect(articles()).toBe(3);
  });

  it("muestra el estado vacío cuando no hay posts", () => {
    setup({ initialPosts: [] });
    expect(
      screen.getByText("No hay artículos con esa combinación."),
    ).toBeInTheDocument();
    expect(articles()).toBe(0);
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });
});

describe("PostList · Cargar más", () => {
  it("no muestra el botón sin cursor", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("suma tarjetas con el cursor y los filtros, y se oculta al terminar", async () => {
    loadMorePostsAction.mockResolvedValue({
      status: "success",
      items: [post(4), post(5)],
      nextCursor: null,
    });
    setup({ initialCursor: "c1", categoria: "sistemas", etiqueta: "pymes" });
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await waitFor(() => expect(articles()).toBe(5));
    expect(loadMorePostsAction).toHaveBeenCalledWith("c1", {
      category: "sistemas",
      tag: "pymes",
    });
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("mientras carga queda deshabilitado con aria-busy", async () => {
    let resolve!: (v: unknown) => void;
    loadMorePostsAction.mockReturnValue(new Promise((r) => (resolve = r)));
    setup({ initialCursor: "c1" });
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    const busy = await screen.findByRole("button", { name: "Cargando…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    resolve({ status: "success", items: [], nextCursor: null });
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("si la acción devuelve error muestra el aviso y habilita el botón", async () => {
    loadMorePostsAction.mockResolvedValue({ status: "error", message: "x" });
    setup({ initialCursor: "c1" });
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(
      await screen.findByText("No pudimos cargar más artículos."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cargar más" })).toBeEnabled();
    expect(articles()).toBe(3);
  });
});
