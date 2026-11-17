import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { deletePost, listAdminPosts, setPostStatus } from "@/db/admin-posts";
import { closeDb, getDb } from "@/db/client";
import {
  authorProfile,
  category,
  comment,
  commentVote,
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
