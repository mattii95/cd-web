import { z } from "zod";
import type { BlogBlock } from "@/lib/blog-posts";

const text = z.string().min(1);
const optionalText = z.string().trim().min(1).optional();

// Forma guardada en post.body: el bloque image lleva el id, no la URL.
export type StoredBlogBlock =
  | Exclude<BlogBlock, { type: "image" }>
  | { type: "image"; mediaId: string; alt?: string; caption?: string };

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
