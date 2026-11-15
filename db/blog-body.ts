import { z } from "zod";
import type { BlogBlock } from "@/lib/blog-posts";

const text = z.string().min(1);

// Tipado como ZodType<BlogBlock[]>: si BlogBlock cambia, tsc rompe aquí.
export const blogBodySchema: z.ZodType<BlogBlock[]> = z.array(
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("p"), text }),
    z.object({ type: z.literal("h2"), id: text, text }),
    z.object({ type: z.literal("tip"), text }),
    z.object({ type: z.literal("summary"), text }),
  ]),
);
