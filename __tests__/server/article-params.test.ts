import { describe, expect, it } from "vitest";
import {
  type AdminPostQuery,
  articlesHref,
  DEFAULT_QUERY,
  parseArticleParams,
} from "@/lib/admin/article-params";

describe("parseArticleParams", () => {
  it("sin params devuelve los defaults", () => {
    expect(parseArticleParams({})).toEqual({
      status: null,
      q: null,
      category: null,
      updated: null,
      sort: "updated",
      dir: "desc",
      page: 1,
      perPage: 25,
    });
  });

  it("valores inválidos caen a su default sin lanzar", () => {
    expect(
      parseArticleParams({
        status: "archived",
        sort: "author",
        dir: "up",
        perPage: "30",
        updated: "1d",
        page: "0",
      }),
    ).toEqual(DEFAULT_QUERY);
    expect(parseArticleParams({ page: "abc" }).page).toBe(1);
    expect(parseArticleParams({ page: "2.5" }).page).toBe(1);
  });

  it("acepta valores válidos", () => {
    expect(
      parseArticleParams({
        status: "draft",
        category: "seo",
        updated: "30d",
        sort: "title",
        dir: "asc",
        page: "3",
        perPage: "10",
      }),
    ).toMatchObject({
      status: "draft",
      category: "seo",
      updated: "30d",
      sort: "title",
      dir: "asc",
      page: 3,
      perPage: 10,
    });
  });

  it("q se recorta, vacío da null y se corta a 100", () => {
    expect(parseArticleParams({ q: "  hola  " }).q).toBe("hola");
    expect(parseArticleParams({ q: "   " }).q).toBeNull();
    expect(parseArticleParams({ q: "a".repeat(150) }).q).toHaveLength(100);
  });

  it("un param repetido toma el primero", () => {
    expect(parseArticleParams({ status: ["draft", "published"] }).status).toBe("draft");
  });
});

describe("articlesHref", () => {
  it("con defaults y sin patch no agrega query", () => {
    expect(articlesHref(DEFAULT_QUERY, {})).toBe("/admin/articles");
  });

  it("omite defaults y escribe el resto", () => {
    expect(articlesHref(DEFAULT_QUERY, { status: "draft", sort: "title", dir: "asc" })).toBe(
      "/admin/articles?status=draft&sort=title&dir=asc",
    );
  });

  it("cambiar un filtro vuelve a la página 1", () => {
    const base: AdminPostQuery = { ...DEFAULT_QUERY, page: 3 };
    expect(articlesHref(base, { category: "seo" })).toBe("/admin/articles?category=seo");
  });

  it("cambiar solo page la conserva", () => {
    expect(articlesHref(DEFAULT_QUERY, { page: 3 })).toBe("/admin/articles?page=3");
  });

  it("conserva los demás params", () => {
    const base: AdminPostQuery = { ...DEFAULT_QUERY, status: "draft", q: "a b" };
    expect(articlesHref(base, { page: 2 })).toBe("/admin/articles?status=draft&q=a+b&page=2");
  });
});
