import { z } from "zod";
import type { BlogBlock, BlogImage } from "@/lib/blog-posts";

const text = z.string().min(1);
const optionalText = z.string().trim().min(1).optional();

// Forma guardada en post.body: el bloque image lleva el id, no la URL.
export type StoredBlogBlock =
  | Exclude<BlogBlock, { type: "image" }>
  | { type: "image"; mediaId: string; alt?: string; caption?: string };

// ---- Formato Tiptap (nombres de nodos y marcas de Tiptap) ----

export type BlogMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string } }; // http(s):// o "/ruta"

export type BlogInline =
  | { type: "text"; text: string; marks?: BlogMark[] } // text no vacío
  | { type: "hardBreak" };

export type BlogParagraph = { type: "paragraph"; content?: BlogInline[] };

export type BlogNestedNode =
  // lo que puede ir dentro de listas y citas
  | BlogParagraph
  | { type: "bulletList"; content: BlogListItem[] }
  | { type: "orderedList"; attrs?: { start?: number }; content: BlogListItem[] }
  | { type: "blockquote"; content: BlogNestedNode[] };

export type BlogListItem = { type: "listItem"; content: BlogNestedNode[] }; // empieza con paragraph

export type BlogBlockNode =
  // raíz del doc
  | BlogNestedNode
  | { type: "heading"; attrs: { level: 2 | 3 }; content: BlogInline[] }
  | { type: "tip"; content: BlogInline[] }
  | { type: "summary"; content: BlogInline[] }
  | {
      type: "image";
      attrs: { mediaId: string; alt: string | null; caption: string | null };
    };

export type BlogDoc = { type: "doc"; content: BlogBlockNode[] };

// Lo que recibe el blog: las imágenes ya resueltas.
export type ResolvedImageNode = {
  type: "image";
  attrs: { image: BlogImage; caption: string | null };
};
export type ResolvedBlogDoc = {
  type: "doc";
  content: (Exclude<BlogBlockNode, { type: "image" }> | ResolvedImageNode)[];
};

// http(s):// o ruta interna. Rechaza "//host" y "/\host" (el navegador los toma como host).
const href = z
  .string()
  .regex(/^(https?:\/\/|\/(?![/\\]))/, "href no permitido");

// z.object descarta las claves desconocidas (target, rel, class de Tiptap).
const markSchema: z.ZodType<BlogMark> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("link"), attrs: z.object({ href }) }),
]);

const inlineSchema: z.ZodType<BlogInline> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text,
    marks: z.array(markSchema).optional(),
  }),
  z.object({ type: z.literal("hardBreak") }),
]);
const inlines = z.array(inlineSchema);

const paragraphSchema = z.object({
  type: z.literal("paragraph"),
  content: inlines.optional(),
});

// Recursivo: las listas y citas se anidan.
const nestedSchema: z.ZodType<BlogNestedNode> = z.lazy(() =>
  z.union([
    paragraphSchema,
    z.object({
      type: z.literal("bulletList"),
      content: z.array(listItemSchema),
    }),
    z.object({
      type: z.literal("orderedList"),
      attrs: z.object({ start: z.number().int().optional() }).optional(),
      content: z.array(listItemSchema),
    }),
    z.object({ type: z.literal("blockquote"), content: z.array(nestedSchema) }),
  ]),
);
const listItemSchema: z.ZodType<BlogListItem> = z.object({
  type: z.literal("listItem"),
  content: z.array(nestedSchema),
});

// image solo en la raíz: no está en nestedSchema.
// Se llama blogDocSchema mientras convive con el blogBodySchema viejo (se renombra en el paso 3).
export const blogDocSchema: z.ZodType<BlogDoc> = z.object({
  type: z.literal("doc"),
  content: z.array(
    z.union([
      nestedSchema,
      z.object({
        type: z.literal("heading"),
        attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
        content: inlines,
      }),
      z.object({ type: z.literal("tip"), content: inlines }),
      z.object({ type: z.literal("summary"), content: inlines }),
      z.object({
        type: z.literal("image"),
        attrs: z.object({
          mediaId: z.uuid(),
          alt: z.string().nullable(),
          caption: z.string().nullable(),
        }),
      }),
    ]),
  ),
});

// Formato viejo (con mediaId ya puesto) → doc. Referencia de la migración SQL.
export type LegacyBlock = StoredBlogBlock;

export function blocksToDoc(blocks: LegacyBlock[]): BlogDoc {
  const t = (s: string): BlogInline[] => [{ type: "text", text: s }];
  return {
    type: "doc",
    content: blocks.map((b): BlogBlockNode => {
      switch (b.type) {
        case "p":
          return { type: "paragraph", content: t(b.text) };
        case "h2":
          return { type: "heading", attrs: { level: 2 }, content: t(b.text) };
        case "tip":
          return { type: "tip", content: t(b.text) };
        case "summary":
          return { type: "summary", content: t(b.text) };
        case "image":
          return {
            type: "image",
            attrs: {
              mediaId: b.mediaId,
              alt: b.alt ?? null,
              caption: b.caption ?? null,
            },
          };
      }
    }),
  };
}

const plainText = (nodes: BlogInline[]) =>
  nodes.map((n) => (n.type === "text" ? n.text : " ")).join("");

// H2 en orden: el ancla es s1, s2… por posición, no se guarda.
export function docHeadings(
  doc: BlogDoc | ResolvedBlogDoc,
): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  for (const n of doc.content) {
    if (n.type === "heading" && n.attrs.level === 2)
      out.push({ id: `s${out.length + 1}`, text: plainText(n.content) });
  }
  return out;
}

// Tipado como ZodType<StoredBlogBlock[]>: si el tipo cambia, tsc rompe aquí.
export const blogBodySchema: z.ZodType<StoredBlogBlock[]> = z.array(
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("p"), text }),
    z.object({ type: z.literal("h2"), id: text, text }),
    z.object({ type: z.literal("tip"), text }),
    z.object({ type: z.literal("summary"), text }),
    z.object({
      type: z.literal("image"),
      mediaId: z.uuid(),
      alt: optionalText,
      caption: optionalText,
    }),
  ]),
);
