import { describe, expect, it } from "vitest";
import type { BlogDoc } from "@/db/blog-body";
import { parseArticleForm } from "@/lib/admin/article-form";

const cat = "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11";
const docWith = (text: string): BlogDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

function form(fields: Record<string, string | string[]> = {}) {
  const base: Record<string, string | string[]> = {
    intent: "draft",
    title: "Un título",
    categoryId: cat,
    slug: "",
    ...fields,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(base))
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}
const errorsOf = (
  fd: FormData,
  status: "borrador" | "publicado" | null = null,
) => {
  const r = parseArticleForm(fd, status);
  return r.ok ? null : r.fieldErrors;
};

describe("parseArticleForm", () => {
  it("borrador solo con título y categoría es válido", () => {
    expect(parseArticleForm(form(), null).ok).toBe(true);
  });

  it("publicar exige resumen, CTA y cuerpo con texto", () => {
    const e = errorsOf(form({ intent: "publish" }));
    expect(e).toHaveProperty("excerpt");
    expect(e).toHaveProperty("cta");
    expect(e).toHaveProperty("body");
  });

  it("save sobre un publicado también es estricto", () => {
    const e = errorsOf(form({ intent: "save" }), "publicado");
    expect(e).toHaveProperty("excerpt");
    expect(e).toHaveProperty("cta");
    expect(e).toHaveProperty("body");
  });

  it("save sobre un borrador es laxo y unpublish también", () => {
    expect(errorsOf(form({ intent: "save" }), "borrador")).toBeNull();
    expect(errorsOf(form({ intent: "unpublish" }), "publicado")).toBeNull();
  });

  it("publicar con todo completo es válido", () => {
    const r = parseArticleForm(
      form({
        intent: "publish",
        slug: "mi-articulo",
        excerpt: "Resumen",
        cta: "Escribinos",
        body: JSON.stringify(docWith("Hola")),
      }),
      null,
    );
    expect(r.ok).toBe(true);
  });

  it.each([
    ["sin título", { title: "   " }, "title"],
    ["sin categoría", { categoryId: "" }, "categoryId"],
    ["título largo", { title: "a".repeat(121) }, "title"],
    ["slug inválido", { slug: "Mal Slug" }, "slug"],
    ["6 etiquetas", { tags: ["a", "b", "c", "d", "e", "f"] }, "tags"],
    [
      "body inválido",
      { body: JSON.stringify({ type: "doc", content: [{ type: "x" }] }) },
      "body",
    ],
    [
      "enlace javascript:",
      {
        body: JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "x",
                  marks: [
                    { type: "link", attrs: { href: "javascript:alert(1)" } },
                  ],
                },
              ],
            },
          ],
        }),
      },
      "body",
    ],
  ])("%s → error en el campo", (_, fields, field) => {
    expect(errorsOf(form(fields))).toHaveProperty(field);
  });

  it("slug vacío en un borrador sale del título", () => {
    const r = parseArticleForm(form({ title: "¿Qué es SaaS?" }), null);
    expect(r.ok && r.input.slug).toBe("que-es-saas");
  });

  it("slug vacío al publicar es error", () => {
    expect(errorsOf(form({ intent: "publish" }))).toHaveProperty("slug");
  });

  it("etiquetas repetidas por slug quedan una", () => {
    const r = parseArticleForm(form({ tags: ["SEO", "seo", " Seo "] }), null);
    expect(r.ok && r.input.tags).toEqual(["SEO"]);
  });

  it("descarta etiquetas cuyo slug queda vacío", () => {
    const r = parseArticleForm(form({ tags: ["¡¿?!", "web"] }), null);
    expect(r.ok && r.input.tags).toEqual(["web"]);
  });

  it("etiqueta de más de 40 caracteres es error", () => {
    expect(errorsOf(form({ tags: ["a".repeat(41)] }))).toHaveProperty("tags");
  });

  it("lee id y updatedAt; vacíos en /new", () => {
    const fresh = parseArticleForm(form(), null);
    expect(fresh.ok && [fresh.id, fresh.expectedUpdatedAt]).toEqual([
      null,
      null,
    ]);
    const iso = "2026-11-18T10:00:00.000Z";
    const edit = parseArticleForm(
      form({ id: cat, updatedAt: iso }),
      "borrador",
    );
    expect(edit.ok && edit.id).toBe(cat);
    expect(edit.ok && edit.expectedUpdatedAt?.toISOString()).toBe(iso);
  });

  it("un intent desconocido no pasa", () => {
    expect(parseArticleForm(form({ intent: "x" }), null).ok).toBe(false);
  });
});
