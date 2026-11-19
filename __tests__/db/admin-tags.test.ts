import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTag,
  deleteTag,
  listAdminTags,
  mergeTags,
  searchTagOptions,
  updateTagRow,
} from "@/db/admin-tags";
import { closeDb, getDb } from "@/db/client";
import { category, post, postTag, tag, user } from "@/db/schema";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

let catId: string;

async function etiqueta(slug: string, name = slug.toUpperCase()) {
  const [t] = await getDb().insert(tag).values({ slug, name }).returning();
  return t;
}
// Un artículo con esas etiquetas; `publicado` false lo deja en borrador.
async function articulo(slug: string, tags: { id: string }[], publicado = true) {
  const db = getDb();
  const [p] = await db
    .insert(post)
    .values({
      ...nuevoPost(catId, "autor", slug),
      status: publicado ? "publicado" : "borrador",
      publishedAt: publicado ? new Date("2026-11-10") : null,
    })
    .returning();
  if (tags.length) await db.insert(postTag).values(tags.map((t) => ({ postId: p.id, tagId: t.id })));
  return p;
}
const slugsDe = async (postId: string) =>
  (
    await getDb()
      .select({ slug: tag.slug })
      .from(postTag)
      .innerJoin(tag, eq(tag.id, postTag.tagId))
      .where(eq(postTag.postId, postId))
  )
    .map((r) => r.slug)
    .sort();
const todas = async () => (await getDb().select().from(tag)).map((t) => t.slug).sort();

beforeEach(async () => {
  await resetBlog();
  const db = getDb();
  await db.insert(user).values(nuevoUsuario("autor"));
  [{ id: catId }] = await db.insert(category).values(nuevaCategoria()).returning();
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
});

describe("listAdminTags", () => {
  it("ordena por nombre sin distinguir mayúsculas y cuenta publicados y total", async () => {
    const b = await etiqueta("b", "beta");
    const a = await etiqueta("a", "Alfa");
    await etiqueta("c", "Charlie");
    await articulo("p1", [a, b]);
    await articulo("p2", [a], false);
    const r = await listAdminTags({ q: null, page: 1 });
    expect(r.items.map((t) => [t.name, t.published, t.total])).toEqual([
      ["Alfa", 1, 2],
      ["beta", 1, 1],
      ["Charlie", 0, 0],
    ]);
    expect(r).toMatchObject({ total: 3, page: 1, pageCount: 1 });
  });

  it("pagina de a 25 y acota una página fuera de rango a la última", async () => {
    await getDb()
      .insert(tag)
      .values(Array.from({ length: 30 }, (_, i) => ({ slug: `t${String(i).padStart(2, "0")}`, name: `T${String(i).padStart(2, "0")}` })));
    const p1 = await listAdminTags({ q: null, page: 1 });
    const p2 = await listAdminTags({ q: null, page: 2 });
    expect([p1.items.length, p2.items.length, p1.pageCount]).toEqual([25, 5, 2]);
    expect(p2.items[0].name).toBe("T25");
    expect(await listAdminTags({ q: null, page: 99 })).toMatchObject({ page: 2, pageCount: 2 });
  });

  it("busca por nombre o slug", async () => {
    await etiqueta("seo", "Posicionamiento");
    await etiqueta("ventas", "Ventas");
    expect((await listAdminTags({ q: "posic", page: 1 })).items.map((t) => t.slug)).toEqual(["seo"]);
    expect((await listAdminTags({ q: "SEO", page: 1 })).items.map((t) => t.slug)).toEqual(["seo"]);
    expect((await listAdminTags({ q: "nada", page: 1 })).total).toBe(0);
  });

  it('q: "50%" no devuelve todas', async () => {
    await etiqueta("ventas", "Ventas");
    await etiqueta("descuento", "Descuento 50% off");
    expect((await listAdminTags({ q: "50%", page: 1 })).items.map((t) => t.slug)).toEqual(["descuento"]);
    expect((await listAdminTags({ q: "_", page: 1 })).total).toBe(0);
  });
});

describe("createTag", () => {
  it("crea la etiqueta", async () => {
    const r = await createTag({ name: "Nube", slug: "nube" });
    expect(r).toMatchObject({ ok: true, slug: "nube" });
    expect(await todas()).toEqual(["nube"]);
  });

  it('con un nombre cuyo slugify coincide con otra ("Seo" con SEO) devuelve name-taken', async () => {
    await etiqueta("seo", "SEO");
    expect(await createTag({ name: "Seo", slug: "seo-2" })).toEqual({ ok: false, reason: "name-taken" });
    expect(await createTag({ name: "Séo", slug: "otro" })).toEqual({ ok: false, reason: "name-taken" });
    expect(await todas()).toEqual(["seo"]);
  });

  it("con un slug ocupado devuelve slug-taken", async () => {
    await etiqueta("seo", "SEO");
    expect(await createTag({ name: "Posicionamiento", slug: "seo" })).toEqual({ ok: false, reason: "slug-taken" });
    expect(await todas()).toEqual(["seo"]);
  });
});

describe("updateTagRow", () => {
  it("con publicados cambia el nombre y el slug sigue siendo el mismo", async () => {
    const seo = await etiqueta("seo", "SEO");
    await articulo("p1", [seo]);
    const r = await updateTagRow(seo.id, { name: "Posicionamiento", slug: "otro" });
    expect(r).toEqual({ ok: true, id: seo.id, slug: "seo" });
    const [row] = await getDb().select().from(tag);
    expect(row).toMatchObject({ name: "Posicionamiento", slug: "seo" });
  });

  it("sin publicados cambia el slug", async () => {
    const seo = await etiqueta("seo", "SEO");
    await articulo("borrador-1", [seo], false);
    const r = await updateTagRow(seo.id, { name: "SEO", slug: "posicionamiento" });
    expect(r).toEqual({ ok: true, id: seo.id, slug: "posicionamiento" });
  });

  it("no cuenta como repetido su propio nombre", async () => {
    const seo = await etiqueta("seo", "SEO");
    expect(await updateTagRow(seo.id, { name: "seo", slug: "seo" })).toMatchObject({ ok: true });
  });

  it("con el nombre de otra devuelve name-taken, con su slug slug-taken, y no cambia nada", async () => {
    const seo = await etiqueta("seo", "SEO");
    await etiqueta("web", "Web");
    expect(await updateTagRow(seo.id, { name: "WEB", slug: "x" })).toEqual({ ok: false, reason: "name-taken" });
    expect(await updateTagRow(seo.id, { name: "Otro", slug: "web" })).toEqual({ ok: false, reason: "slug-taken" });
    expect((await getDb().select().from(tag).where(eq(tag.id, seo.id)))[0]).toMatchObject({ name: "SEO", slug: "seo" });
  });

  it("un id inexistente devuelve not-found", async () => {
    expect(await updateTagRow("nope", { name: "x", slug: "x" })).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("mergeTags", () => {
  it("un artículo con A y B y otro solo con A quedan con B una vez; borra A y devuelve moved 2", async () => {
    const a = await etiqueta("a", "A");
    const b = await etiqueta("b", "B");
    const p1 = await articulo("p1", [a, b]);
    const p2 = await articulo("p2", [a]);
    const r = await mergeTags(a.id, b.id);
    expect(r).toEqual({ ok: true, moved: 2, target: "B" });
    expect(await todas()).toEqual(["b"]);
    expect(await slugsDe(p1.id)).toEqual(["b"]);
    expect(await slugsDe(p2.id)).toEqual(["b"]);
    expect(await getDb().select().from(postTag)).toHaveLength(2);
  });

  it("conserva las otras etiquetas de los artículos", async () => {
    const a = await etiqueta("a");
    const b = await etiqueta("b");
    const c = await etiqueta("c");
    const p = await articulo("p1", [a, c]);
    await mergeTags(a.id, b.id);
    expect(await slugsDe(p.id)).toEqual(["b", "c"]);
  });

  it("mergeTags(A, A) devuelve same y no cambia nada", async () => {
    const a = await etiqueta("a");
    await articulo("p1", [a]);
    expect(await mergeTags(a.id, a.id)).toEqual({ ok: false, reason: "same" });
    expect(await todas()).toEqual(["a"]);
    expect(await getDb().select().from(postTag)).toHaveLength(1);
  });

  it("con un id inexistente devuelve not-found y no cambia nada", async () => {
    const a = await etiqueta("a");
    await articulo("p1", [a]);
    expect(await mergeTags(a.id, "nope")).toEqual({ ok: false, reason: "not-found" });
    expect(await mergeTags("nope", a.id)).toEqual({ ok: false, reason: "not-found" });
    expect(await todas()).toEqual(["a"]);
    expect(await getDb().select().from(postTag)).toHaveLength(1);
  });
});

describe("deleteTag", () => {
  it("borra la etiqueta y sus post_tag; los artículos siguen existiendo", async () => {
    const a = await etiqueta("a");
    await articulo("p1", [a]);
    expect(await deleteTag(a.id)).toEqual({ ok: true });
    expect(await todas()).toEqual([]);
    expect(await getDb().select().from(postTag)).toHaveLength(0);
    expect(await getDb().select().from(post)).toHaveLength(1);
  });

  it("un id inexistente devuelve not-found", async () => {
    expect(await deleteTag("nope")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("searchTagOptions", () => {
  it("no devuelve la etiqueta excluida y busca por nombre o slug", async () => {
    const seo = await etiqueta("seo", "SEO");
    await etiqueta("sem", "SEM");
    await etiqueta("web", "Web");
    const r = await searchTagOptions("se", seo.id);
    expect(r.map((t) => t.name)).toEqual(["SEM"]);
  });

  it("devuelve como mucho 10 y cuenta los artículos", async () => {
    const [primera] = await getDb()
      .insert(tag)
      .values(Array.from({ length: 15 }, (_, i) => ({ slug: `t${String(i).padStart(2, "0")}`, name: `T${String(i).padStart(2, "0")}` })))
      .returning();
    await articulo("p1", [primera]);
    const otra = await etiqueta("zeta");
    const r = await searchTagOptions("", otra.id);
    expect(r).toHaveLength(10);
    expect(r[0]).toMatchObject({ name: "T00", total: 1 });
  });
});
