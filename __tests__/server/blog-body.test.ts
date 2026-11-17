import { describe, expect, it } from "vitest";
import { blogBodySchema } from "@/db/blog-body";
import { blogPosts } from "@/db/seed/blog-data";
import type { BlogBlock } from "@/lib/blog-posts";

// El mock usa la forma resuelta (image); la guardada lleva mediaId.
const toStored = (body: BlogBlock[]) =>
  body.map((b) =>
    b.type === "image"
      ? { type: "image", mediaId: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11" }
      : b,
  );

describe("blogBodySchema", () => {
  it.each(blogPosts.map((p) => [p.slug, p.body] as const))(
    "acepta el body de %s",
    (_slug, body) => {
      expect(blogBodySchema.safeParse(toStored(body)).success).toBe(true);
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

  describe("bloque image", () => {
    const mediaId = "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11";

    it("acepta mediaId UUID, con alt y caption opcionales", () => {
      expect(
        blogBodySchema.safeParse([{ type: "image", mediaId }]).success,
      ).toBe(true);
      expect(
        blogBodySchema.safeParse([
          { type: "image", mediaId, alt: "Diagrama", caption: "Figura 1" },
        ]).success,
      ).toBe(true);
    });

    it("rechaza un bloque sin mediaId", () => {
      expect(blogBodySchema.safeParse([{ type: "image" }]).success).toBe(false);
    });

    it("rechaza un mediaId que no es UUID", () => {
      expect(
        blogBodySchema.safeParse([{ type: "image", mediaId: "abc" }]).success,
      ).toBe(false);
    });

    it("rechaza alt o caption vacíos", () => {
      for (const extra of [{ alt: "" }, { alt: "   " }, { caption: "" }]) {
        expect(
          blogBodySchema.safeParse([{ type: "image", mediaId, ...extra }])
            .success,
        ).toBe(false);
      }
    });
  });

  it("rechaza un objeto que no es array", () => {
    expect(blogBodySchema.safeParse({ type: "p", text: "x" }).success).toBe(
      false,
    );
  });
});
