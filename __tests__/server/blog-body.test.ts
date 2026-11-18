import { Editor, type JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";
import { createExtensions } from "@/components/admin/article-editor/extensions";
import {
  blocksToDoc,
  blogBodySchema,
  docHeadings,
  type LegacyBlock,
} from "@/db/blog-body";
import { blogPosts } from "@/db/seed/blog-data";
import type { BlogBlock } from "@/lib/blog-posts";

// El mock usa la forma resuelta (image); la guardada lleva mediaId.
const toStored = (body: BlogBlock[]) =>
  body.map((b) =>
    b.type === "image"
      ? { type: "image", mediaId: "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11" }
      : b,
  );

const mediaId = "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11";
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, marks });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const doc = (...content: unknown[]) => ({ type: "doc", content });
const ok = (d: unknown) => blogBodySchema.safeParse(d).success;
const link = (href: string) =>
  doc(p(t("x", [{ type: "link", attrs: { href } }])));
const image = { type: "image", attrs: { mediaId, alt: null, caption: null } };

describe("blogBodySchema", () => {
  it.each(blogPosts.map((x) => [x.slug, x.body] as const))(
    "acepta blocksToDoc del body de %s",
    (_slug, body) => {
      expect(ok(blocksToDoc(toStored(body) as LegacyBlock[]))).toBe(true);
    },
  );

  it("acepta H3, listas, cita, hardBreak, párrafo vacío y marcas", () => {
    expect(
      ok(
        doc(
          { type: "heading", attrs: { level: 3 }, content: [t("H3")] },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  p(t("a")),
                  {
                    type: "bulletList",
                    content: [{ type: "listItem", content: [p(t("anidado"))] }],
                  },
                ],
              },
            ],
          },
          {
            type: "orderedList",
            attrs: { start: 3 },
            content: [{ type: "listItem", content: [p(t("c"))] }],
          },
          { type: "blockquote", content: [p(t("uno")), p(t("dos"))] },
          p(t("a"), { type: "hardBreak" }, t("b")),
          { type: "paragraph" },
          p(
            t("n", [{ type: "bold" }, { type: "italic" }]),
            t("l", [{ type: "link", attrs: { href: "https://ejemplo.com" } }]),
          ),
        ),
      ),
    ).toBe(true);
  });

  it("rechaza estructuras inválidas", () => {
    const bad = [
      doc({ type: "video" }),
      doc(p(t("x", [{ type: "underline" }]))),
      doc({ type: "heading", attrs: { level: 1 }, content: [t("x")] }),
      doc({ type: "heading", attrs: { level: 4 }, content: [t("x")] }),
      doc(p(t(""))),
      doc({
        type: "bulletList",
        content: [{ type: "listItem", content: [image] }],
      }),
      doc({ type: "blockquote", content: [image] }),
      doc({ type: "tip", content: [p(t("x"))] }),
      doc({
        type: "image",
        attrs: { mediaId: "abc", alt: null, caption: null },
      }),
      [{ type: "p", text: "x" }],
    ];
    for (const d of bad) expect(ok(d)).toBe(false);
  });

  it("rechaza hrefs peligrosos y acepta https y rutas internas", () => {
    for (const h of [
      "javascript:alert(1)",
      "mailto:a@b.c",
      "//evil.com",
      "/\\evil.com",
      "data:text/html,x",
    ])
      expect(ok(link(h))).toBe(false);
    for (const h of ["https://ejemplo.com", "/servicios"])
      expect(ok(link(h))).toBe(true);
  });

  it("descarta target y rel del link", () => {
    const r = blogBodySchema.parse(
      doc(
        p(
          t("x", [
            { type: "link", attrs: { href: "/a", target: "_blank", rel: "x" } },
          ]),
        ),
      ),
    );
    expect(JSON.stringify(r)).not.toMatch(/target|rel/);
  });
});

describe("blocksToDoc", () => {
  it("convierte los cinco tipos en orden", () => {
    expect(
      blocksToDoc([
        { type: "p", text: "a" },
        { type: "h2", id: "s1", text: "b" },
        { type: "tip", text: "c" },
        { type: "summary", text: "d" },
        { type: "image", mediaId },
        { type: "image", mediaId, alt: "A", caption: "C" },
      ]),
    ).toEqual(
      doc(
        { type: "paragraph", content: [{ type: "text", text: "a" }] },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "b" }],
        },
        { type: "tip", content: [{ type: "text", text: "c" }] },
        { type: "summary", content: [{ type: "text", text: "d" }] },
        image,
        { type: "image", attrs: { mediaId, alt: "A", caption: "C" } },
      ),
    );
  });
});

describe("docHeadings", () => {
  it("lista solo H2, con ids s1/s2 y texto plano", () => {
    const d = blogBodySchema.parse(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [t("Uno")] },
        { type: "heading", attrs: { level: 3 }, content: [t("Sub")] },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            t("Dos ", [{ type: "bold" }]),
            t("link", [{ type: "link", attrs: { href: "/a" } }]),
          ],
        },
      ),
    );
    expect(docHeadings(d)).toEqual([
      { id: "s1", text: "Uno" },
      { id: "s2", text: "Dos link" },
    ]);
  });
});

describe("extensiones de Tiptap del panel", () => {
  it("un doc con todo lo que arma la barra pasa blogBodySchema", () => {
    const content = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [t("Título")] },
        { type: "heading", attrs: { level: 3 }, content: [t("Sub")] },
        p(
          t("negrita", [{ type: "bold" }]),
          t(" y "),
          t("cursiva", [{ type: "italic" }]),
          { type: "hardBreak" },
          t("enlace", [{ type: "link", attrs: { href: "/servicios" } }]),
        ),
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                p(t("uno")),
                {
                  type: "orderedList",
                  attrs: { start: 1 },
                  content: [{ type: "listItem", content: [p(t("anidado"))] }],
                },
              ],
            },
          ],
        },
        { type: "blockquote", content: [p(t("cita"))] },
        { type: "tip", content: [t("consejo")] },
        { type: "summary", content: [t("resumen")] },
        image,
      ],
    } as JSONContent;
    const editor = new Editor({
      element: null,
      extensions: createExtensions(),
      content,
    });
    const json = editor.getJSON();
    editor.destroy();
    expect(blogBodySchema.safeParse(json).success).toBe(true);
    expect(json.content?.map((n) => n.type)).toEqual([
      "heading",
      "heading",
      "paragraph",
      "bulletList",
      "blockquote",
      "tip",
      "summary",
      "image",
    ]);
  });
});
