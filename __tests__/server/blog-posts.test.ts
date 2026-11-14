import { describe, expect, it } from "vitest";
import {
  blogPosts,
  formatAverage,
  formatPostDate,
  getPost,
  getRatingSummary,
  getRelatedPosts,
} from "@/lib/blog-posts";

describe("getPost", () => {
  it("devuelve el artículo cuando el slug existe", () => {
    expect(getPost("senales-sistema-a-medida")?.slug).toBe(
      "senales-sistema-a-medida",
    );
  });

  it("devuelve undefined cuando el slug no existe", () => {
    expect(getPost("no-existe")).toBeUndefined();
  });
});

describe("getRatingSummary", () => {
  it("calcula el promedio y el total", () => {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 };
    expect(getRatingSummary({ distribution, comments: [] })).toEqual({
      average: 4.5,
      total: 2,
    });
  });

  it("devuelve promedio 0 y total 0 sin reseñas", () => {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    expect(getRatingSummary({ distribution, comments: [] })).toEqual({
      average: 0,
      total: 0,
    });
  });
});

describe("formatAverage", () => {
  it("usa coma decimal y un decimal", () => {
    expect(formatAverage(4.6)).toBe("4,6");
    expect(formatAverage(4)).toBe("4,0");
  });
});

describe("getRelatedPosts", () => {
  const post = blogPosts[0];

  it("excluye el artículo actual", () => {
    const related = getRelatedPosts(post, blogPosts.length);
    expect(related.some((p) => p.slug === post.slug)).toBe(false);
  });

  it("pone primero los de la misma categoría", () => {
    const related = getRelatedPosts(post, blogPosts.length);
    const sameCategory = blogPosts.filter(
      (p) => p.category === post.category && p.slug !== post.slug,
    ).length;
    expect(sameCategory).toBeGreaterThan(0);
    related
      .slice(0, sameCategory)
      .forEach((p) => expect(p.category).toBe(post.category));
  });

  it("respeta el máximo n", () => {
    expect(getRelatedPosts(post, 2)).toHaveLength(2);
  });
});

describe("formatPostDate", () => {
  it("formatea en es-AR sin puntos ni 'de'", () => {
    expect(formatPostDate("2026-03-05")).toBe("5 mar 2026");
  });
});
