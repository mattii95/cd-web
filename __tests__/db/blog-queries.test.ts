import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { InvalidCursorError } from "@/lib/pagination";
import {
  getApprovedComments,
  getCategories,
  getPublicCategories,
  getPublishedPostBySlug,
  getPublishedPosts,
  getRatingSummary,
  getRelatedPosts,
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

  it("getPublicCategories omite las sin artículos publicados y ordena por position", async () => {
    const db = getDb();
    await db.insert(user).values(nuevoUsuario("autor"));
    const [ia, saas, , soloBorrador] = await db
      .insert(category)
      .values([
        { ...nuevaCategoria("ia"), position: 2 },
        { ...nuevaCategoria("saas"), position: 1 },
        { ...nuevaCategoria("vacia"), position: 3 },
        { ...nuevaCategoria("borrador"), position: 4 },
      ])
      .returning();
    await db.insert(post).values([
      nuevoPost(ia.id, "autor", "p-ia"),
      nuevoPost(saas.id, "autor", "p-saas"),
      { ...nuevoPost(soloBorrador.id, "autor", "p-b"), status: "borrador", publishedAt: null },
    ]);
    expect((await getPublicCategories()).map((c) => c.slug)).toEqual(["saas", "ia"]);
    expect((await getCategories()).map((c) => c.slug)).toEqual(["saas", "ia", "vacia", "borrador"]);
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
    const { items: posts } = await getPublishedPosts();
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
    expect((await getPublishedPostBySlug("post-1"))?.body).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "texto" }] },
      ],
    });
  });

  it("getPublishedPostBySlug lanza con el slug si el body es inválido", async () => {
    const db = getDb();
    await crearBase();
    await db
      .update(post)
      .set({ body: { type: "doc", content: [{ type: "video" }] } as never })
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
    const imgDoc = (attrs: { alt?: string; caption?: string }) => ({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { mediaId, alt: null, caption: null, ...attrs },
        },
      ],
    });
    const setBody = (body: unknown) =>
      getDb()
        .update(post)
        .set({ body: body as never })
        .where(eq(post.slug, "post-1"));

    it("getPublishedPostBySlug resuelve el bloque image con las medidas de media", async () => {
      await crearBase();
      await getDb().insert(media).values(nuevaMedia());
      await setBody(imgDoc({ caption: "Figura 1" }));
      expect((await getPublishedPostBySlug("post-1"))?.body).toEqual({
        type: "doc",
        content: [
          {
            type: "image",
            attrs: {
              image: {
                src: `/media/${mediaId}`,
                width: 1600,
                height: 900,
                alt: "Alt de la biblioteca",
              },
              caption: "Figura 1",
            },
          },
        ],
      });
    });

    it("el alt del bloque pisa el de media", async () => {
      await crearBase();
      await getDb().insert(media).values(nuevaMedia());
      await setBody(imgDoc({ alt: "Alt del bloque" }));
      const body = (await getPublishedPostBySlug("post-1"))?.body;
      expect(body?.content[0]).toMatchObject({
        attrs: { image: { alt: "Alt del bloque" }, caption: null },
      });
    });

    it("getPublishedPostBySlug lanza con el slug y el mediaId si la imagen no existe", async () => {
      await crearBase();
      await setBody(imgDoc({}));
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
      const {
        items: [con, sin],
      } = await getPublishedPosts();
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

    const { items: comments } = await getApprovedComments(p.id);
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

  it("getPublishedPosts pagina de a 12 sin borradores", async () => {
    const db = getDb();
    const { cat } = await crearBase();
    await db.delete(post);
    const base = new Date("2026-11-01T10:00:00Z").getTime();
    await db.insert(post).values(
      Array.from({ length: 16 }, (_, i) => ({
        ...nuevoPost(cat.id, "autor", `p-${i}`),
        ...(i < 14
          ? { publishedAt: new Date(base + i * 1000) }
          : { status: "borrador" as const, publishedAt: null }),
      })),
    );
    const p1 = await getPublishedPosts();
    expect(p1.items).toHaveLength(12);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await getPublishedPosts({ cursor: p1.nextCursor });
    expect(p2.items).toHaveLength(2);
    expect(p2.nextCursor).toBeNull();
    const slugs = [...p1.items, ...p2.items].map((x) => x.slug);
    expect(new Set(slugs).size).toBe(14);
    expect(slugs.some((s) => s === "p-14" || s === "p-15")).toBe(false);
  });

  it("getPublishedPosts desempata por id dos posts con el mismo published_at", async () => {
    const db = getDb();
    const { cat } = await crearBase();
    await db.delete(post);
    const fecha = new Date("2026-11-10T10:00:00Z");
    const creados = await db
      .insert(post)
      .values(
        ["a", "b", "c", "d", "e"].map((s) => ({
          ...nuevoPost(cat.id, "autor", s),
          publishedAt: fecha,
        })),
      )
      .returning();
    const vistos: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<typeof getPublishedPosts>> =
        await getPublishedPosts({ limit: 2, cursor });
      vistos.push(...page.items.map((x) => x.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(vistos).toHaveLength(5);
    expect(new Set(vistos)).toEqual(new Set(creados.map((c) => c.id)));
    const orden = await db.execute<{ id: string }>(
      sql`select id from post order by published_at desc, id desc`,
    );
    expect(vistos).toEqual(orden.rows.map((r) => r.id));
  });

  it("getApprovedComments recorre todos los aprobados con limit 2", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    await db
      .insert(postRating)
      .values({ postId: p.id, userId: "ana", rating: 5 });
    const base = new Date("2026-11-01T10:00:00Z").getTime();
    await db.insert(comment).values([
      ...[0, 1, 2, 3, 4].map((i) => ({
        postId: p.id,
        userId: i % 2 ? "ana" : "beto",
        text: `ok-${i}`,
        status: "aprobado" as const,
        createdAt: new Date(base + i * 1000),
      })),
      { postId: p.id, userId: "ana", text: "pendiente" },
      {
        postId: p.id,
        userId: "ana",
        text: "oculto",
        status: "oculto" as const,
      },
    ]);
    const textos: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<typeof getApprovedComments>> =
        await getApprovedComments(p.id, { limit: 2, cursor });
      textos.push(...page.items.map((c) => c.text));
      cursor = page.nextCursor;
    } while (cursor);
    expect(textos).toEqual(["ok-4", "ok-3", "ok-2", "ok-1", "ok-0"]);
  });

  it("con un cursor inválido las funciones lanzan InvalidCursorError", async () => {
    const { post: p } = await crearBase();
    await expect(
      getPublishedPosts({ cursor: "basura" }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
    await expect(
      getApprovedComments(p.id, { cursor: "basura" }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
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

      const { items: posts } = await getPublishedPosts();
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

  describe("filtros y relacionados", () => {
    const fecha = (d: number) => new Date(Date.UTC(2026, 10, d));

    async function crearEscenario() {
      const db = getDb();
      const { cat, post: p } = await crearBase(); // sistemas, post-1 (10 nov)
      const [ia] = await db
        .insert(category)
        .values({ ...nuevaCategoria("ia"), position: 2 })
        .returning();
      const insertar = async (
        categoryId: string,
        slug: string,
        day: number,
        status: "publicado" | "borrador" = "publicado",
      ) => {
        const [x] = await db
          .insert(post)
          .values({
            ...nuevoPost(categoryId, "autor", slug),
            publishedAt: fecha(day),
            status,
          })
          .returning();
        return x;
      };
      const etiquetar = async (postId: string, ...slugs: string[]) => {
        for (const slug of slugs) {
          const [t] = await db
            .insert(tag)
            .values({ slug, name: slug.toUpperCase() })
            .onConflictDoUpdate({ target: tag.slug, set: { slug } })
            .returning();
          await db.insert(postTag).values({ postId, tagId: t.id });
        }
      };
      return { cat, ia, p, insertar, etiquetar };
    }

    it("category devuelve solo posts publicados de esa categoría", async () => {
      const { ia, insertar } = await crearEscenario();
      await insertar(ia.id, "ia-1", 11);
      const { items } = await getPublishedPosts({ category: "sistemas" });
      expect(items.map((x) => x.slug)).toEqual(["post-1"]);
    });

    it("tag devuelve solo posts con esa etiqueta, con todas sus etiquetas", async () => {
      const { cat, p, insertar, etiquetar } = await crearEscenario();
      const otro = await insertar(cat.id, "otro", 11);
      await etiquetar(p.id, "pymes", "ventas");
      await etiquetar(otro.id, "ventas");
      const { items } = await getPublishedPosts({ tag: "pymes" });
      expect(items.map((x) => x.slug)).toEqual(["post-1"]);
      expect(items[0].tags.map((t) => t.slug)).toEqual(["pymes", "ventas"]);
    });

    it("category y tag se combinan con y", async () => {
      const { ia, p, insertar, etiquetar } = await crearEscenario();
      const enIa = await insertar(ia.id, "ia-1", 11);
      await etiquetar(p.id, "pymes");
      await etiquetar(enIa.id, "pymes");
      const { items } = await getPublishedPosts({
        category: "ia",
        tag: "pymes",
      });
      expect(items.map((x) => x.slug)).toEqual(["ia-1"]);
    });

    it("recorrer con cursor y category devuelve cada post una sola vez", async () => {
      const { cat, ia, insertar } = await crearEscenario();
      for (let i = 1; i <= 5; i++) await insertar(cat.id, `s-${i}`, 10 + i);
      await insertar(ia.id, "ia-1", 20);
      const vistos: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await getPublishedPosts({
          category: "sistemas",
          limit: 2,
          cursor,
        });
        vistos.push(...page.items.map((x) => x.slug));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect([...vistos].sort()).toEqual(
        ["post-1", "s-1", "s-2", "s-3", "s-4", "s-5"].sort(),
      );
    });

    it("una categoría inexistente devuelve una página vacía", async () => {
      await crearEscenario();
      expect(await getPublishedPosts({ category: "no-existe" })).toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it("getRelatedPosts pone primero la misma categoría y excluye borradores y el propio post", async () => {
      const { cat, ia, p, insertar } = await crearEscenario();
      await insertar(ia.id, "ia-nuevo", 20);
      await insertar(cat.id, "sis-viejo", 1);
      await insertar(cat.id, "sis-borrador", 15, "borrador");
      const rel = await getRelatedPosts(p.id, 5);
      expect(rel.map((x) => x.slug)).toEqual(["sis-viejo", "ia-nuevo"]);
    });

    it("getRelatedPosts respeta n y trae las etiquetas", async () => {
      const { cat, p, insertar, etiquetar } = await crearEscenario();
      for (const [slug, day] of [
        ["a", 1],
        ["b", 2],
        ["c", 3],
        ["d", 4],
      ] as const)
        await insertar(cat.id, slug, day);
      const [d] = (await getPublishedPosts()).items.filter(
        (x) => x.slug === "d",
      );
      await etiquetar(d.id, "x");
      const rel = await getRelatedPosts(p.id);
      expect(rel.map((x) => x.slug)).toEqual(["d", "c", "b"]);
      expect(rel[0].tags.map((t) => t.slug)).toEqual(["x"]);
    });

    it("getRelatedPosts con un único post publicado devuelve []", async () => {
      const { p } = await crearEscenario();
      expect(await getRelatedPosts(p.id)).toEqual([]);
    });
  });
});
