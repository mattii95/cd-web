import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  blogAuthor,
  blogCategories,
  blogPosts,
  type BlogBlock,
  type BlogImage,
  type BlogRating,
} from "@/lib/blog-posts";
import { processImage } from "@/lib/media/process";
import { readMediaFile, writeMediaFile } from "@/lib/media/storage";
import { blogBodySchema, type StoredBlogBlock } from "../blog-body";
import * as schema from "../schema";

const {
  authorProfile,
  category,
  comment,
  commentVote,
  media,
  post,
  postRating,
  user,
} = schema;

const REVIEWED_SLUG = "senales-sistema-a-medida";

// Los "Hace 2 días" del mock no se guardan: fechas fijas, en el orden del mock.
const COMMENT_DEMO: Record<
  string,
  { email: string; createdAt: string; repliedAt?: string }
> = {
  c1: {
    email: "lucia@demo.invalid",
    createdAt: "2026-11-14T10:00:00Z",
    repliedAt: "2026-11-14T15:00:00Z",
  },
  c2: { email: "martin@demo.invalid", createdAt: "2026-11-13T10:00:00Z" },
  c3: { email: "carla@demo.invalid", createdAt: "2026-11-12T10:00:00Z" },
  c4: {
    email: "diego@demo.invalid",
    createdAt: "2026-11-11T10:00:00Z",
    repliedAt: "2026-11-11T15:00:00Z",
  },
};

const lectorEmail = (n: number) =>
  `lector-${String(n).padStart(2, "0")}@demo.invalid`;

// Carga una imagen del mock (un archivo de public/) en la biblioteca. Clave natural: sha256.
async function seedImage(
  db: NodePgDatabase<typeof schema>,
  image: BlogImage,
  uploadedBy: string,
): Promise<string> {
  const original = await readFile(path.join(process.cwd(), "public", image.src));
  const processed = await processImage(original);
  const [existing] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.sha256, processed.sha256));
  let id = existing?.id;
  if (!id) {
    id = crypto.randomUUID();
    await db.insert(media).values({
      id,
      sha256: processed.sha256,
      alt: image.alt,
      width: processed.width,
      height: processed.height,
      bytes: processed.data.length,
      originalName: path.basename(image.src),
      uploadedBy,
    });
  }
  // Un archivo que ya está en disco no se reescribe.
  if (!(await readMediaFile(id))) await writeMediaFile(id, processed.data);
  return id;
}

export async function seedBlog(
  db: NodePgDatabase<typeof schema>,
  { authorEmail }: { authorEmail: string },
): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed del blog no corre con NODE_ENV=production");
  }

  const [author] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, authorEmail));
  if (!author) {
    throw new Error(
      `No existe un usuario con el email ${authorEmail}: registralo antes de correr el seed`,
    );
  }

  // Las imágenes van antes de la transacción: los archivos no son transaccionales.
  const mediaIds = new Map<string, string>(); // src → media.id
  const imageId = async (image: BlogImage) => {
    if (!mediaIds.has(image.src)) {
      mediaIds.set(image.src, await seedImage(db, image, author.id));
    }
    return mediaIds.get(image.src)!;
  };
  const toStored = async (body: BlogBlock[]): Promise<StoredBlogBlock[]> =>
    Promise.all(
      body.map(async (b) =>
        b.type === "image"
          ? {
              type: "image" as const,
              mediaId: await imageId(b.image),
              ...(b.caption && { caption: b.caption }),
            }
          : b,
      ),
    );

  const bodies = new Map<string, StoredBlogBlock[]>();
  const covers = new Map<string, string>(); // slug → media.id
  for (const p of blogPosts) {
    if (p.cover) covers.set(p.slug, await imageId(p.cover));
    const parsed = blogBodySchema.safeParse(await toStored(p.body));
    if (!parsed.success) {
      throw new Error(`El body del post "${p.slug}" no cumple blogBodySchema`);
    }
    bodies.set(p.slug, parsed.data);
  }

  const reviews = blogPosts.find((p) => p.slug === REVIEWED_SLUG)?.reviews;
  if (!reviews) throw new Error(`Faltan las reviews mock de ${REVIEWED_SLUG}`);

  await db.transaction(async (tx) => {
    // Categorías: clave natural slug.
    const categoryIds = new Map<string, string>();
    for (const [position, c] of blogCategories.entries()) {
      const values = {
        label: c.label,
        filterLabel: c.filterLabel,
        serviceSlug: c.service,
        position,
      };
      const [row] = await tx
        .insert(category)
        .values({ slug: c.tag, ...values })
        .onConflictDoUpdate({ target: category.slug, set: values })
        .returning({ id: category.id });
      categoryIds.set(c.tag, row.id);
    }

    const profile = { jobTitle: blogAuthor.role, bio: blogAuthor.bio };
    await tx
      .insert(authorProfile)
      .values({ userId: author.id, ...profile })
      .onConflictDoUpdate({ target: authorProfile.userId, set: profile });

    // Posts: clave natural slug.
    const postIds = new Map<string, string>();
    for (const p of blogPosts) {
      const values = {
        title: p.title,
        excerpt: p.excerpt,
        body: bodies.get(p.slug)!,
        coverMediaId: covers.get(p.slug) ?? null,
        cta: p.cta,
        readingMinutes: p.readingMinutes,
        categoryId: categoryIds.get(p.category)!,
        authorId: author.id,
        status: "publicado" as const,
        publishedAt: new Date(p.publishedAt),
      };
      const [row] = await tx
        .insert(post)
        .values({ slug: p.slug, ...values })
        .onConflictDoUpdate({ target: post.slug, set: values })
        .returning({ id: post.id });
      postIds.set(p.slug, row.id);
    }

    // Usuarios demo: 4 con comentario y 20 lectores. Sin fila account, no pueden entrar.
    const commenters = reviews.comments.map((c) => ({
      email: COMMENT_DEMO[c.id].email,
      name: c.name,
      rating: c.rating,
    }));
    // Las valoraciones restantes salen de la distribución, de 5★ a 1★.
    const left = { ...reviews.distribution };
    for (const c of commenters) left[c.rating]--;
    const lectors: { email: string; name: string; rating: BlogRating }[] = [];
    for (const r of [5, 4, 3, 2, 1] as BlogRating[]) {
      for (let i = 0; i < left[r]; i++) {
        const n = lectors.length + 5;
        lectors.push({
          email: lectorEmail(n),
          name: `Lector ${String(n).padStart(2, "0")}`,
          rating: r,
        });
      }
    }
    const demo = [...commenters, ...lectors];
    await tx
      .insert(user)
      .values(
        demo.map((d) => ({
          id: crypto.randomUUID(),
          name: d.name,
          email: d.email,
        })),
      )
      .onConflictDoNothing({ target: user.email });
    const userIds = new Map(
      (
        await tx
          .select({ id: user.id, email: user.email })
          .from(user)
          .where(
            inArray(
              user.email,
              demo.map((d) => d.email),
            ),
          )
      ).map((u) => [u.email, u.id]),
    );

    const postId = postIds.get(REVIEWED_SLUG)!;
    await tx
      .insert(postRating)
      .values(
        demo.map((d) => ({
          postId,
          userId: userIds.get(d.email)!,
          rating: d.rating,
        })),
      )
      .onConflictDoNothing();

    // Comentarios con id fijo: el comentario no tiene clave natural.
    for (const c of reviews.comments) {
      const meta = COMMENT_DEMO[c.id];
      const id = `seed-comment-${c.id}`;
      await tx
        .insert(comment)
        .values({
          id,
          postId,
          userId: userIds.get(meta.email)!,
          text: c.text,
          status: "aprobado",
          replyText: c.reply?.text ?? null,
          repliedAt: meta.repliedAt ? new Date(meta.repliedAt) : null,
          createdAt: new Date(meta.createdAt),
        })
        .onConflictDoNothing();
      // "Útil": los primeros N lectores, nunca quien escribió el comentario.
      const voters = lectors.slice(0, c.likes);
      if (voters.length) {
        await tx
          .insert(commentVote)
          .values(
            voters.map((v) => ({
              commentId: id,
              userId: userIds.get(v.email)!,
            })),
          )
          .onConflictDoNothing();
      }
    }
  });
}
