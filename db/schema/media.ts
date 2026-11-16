import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { createdAt, id, updatedAt } from "./columns";

// Biblioteca de imágenes. El archivo vive en MEDIA_DIR como <id>.webp.
export const media = pgTable(
  "media",
  {
    id: id(),
    sha256: text().notNull().unique(), // hash del original: dedup y clave del seed
    alt: text().notNull(),
    width: integer().notNull(), // del WebP procesado
    height: integer().notNull(),
    bytes: integer().notNull(), // tamaño del WebP en disco
    originalName: text().notNull(), // solo informativo
    uploadedBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("media_alt_check", sql`length(trim(${t.alt})) > 0`),
    check("media_width_check", sql`${t.width} > 0`),
    check("media_height_check", sql`${t.height} > 0`),
    check("media_bytes_check", sql`${t.bytes} > 0`),
    index().on(t.createdAt),
  ],
);
