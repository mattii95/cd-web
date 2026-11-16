import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { MediaError, processImage } from "@/lib/media/process";
import {
  deleteMediaFile,
  writeMediaFile,
} from "@/lib/media/storage";
import { getDb } from "./client";
import { media, post } from "./schema";

export { MediaError };

export type MediaUsage = {
  postId: string;
  slug: string;
  title: string;
  as: "portada" | "cuerpo";
};
export type MediaItem = {
  id: string;
  src: string; // "/media/<id>"
  alt: string;
  width: number;
  height: number;
  bytes: number;
  originalName: string;
  createdAt: Date;
  usage: MediaUsage[];
};

export class MediaInUseError extends Error {
  usage: MediaUsage[];
  constructor(usage: MediaUsage[]) {
    super(
      `La imagen está en uso en: ${[...new Set(usage.map((u) => u.title))].join(", ")}`,
    );
    this.usage = usage;
  }
}

const toItem = (
  row: typeof media.$inferSelect,
  usage: MediaUsage[],
): MediaItem => ({
  id: row.id,
  src: `/media/${row.id}`,
  alt: row.alt,
  width: row.width,
  height: row.height,
  bytes: row.bytes,
  originalName: row.originalName,
  createdAt: row.createdAt,
  usage,
});

// Posts de cualquier estado, borrador o publicado.
export async function getMediaUsage(id: string): Promise<MediaUsage[]> {
  const db = getDb();
  const cols = { postId: post.id, slug: post.slug, title: post.title };
  const inBody = JSON.stringify([{ type: "image", mediaId: id }]);
  const [covers, bodies] = await Promise.all([
    db.select(cols).from(post).where(eq(post.coverMediaId, id)),
    db
      .select(cols)
      .from(post)
      .where(sql`${post.body} @> ${inBody}::jsonb`),
  ]);
  return [
    ...covers.map((r) => ({ ...r, as: "portada" as const })),
    ...bodies.map((r) => ({ ...r, as: "cuerpo" as const })),
  ];
}

export async function createMedia(input: {
  file: Buffer;
  originalName: string;
  alt: string;
  uploadedBy: string | null;
}): Promise<{ item: MediaItem; duplicate: boolean }> {
  // Si falla, lanza MediaError antes de tocar el disco o la base.
  const processed = await processImage(input.file);
  const db = getDb();

  const [existing] = await db
    .select()
    .from(media)
    .where(eq(media.sha256, processed.sha256));
  if (existing) {
    return {
      item: toItem(existing, await getMediaUsage(existing.id)),
      duplicate: true,
    };
  }

  const id = crypto.randomUUID();
  await writeMediaFile(id, processed.data);
  try {
    const [row] = await db
      .insert(media)
      .values({
        id,
        sha256: processed.sha256,
        alt: input.alt,
        width: processed.width,
        height: processed.height,
        bytes: processed.data.length,
        originalName: input.originalName,
        uploadedBy: input.uploadedBy,
      })
      .returning();
    return { item: toItem(row, []), duplicate: false };
  } catch (e) {
    await deleteMediaFile(id);
    throw e;
  }
}

export async function listMedia(): Promise<MediaItem[]> {
  const rows = await getDb()
    .select()
    .from(media)
    .orderBy(desc(media.createdAt));
  // shortcut: 2 consultas por imagen, la biblioteca no pagina; pasar a una sola si crece.
  return Promise.all(
    rows.map(async (row) => toItem(row, await getMediaUsage(row.id))),
  );
}

export async function updateMediaAlt(id: string, alt: string): Promise<void> {
  if (!alt.trim()) throw new Error("El alt no puede estar vacío");
  await getDb().update(media).set({ alt }).where(eq(media.id, id));
}

export async function deleteMedia(id: string): Promise<void> {
  const usage = await getMediaUsage(id);
  if (usage.length) throw new MediaInUseError(usage);
  await getDb().delete(media).where(eq(media.id, id));
  await deleteMediaFile(id);
}
