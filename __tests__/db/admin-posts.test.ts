import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPost,
  deletePost,
  getPostForEdit,
  listAdminPosts,
  listAllTags,
  setPostStatus,
  updatePost,
} from "@/db/admin-posts";
import type { BlogDoc } from "@/db/blog-body";
import type { ArticleInput } from "@/lib/admin/article-form";
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
import { type AdminPostQuery, DEFAULT_QUERY } from "@/lib/admin/article-params";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

const q = (over: Partial<AdminPostQuery> = {}): AdminPostQuery => ({ ...DEFAULT_QUERY, ...over });
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

let catId: string;
let otherCatId: string;

beforeEach(async () => {
  await resetBlog();
  const db = getDb();
  await db.insert(user).values(nuevoUsuario("autor"));
  await db.insert(authorProfile).values({ userId: "autor", jobTitle: "Fundador", bio: "Bio" });
  [{ id: catId }, { id: otherCatId }] = await db
    .insert(category)
    .values([
      nuevaCategoria("sistemas"),
      { ...nuevaCategoria("seo"), position: 2 },
    ])
    .returning();
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
});

async function crear(slug: string, over: Partial<typeof post.$inferInsert> = {}) {
  const [p] = await getDb()
    .insert(post)
    .values({ ...nuevoPost(catId, "autor", slug), ...over })
    .returning();
  return p;
}

describe("listAdminPosts", () => {
  it("sin filtros devuelve publicados y borradores por updated_at desc", async () => {
    await crear("viejo", { updatedAt: daysAgo(5) });
    await crear("borrador", { status: "borrador", publishedAt: null, updatedAt: daysAgo(1) });
    await crear("medio", { updatedAt: daysAgo(3) });
    const r = await listAdminPosts(q());
    expect(r.items.map((i) => i.slug)).toEqual(["borrador", "medio", "viejo"]);
    expect(r.items[0]).toMatchObject({
      status: "borrador",
      category: { slug: "sistemas", label: "sistemas" },
      readingMinutes: 5,
    });
  });

  it("status draft devuelve solo borradores y counts no cambia", async () => {
    await crear("pub");
    await crear("bor", { status: "borrador", publishedAt: null });
    const r = await listAdminPosts(q({ status: "draft" }));
    expect(r.items.map((i) => i.slug)).toEqual(["bor"]);
    expect(r.total).toBe(1);
    expect(r.counts).toEqual({ all: 2, publicado: 1, borrador: 1 });
  });

  it("q busca en título y slug sin distinguir mayúsculas; % no devuelve todo", async () => {
    await crear("a", { title: "Guía de SEO" });
    await crear("seo-tecnico", { title: "Otro" });
    await crear("c", { title: "Nada" });
    const r = await listAdminPosts(q({ q: "seo" }));
    expect(r.items.map((i) => i.slug).sort()).toEqual(["a", "seo-tecnico"]);
    expect((await listAdminPosts(q({ q: "%" }))).items).toEqual([]);
    expect((await listAdminPosts(q({ q: "_" }))).items).toEqual([]);
  });

  it("category filtra por slug; uno inexistente devuelve vacío", async () => {
    await crear("s");
    await crear("o", { categoryId: otherCatId });
    expect((await listAdminPosts(q({ category: "seo" }))).items.map((i) => i.slug)).toEqual(["o"]);
    const r = await listAdminPosts(q({ category: "nope" }));
    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("updated 7d excluye un post de hace 10 días", async () => {
    await crear("reciente", { updatedAt: daysAgo(2) });
    await crear("viejo", { updatedAt: daysAgo(10) });
    expect((await listAdminPosts(q({ updated: "7d" }))).items.map((i) => i.slug)).toEqual([
      "reciente",
    ]);
    expect((await listAdminPosts(q({ updated: "30d" }))).total).toBe(2);
  });

  it("updated year excluye un post del año pasado", async () => {
    await crear("este", { updatedAt: new Date() });
    await crear("pasado", { updatedAt: new Date(`${new Date().getFullYear() - 1}-06-01`) });
    expect((await listAdminPosts(q({ updated: "year" }))).items.map((i) => i.slug)).toEqual([
      "este",
    ]);
  });

  it("sort title asc ignora mayúsculas", async () => {
    await crear("1", { title: "banana" });
    await crear("2", { title: "Cereza" });
    await crear("3", { title: "Anana" });
    const r = await listAdminPosts(q({ sort: "title", dir: "asc" }));
    expect(r.items.map((i) => i.title)).toEqual(["Anana", "banana", "Cereza"]);
  });

  it("con reading_minutes repetido el orden es estable entre páginas", async () => {
    for (let i = 0; i < 12; i++) await crear(`p${i}`, { readingMinutes: 5 });
    const ids = async (page: number) =>
      (await listAdminPosts(q({ sort: "readingTime", perPage: 10, page }))).items.map((i) => i.id);
    const todos = [...(await ids(1)), ...(await ids(2))];
    expect(todos).toHaveLength(12);
    expect(new Set(todos).size).toBe(12);
  });

  it("pagina con limit/offset y acota page a la última", async () => {
    for (let i = 1; i <= 30; i++) {
      await crear(`p${String(i).padStart(2, "0")}`, { title: `t${String(i).padStart(2, "0")}` });
    }
    const base = q({ sort: "title", dir: "asc", perPage: 10 });
    const r = await listAdminPosts({ ...base, page: 2 });
    expect(r.items.map((i) => i.title)).toEqual(
      Array.from({ length: 10 }, (_, i) => `t${String(i + 11).padStart(2, "0")}`),
    );
    expect(r).toMatchObject({ total: 30, pageCount: 3, page: 2 });
    const last = await listAdminPosts({ ...base, page: 9 });
    expect(last.page).toBe(3);
    expect(last.items[0].title).toBe("t21");
  });

  it("sin posts pageCount es 1 e items vacío", async () => {
    const r = await listAdminPosts(q());
    expect(r).toMatchObject({ items: [], total: 0, pageCount: 1, page: 1 });
    expect(r.counts).toEqual({ all: 0, publicado: 0, borrador: 0 });
  });
});

describe("setPostStatus", () => {
  it("publicar un borrador sin fecha fija published_at", async () => {
    const p = await crear("b", { status: "borrador", publishedAt: null });
    expect(await setPostStatus(p.id, "publicado")).toEqual({ slug: "b", changed: true });
    const [row] = await getDb().select().from(post).where(eq(post.id, p.id));
    expect(row.status).toBe("publicado");
    expect(row.publishedAt).not.toBeNull();
  });

  it("publicar uno que ya tenía fecha la conserva", async () => {
    const fecha = new Date("2026-01-05");
    const p = await crear("b", { status: "borrador", publishedAt: fecha });
    await setPostStatus(p.id, "publicado");
    const [row] = await getDb().select().from(post).where(eq(post.id, p.id));
    expect(row.publishedAt).toEqual(fecha);
  });

  it("pasar a borrador conserva published_at", async () => {
    const p = await crear("a");
    expect(await setPostStatus(p.id, "borrador")).toEqual({ slug: "a", changed: true });
    const [row] = await getDb().select().from(post).where(eq(post.id, p.id));
    expect(row.status).toBe("borrador");
    expect(row.publishedAt).toEqual(p.publishedAt);
  });

  it("con el mismo estado devuelve changed false; con id inexistente, null", async () => {
    const p = await crear("a");
    expect(await setPostStatus(p.id, "publicado")).toEqual({ slug: "a", changed: false });
    expect(await setPostStatus("no-existe", "publicado")).toBeNull();
  });
});

describe("deletePost", () => {
  it("borra el post y sus etiquetas, valoraciones, comentarios y votos", async () => {
    const db = getDb();
    const p = await crear("a");
    await db.insert(user).values(nuevoUsuario("ana"));
    const [t] = await db.insert(tag).values({ slug: "t", name: "T" }).returning();
    await db.insert(postTag).values({ postId: p.id, tagId: t.id });
    await db.insert(postRating).values({ postId: p.id, userId: "ana", rating: 4 });
    const [c] = await db
      .insert(comment)
      .values({ postId: p.id, userId: "ana", text: "hola", status: "aprobado" })
      .returning();
    await db.insert(commentVote).values({ commentId: c.id, userId: "autor" });

    expect(await deletePost(p.id)).toEqual({ slug: "a" });
    expect(await db.select().from(post)).toHaveLength(0);
    expect(await db.select().from(postTag)).toHaveLength(0);
    expect(await db.select().from(postRating)).toHaveLength(0);
    expect(await db.select().from(comment)).toHaveLength(0);
    expect(await db.select().from(commentVote)).toHaveLength(0);
    expect(await db.select().from(tag)).toHaveLength(1);
  });

  it("con un id inexistente devuelve null", async () => {
    expect(await deletePost("no-existe")).toBeNull();
  });
});

// ---- Editor de artículos ----

const words = (n: number) => Array.from({ length: n }, () => "palabra").join(" ");
const docOf = (text: string): BlogDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const input = (over: Partial<ArticleInput> = {}): ArticleInput => ({
  title: "Título",
  slug: "titulo",
  excerpt: "Resumen",
  cta: "Escribinos",
  categoryId: catId,
  body: docOf("Hola"),
  tags: [],
  coverMediaId: null,
  ...over,
});
const fila = async (id: string) =>
  (await getDb().select().from(post).where(eq(post.id, id)))[0];
const tagsDe = async (id: string) =>
  (
    await getDb()
      .select({ slug: tag.slug })
      .from(postTag)
      .innerJoin(tag, eq(tag.id, postTag.tagId))
      .where(eq(postTag.postId, id))
  )
    .map((r) => r.slug)
    .sort();

async function subirMedia(n: number) {
  return getDb()
    .insert(media)
    .values(
      Array.from({ length: n }, (_, i) => ({
        sha256: `cp-${i}`,
        alt: `Alt ${i}`,
        width: 1,
        height: 1,
        bytes: 1,
        originalName: `${i}.png`,
      })),
    )
    .returning();
}
const bodyConImagen = (mediaId: string): BlogDoc => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Hola" }] },
    { type: "image", attrs: { mediaId, alt: null, caption: null } },
  ],
});

describe("createPost", () => {
  it("borrador: sin published_at, autor, minutos del cuerpo y etiquetas nuevas", async () => {
    const body = docOf(words(450));
    const r = await createPost(input({ body, tags: ["SEO Local", "Web"] }), "borrador", "autor");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = await fila(r.id);
    expect(row).toMatchObject({
      status: "borrador",
      publishedAt: null,
      authorId: "autor",
      readingMinutes: 3,
      coverMediaId: null,
      slug: "titulo",
    });
    expect(await tagsDe(r.id)).toEqual(["seo-local", "web"]);
    expect((await listAllTags()).map((t) => t.name)).toEqual(["SEO Local", "Web"]);
  });

  it("con coverMediaId guarda cover_media_id", async () => {
    const [m] = await subirMedia(1);
    const r = await createPost(input({ coverMediaId: m.id }), "borrador", "autor");
    expect(r.ok && (await fila(r.id)).coverMediaId).toBe(m.id);
  });

  it("con una imagen del cuerpo existente se guarda", async () => {
    const [m] = await subirMedia(1);
    const r = await createPost(input({ body: bodyConImagen(m.id) }), "borrador", "autor");
    expect(r.ok).toBe(true);
  });

  it.each(["portada", "cuerpo"])(
    "con una %s que no existe devuelve missing-media y no crea nada, ni etiquetas",
    async (donde) => {
      const huerfano = crypto.randomUUID();
      const over =
        donde === "portada"
          ? { coverMediaId: huerfano }
          : { body: bodyConImagen(huerfano) };
      const r = await createPost(input({ tags: ["Nueva"], ...over }), "borrador", "autor");
      expect(r).toEqual({ ok: false, reason: "missing-media" });
      expect(await getDb().select().from(post)).toHaveLength(0);
      expect(await getDb().select().from(tag)).toHaveLength(0);
    },
  );

  it("publicado fija published_at", async () => {
    const r = await createPost(input(), "publicado", "autor");
    expect(r.ok && (await fila(r.id)).publishedAt).not.toBeNull();
  });

  it("slug repetido devuelve slug-taken y no crea nada, ni etiquetas", async () => {
    await crear("titulo");
    const r = await createPost(input({ tags: ["Nueva"] }), "borrador", "autor");
    expect(r).toEqual({ ok: false, reason: "slug-taken" });
    expect(await getDb().select().from(post)).toHaveLength(1);
    expect(await getDb().select().from(tag)).toHaveLength(0);
  });

  it("reutiliza etiquetas existentes por slug", async () => {
    await getDb().insert(tag).values({ slug: "seo", name: "SEO" });
    await createPost(input({ tags: ["seo"] }), "borrador", "autor");
    const tags = await getDb().select().from(tag);
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("SEO");
  });
});

describe("updatePost", () => {
  async function borrador(slug = "titulo") {
    const r = await createPost(input({ slug, tags: ["a", "b"] }), "borrador", "autor");
    if (!r.ok) throw new Error("setup");
    return r;
  }

  it("guarda los cambios y reemplaza las etiquetas (tag conserva las quitadas)", async () => {
    const c = await borrador();
    const r = await updatePost(
      c.id,
      input({ title: "Nuevo", tags: ["b", "c"] }),
      "borrador",
      c.updatedAt,
    );
    expect(r.ok).toBe(true);
    expect((await fila(c.id)).title).toBe("Nuevo");
    expect(await tagsDe(c.id)).toEqual(["b", "c"]);
    expect((await getDb().select().from(tag)).map((t) => t.slug).sort()).toEqual(["a", "b", "c"]);
  });

  it("updatedAt viejo devuelve stale y no cambia nada; id inexistente, not-found", async () => {
    const c = await borrador();
    const viejo = new Date(c.updatedAt.getTime() - 5000);
    expect(await updatePost(c.id, input({ title: "X" }), "borrador", viejo)).toEqual({
      ok: false,
      reason: "stale",
    });
    expect((await fila(c.id)).title).toBe("Título");
    expect(await updatePost("no-existe", input(), "borrador", c.updatedAt)).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("encadena guardados con el updatedAt devuelto", async () => {
    const c = await borrador();
    const r1 = await updatePost(c.id, input({ title: "Uno" }), "borrador", c.updatedAt);
    if (!r1.ok) throw new Error("r1");
    const r2 = await updatePost(c.id, input({ title: "Dos" }), "borrador", r1.updatedAt);
    expect(r2.ok).toBe(true);
    expect((await fila(c.id)).title).toBe("Dos");
  });

  it("borrador nunca publicado cambia el slug y devuelve el anterior", async () => {
    const c = await borrador();
    const r = await updatePost(c.id, input({ slug: "otro" }), "borrador", c.updatedAt);
    expect(r).toMatchObject({ ok: true, slug: "otro", previousSlug: "titulo" });
  });

  it("post con published_at ignora el slug enviado", async () => {
    const c = await borrador();
    const pub = await updatePost(c.id, input(), "publicado", c.updatedAt);
    if (!pub.ok) throw new Error("pub");
    const r = await updatePost(c.id, input({ slug: "otro" }), "publicado", pub.updatedAt);
    expect(r).toMatchObject({ ok: true, slug: "titulo", previousSlug: null });
    expect((await fila(c.id)).slug).toBe("titulo");
  });

  it("slug de otro post devuelve slug-taken", async () => {
    await crear("ocupado");
    const c = await borrador();
    const r = await updatePost(c.id, input({ slug: "ocupado" }), "borrador", c.updatedAt);
    expect(r).toEqual({ ok: false, reason: "slug-taken" });
  });

  it("publicar fija published_at si estaba vacío; pasar a borrador no lo toca", async () => {
    const c = await borrador();
    const pub = await updatePost(c.id, input(), "publicado", c.updatedAt);
    if (!pub.ok) throw new Error("pub");
    const fecha = (await fila(c.id)).publishedAt;
    expect(fecha).not.toBeNull();
    const back = await updatePost(c.id, input(), "borrador", pub.updatedAt);
    if (!back.ok) throw new Error("back");
    expect((await fila(c.id)).publishedAt).toEqual(fecha);
    const again = await updatePost(c.id, input(), "publicado", back.updatedAt);
    expect(again.ok).toBe(true);
    expect((await fila(c.id)).publishedAt).toEqual(fecha);
  });

  it("nunca cambia author_id", async () => {
    const c = await borrador();
    await updatePost(c.id, input({ title: "Otro" }), "borrador", c.updatedAt);
    expect(await fila(c.id)).toMatchObject({ title: "Otro", authorId: "autor" });
  });

  it("con coverMediaId lo cambia, y con null lo deja vacío", async () => {
    const [m1, m2] = await subirMedia(2);
    const c = await borrador();
    const a = await updatePost(c.id, input({ coverMediaId: m1.id }), "borrador", c.updatedAt);
    if (!a.ok) throw new Error("a");
    expect((await fila(c.id)).coverMediaId).toBe(m1.id);
    const b = await updatePost(c.id, input({ coverMediaId: m2.id }), "borrador", a.updatedAt);
    if (!b.ok) throw new Error("b");
    expect((await fila(c.id)).coverMediaId).toBe(m2.id);
    const n = await updatePost(c.id, input({ coverMediaId: null }), "borrador", b.updatedAt);
    expect(n.ok).toBe(true);
    expect((await fila(c.id)).coverMediaId).toBeNull();
  });

  it.each(["portada", "cuerpo"])(
    "con una %s que no existe devuelve missing-media y no cambia nada",
    async (donde) => {
      const c = await borrador();
      const antes = await fila(c.id);
      const huerfano = crypto.randomUUID();
      const over =
        donde === "portada"
          ? { coverMediaId: huerfano }
          : { body: bodyConImagen(huerfano) };
      const r = await updatePost(
        c.id,
        input({ title: "Otro", tags: ["Nueva"], ...over }),
        "publicado",
        c.updatedAt,
      );
      expect(r).toEqual({ ok: false, reason: "missing-media" });
      expect(await fila(c.id)).toEqual(antes);
      expect(await tagsDe(c.id)).toEqual(["a", "b"]);
      expect((await listAllTags()).map((t) => t.name)).not.toContain("Nueva");
    },
  );
});

describe("getPostForEdit", () => {
  it("devuelve etiquetas, portada e imágenes del cuerpo resueltas", async () => {
    const db = getDb();
    const [m1, m2] = await db
      .insert(media)
      .values([
        { sha256: "1", alt: "Uno", width: 1, height: 1, bytes: 1, originalName: "1.png" },
        { sha256: "2", alt: "Dos", width: 1, height: 1, bytes: 1, originalName: "2.png" },
      ])
      .returning();
    const body: BlogDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x" }] },
        { type: "image", attrs: { mediaId: m1.id, alt: null, caption: null } },
      ],
    };
    const c = await createPost(input({ body, tags: ["Web", "SEO"] }), "borrador", "autor");
    if (!c.ok) throw new Error("setup");
    await db.update(post).set({ coverMediaId: m2.id }).where(eq(post.id, c.id));

    const r = await getPostForEdit(c.id);
    expect(r).toMatchObject({
      id: c.id,
      slug: "titulo",
      status: "borrador",
      categoryId: catId,
      tags: [
        { slug: "seo", name: "SEO" },
        { slug: "web", name: "Web" },
      ],
      cover: { id: m2.id, src: `/media/${m2.id}`, alt: "Dos" },
      images: { [m1.id]: { src: `/media/${m1.id}`, alt: "Uno" } },
    });
    expect(r?.body).toEqual(body);
  });

  it("id inexistente o que no es UUID devuelve null", async () => {
    expect(await getPostForEdit(crypto.randomUUID())).toBeNull();
    expect(await getPostForEdit("no-existe")).toBeNull();
  });
});
