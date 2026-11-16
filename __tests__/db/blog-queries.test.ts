import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import {
  getApprovedComments,
  getCategories,
  getPublishedPostBySlug,
  getPublishedPosts,
  getRatingSummary,
  getTags,
} from "@/db/blog";
import { closeDb, getDb } from "@/db/client";
import {
  authorProfile,
  category,
  comment,
  commentVote,
  media,
  post,
  postRating,
  postTag,
  tag,
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
    await db.insert(post).values({
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

  describe("imágenes", () => {
    const mediaId = "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11";
    const nuevaMedia = (over: Partial<typeof media.$inferInsert> = {}) => ({
      id: mediaId,
      sha256: "a".repeat(64),
      alt: "Alt de la biblioteca",
      width: 1600,
      height: 900,
      bytes: 1234,
      originalName: "x.png",
      ...over,
    });
    const setBody = (body: unknown) =>
      getDb()
        .update(post)
        .set({ body: body as never })
        .where(eq(post.slug, "post-1"));

    it("getPublishedPostBySlug resuelve el bloque image con las medidas de media", async () => {
      await crearBase();
      await getDb().insert(media).values(nuevaMedia());
      await setBody([{ type: "image", mediaId, caption: "Figura 1" }]);
      expect((await getPublishedPostBySlug("post-1"))?.body).toEqual([
        {
          type: "image",
          image: {
            src: `/media/${mediaId}`,
            width: 1600,
            height: 900,
            alt: "Alt de la biblioteca",
          },
          caption: "Figura 1",
        },
      ]);
    });

    it("el alt del bloque pisa el de media", async () => {
      await crearBase();
      await getDb().insert(media).values(nuevaMedia());
      await setBody([{ type: "image", mediaId, alt: "Alt del bloque" }]);
      const body = (await getPublishedPostBySlug("post-1"))?.body;
      expect(body?.[0]).toMatchObject({ image: { alt: "Alt del bloque" } });
      expect(body?.[0]).not.toHaveProperty("caption");
    });

    it("getPublishedPostBySlug lanza con el slug y el mediaId si la imagen no existe", async () => {
      await crearBase();
      await setBody([{ type: "image", mediaId }]);
      await expect(getPublishedPostBySlug("post-1")).rejects.toThrow(
        new RegExp(`post-1.*${mediaId}`),
      );
    });

    it("getPublishedPosts trae cover resuelto, o null sin portada", async () => {
      const { cat } = await crearBase();
      await getDb().insert(media).values(nuevaMedia());
      await getDb()
        .insert(post)
        .values({
          ...nuevoPost(cat.id, "autor", "con-portada"),
          coverMediaId: mediaId,
          publishedAt: new Date("2026-11-12"),
        });
      const [con, sin] = await getPublishedPosts();
      expect(con.cover).toEqual({
        src: `/media/${mediaId}`,
        width: 1600,
        height: 900,
        alt: "Alt de la biblioteca",
      });
      expect(sin.cover).toBeNull();
    });
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

  describe("etiquetas", () => {
    async function etiquetar(postId: string, ...slugs: string[]) {
      const db = getDb();
      for (const slug of slugs) {
        const [t] = await db
          .insert(tag)
          .values({ slug, name: slug.toUpperCase() })
          .onConflictDoUpdate({ target: tag.slug, set: { slug } })
          .returning();
        await db.insert(postTag).values({ postId, tagId: t.id });
      }
    }

    it("getTags no cuenta borradores ni devuelve etiquetas sin posts publicados", async () => {
      const db = getDb();
      const { cat, post: p } = await crearBase();
      const [borrador] = await db
        .insert(post)
        .values({
          ...nuevoPost(cat.id, "autor", "borrador"),
          status: "borrador",
        })
        .returning();
      await etiquetar(p.id, "visible");
      await etiquetar(borrador.id, "visible", "solo-borrador");
      await db.insert(tag).values({ slug: "huerfana", name: "Huérfana" });

      expect(await getTags()).toEqual([
        { slug: "visible", name: "VISIBLE", count: 1 },
      ]);
    });

    it("getTags ordena por cantidad descendente y slug ascendente", async () => {
      const db = getDb();
      const { cat, post: p } = await crearBase();
      const [p2] = await db
        .insert(post)
        .values(nuevoPost(cat.id, "autor", "post-2"))
        .returning();
      await etiquetar(p.id, "b", "a", "comun");
      await etiquetar(p2.id, "comun");

      const tags = await getTags();
      expect(tags.map((t) => [t.slug, t.count])).toEqual([
        ["comun", 2],
        ["a", 1],
        ["b", 1],
      ]);
    });

    it("getPublishedPosts trae las etiquetas por slug, y [] sin etiquetas", async () => {
      const db = getDb();
      const { cat, post: p } = await crearBase();
      await db.insert(post).values({
        ...nuevoPost(cat.id, "autor", "sin-tags"),
        publishedAt: new Date("2026-11-01"),
      });
      await etiquetar(p.id, "zeta", "alfa");

      const posts = await getPublishedPosts();
      expect(posts.find((x) => x.slug === "post-1")?.tags).toEqual([
        { slug: "alfa", name: "ALFA" },
        { slug: "zeta", name: "ZETA" },
      ]);
      expect(posts.find((x) => x.slug === "sin-tags")?.tags).toEqual([]);
    });

    it("getPublishedPosts resuelve las etiquetas con una sola consulta, sin importar cuántos posts", async () => {
      const db = getDb();
      const { cat, post: p } = await crearBase();
      await etiquetar(p.id, "uno");
      const spy = vi.spyOn(Pool.prototype, "query");
      try {
        await getPublishedPosts();
        const conUno = spy.mock.calls.length;
        spy.mockClear();

        for (const slug of ["a", "b", "c"]) {
          const [x] = await db
            .insert(post)
            .values(nuevoPost(cat.id, "autor", slug))
            .returning();
          await etiquetar(x.id, `t-${slug}`);
        }
        spy.mockClear();
        await getPublishedPosts();
        expect(spy.mock.calls.length).toBe(conUno);
        expect(conUno).toBe(2); // posts + etiquetas
      } finally {
        spy.mockRestore();
      }
    });
  });
});
