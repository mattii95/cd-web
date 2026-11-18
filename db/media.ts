import "server-only";
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { MediaError, processImage } from "@/lib/media/process";
import { deleteMediaFile, writeMediaFile } from "@/lib/media/storage";
import {
  decodeCursor,
  encodeCursor,
  type Page,
  type PageParams,
  resolveLimit,
} from "@/lib/pagination";
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
// Resuelve el uso de varias imágenes con 2 consultas: portadas y cuerpos.
async function getUsageByMedia(
  ids: string[],
): Promise<Map<string, MediaUsage[]>> {
  const usage = new Map<string, MediaUsage[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return usage;
  const db = getDb();
  const [covers, bodies] = await Promise.all([
    db
      .select({
        mediaId: post.coverMediaId,
        postId: post.id,
        slug: post.slug,
        title: post.title,
      })
      .from(post)
      .where(inArray(post.coverMediaId, ids))
      .orderBy(post.id),
    db.execute<{
      mediaId: string;
      postId: string;
      slug: string;
      title: string;
    }>(sql`
      select distinct
        el->'attrs'->>'mediaId' as "mediaId",
        p.id as "postId",
        p.slug as slug,
        p.title as title
      from ${post} p
      cross join lateral jsonb_array_elements(p.body->'content') el
      where el->>'type' = 'image'
        and el->'attrs'->>'mediaId' in (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})
      order by 1, 2
    `),
  ]);
  for (const { mediaId, ...r } of covers) {
    if (mediaId) usage.get(mediaId)?.push({ ...r, as: "portada" });
  }
  for (const { mediaId, ...r } of bodies.rows) {
    usage.get(mediaId)?.push({ ...r, as: "cuerpo" });
  }
  return usage;
}

export async function getMediaUsage(id: string): Promise<MediaUsage[]> {
  return (await getUsageByMedia([id])).get(id) ?? [];
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

const DEFAULT_MEDIA_LIMIT = 24;

export async function listMedia(
  params: PageParams = {},
): Promise<Page<MediaItem>> {
  const limit = resolveLimit(params.limit, DEFAULT_MEDIA_LIMIT);
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  const rows = await getDb()
    .select({ row: media, t: sql<string>`${media.createdAt}::text` })
    .from(media)
    .where(
      cursor
        ? sql`(${media.createdAt}, ${media.id}) < (${cursor.t}::timestamp, ${cursor.id})`
        : undefined,
    )
    .orderBy(desc(media.createdAt), desc(media.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit ? encodeCursor({ t: last.t, id: last.row.id }) : null;

  const usage = await getUsageByMedia(page.map((r) => r.row.id));
  return {
    items: page.map((r) => toItem(r.row, usage.get(r.row.id) ?? [])),
    nextCursor,
  };
}

export async function countMedia(): Promise<number> {
  const [r] = await getDb().select({ n: count() }).from(media);
  return r.n;
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
