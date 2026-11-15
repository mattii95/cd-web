import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  getApprovedComments,
  getCategories,
  getPublishedPostBySlug,
  getPublishedPosts,
  getRatingSummary,
} from "@/db/blog";
import { closeDb, getDb } from "@/db/client";
import {
  authorProfile,
  category,
  comment,
  commentVote,
  post,
  postRating,
  user,
} from "@/db/schema";
import {
  nuevaCategoria,
  nuevoPost,
  nuevoUsuario,
  resetBlog,
} from "./blog-helpers";

async function crearBase() {
  const db = getDb();
  await db
    .insert(user)
    .values(["autor", "ana", "beto"].map((id) => nuevoUsuario(id)));
  await db
    .insert(authorProfile)
    .values({ userId: "autor", jobTitle: "Fundador", bio: "Bio" });
  const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
  const [p] = await db
    .insert(post)
    .values(nuevoPost(cat.id, "autor"))
    .returning();
  return { cat, post: p };
}

describe("funciones de lectura del blog", () => {
  beforeEach(resetBlog);
  afterEach(resetBlog);
  afterAll(closeDb);

  it("getCategories ordena por position", async () => {
    const db = getDb();
    await db.insert(category).values([
      { ...nuevaCategoria("ia"), position: 2 },
      { ...nuevaCategoria("saas"), position: 1 },
    ]);
    const slugs = (await getCategories()).map((c) => c.slug);
    expect(slugs).toEqual(["saas", "ia"]);
  });

  it("getPublishedPosts omite borradores y ordena por fecha descendente", async () => {
    const db = getDb();
    const { cat } = await crearBase();
    await db.insert(post).values([
      {
        ...nuevoPost(cat.id, "autor", "nuevo"),
        publishedAt: new Date("2026-11-12"),
      },
      { ...nuevoPost(cat.id, "autor", "borrador"), status: "borrador" },
    ]);
    const posts = await getPublishedPosts();
    expect(posts.map((p) => p.slug)).toEqual(["nuevo", "post-1"]);
    expect(posts[0].author).toMatchObject({
      name: "autor",
      jobTitle: "Fundador",
      bio: "Bio",
    });
    expect(JSON.stringify(posts)).not.toContain("@demo.invalid");
  });

  it("getPublishedPostBySlug devuelve null si no existe o es borrador", async () => {
    const db = getDb();
    const { cat } = await crearBase();
    await db
      .insert(post)
      .values({
        ...nuevoPost(cat.id, "autor", "borrador"),
        status: "borrador",
      });
    expect(await getPublishedPostBySlug("no-existe")).toBeNull();
    expect(await getPublishedPostBySlug("borrador")).toBeNull();
    expect((await getPublishedPostBySlug("post-1"))?.body).toEqual([
      { type: "p", text: "texto" },
    ]);
  });

  it("getPublishedPostBySlug lanza con el slug si el body es inválido", async () => {
    const db = getDb();
    await crearBase();
    await db
      .update(post)
      .set({ body: [{ type: "video" }] as never })
      .where(eq(post.slug, "post-1"));
    await expect(getPublishedPostBySlug("post-1")).rejects.toThrow(/post-1/);
  });

  it("getApprovedComments omite pendientes y ocultos, y trae rating, votos y respuesta", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    await db
      .insert(postRating)
      .values({ postId: p.id, userId: "ana", rating: 4 });
    const [ok, ,] = await db
      .insert(comment)
      .values([
        {
          postId: p.id,
          userId: "ana",
          text: "aprobado",
          status: "aprobado",
          replyText: "gracias",
          repliedAt: new Date("2026-11-14"),
        },
        { postId: p.id, userId: "ana", text: "pendiente" },
        { postId: p.id, userId: "ana", text: "oculto", status: "oculto" },
      ])
      .returning();
    await db.insert(comment).values({
      postId: p.id,
      userId: "beto",
      text: "sin rating",
      status: "aprobado",
      createdAt: new Date("2000-01-01"),
    });
    await db.insert(commentVote).values({ commentId: ok.id, userId: "beto" });

    const comments = await getApprovedComments(p.id);
    expect(comments.map((c) => c.text)).toEqual(["aprobado", "sin rating"]);
    expect(comments[0]).toMatchObject({
      authorName: "ana",
      rating: 4,
      usefulCount: 1,
      reply: { text: "gracias" },
    });
    expect(comments[1]).toMatchObject({ rating: null, reply: null });
    expect(JSON.stringify(comments)).not.toContain("@demo.invalid");
  });

  it("getRatingSummary sin valoraciones devuelve ceros", async () => {
    const { post: p } = await crearBase();
    expect(await getRatingSummary(p.id)).toEqual({
      average: 0,
      total: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it("getRatingSummary calcula distribución y promedio sin redondear", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    await db.insert(postRating).values([
      { postId: p.id, userId: "ana", rating: 5 },
      { postId: p.id, userId: "beto", rating: 2 },
    ]);
    expect(await getRatingSummary(p.id)).toEqual({
      average: 3.5,
      total: 2,
      distribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 },
    });
  });
});
