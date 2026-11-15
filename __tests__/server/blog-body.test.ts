import { describe, expect, it } from "vitest";
import { blogBodySchema } from "@/db/blog-body";
import { blogPosts } from "@/lib/blog-posts";

describe("blogBodySchema", () => {
  it.each(blogPosts.map((p) => [p.slug, p.body] as const))(
    "acepta el body de %s",
    (_slug, body) => {
      expect(blogBodySchema.safeParse(body).success).toBe(true);
    },
  );

  it("rechaza un bloque con type desconocido", () => {
    expect(
      blogBodySchema.safeParse([{ type: "video", text: "x" }]).success,
    ).toBe(false);
  });

  it("rechaza un h2 sin id", () => {
    expect(blogBodySchema.safeParse([{ type: "h2", text: "x" }]).success).toBe(
      false,
    );
  });

  it("rechaza un objeto que no es array", () => {
    expect(blogBodySchema.safeParse({ type: "p", text: "x" }).success).toBe(
      false,
    );
  });
});
