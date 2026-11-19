import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  moveCategory,
  updateCategory,
} from "@/db/admin-categories";
import { closeDb, getDb } from "@/db/client";
import { category, post, user } from "@/db/schema";
import type { CategoryInput } from "@/lib/admin/taxonomy-form";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

const input = (slug: string, over: Partial<CategoryInput> = {}): CategoryInput => ({
  label: slug,
  filterLabel: slug,
  slug,
  serviceSlug: "desarrollo-web",
  icon: "bolt",
  ...over,
});
const slugs = async () => (await listAdminCategories()).map((c) => c.slug);

async function conPost(categoryId: string, slug: string, status: "publicado" | "borrador") {
  await getDb()
    .insert(post)
    .values({
      ...nuevoPost(categoryId, "autor", slug),
      status,
      publishedAt: status === "publicado" ? new Date("2026-11-10") : null,
    });
}

beforeEach(async () => {
  await resetBlog();
  await getDb().insert(user).values(nuevoUsuario("autor"));
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
});

describe("createCategory", () => {
  it("guarda la categoría con position = la última + 1", async () => {
    const db = getDb();
    await db.insert(category).values([
      { ...nuevaCategoria("a"), position: 0 },
      { ...nuevaCategoria("b"), position: 4 },
    ]);
    const r = await createCategory(input("c"));
    expect(r).toMatchObject({ ok: true, slug: "c", previousSlug: null });
    const [row] = await db.select().from(category).where(eq(category.slug, "c"));
    expect(row).toMatchObject({ position: 5, icon: "bolt", serviceSlug: "desarrollo-web" });
  });

  it("la primera categoría queda en la posición 0", async () => {
    await createCategory(input("a"));
    expect((await listAdminCategories())[0].position).toBe(0);
  });

  it("con un slug repetido devuelve slug-taken y no cambia nada", async () => {
    await createCategory(input("a"));
    expect(await createCategory(input("a", { label: "otra" }))).toEqual({
      ok: false,
      reason: "slug-taken",
    });
    expect(await listAdminCategories()).toHaveLength(1);
  });
});

describe("updateCategory", () => {
  it("con un slug que usa otra categoría devuelve slug-taken y no cambia nada", async () => {
    await createCategory(input("a"));
    const b = await createCategory(input("b"));
    if (!b.ok) throw new Error("setup");
    expect(await updateCategory(b.id, input("a", { label: "Nueva" }))).toEqual({
      ok: false,
      reason: "slug-taken",
    });
    expect((await listAdminCategories()).map((c) => c.label)).toEqual(["a", "b"]);
  });

  it("sin publicados cambia el slug y devuelve el anterior", async () => {
    const a = await createCategory(input("a"));
    if (!a.ok) throw new Error("setup");
    await conPost(a.id, "borrador-1", "borrador");
    const r = await updateCategory(a.id, input("nuevo", { label: "Nuevo", icon: "chat" }));
    expect(r).toEqual({ ok: true, id: a.id, slug: "nuevo", previousSlug: "a" });
    expect((await listAdminCategories())[0]).toMatchObject({
      slug: "nuevo",
      label: "Nuevo",
      icon: "chat",
    });
  });

  it("con artículos publicados ignora un slug distinto y devuelve previousSlug null", async () => {
    const a = await createCategory(input("a"));
    if (!a.ok) throw new Error("setup");
    await conPost(a.id, "pub-1", "publicado");
    const r = await updateCategory(a.id, input("otro", { label: "Cambiada" }));
    expect(r).toEqual({ ok: true, id: a.id, slug: "a", previousSlug: null });
    expect((await listAdminCategories())[0]).toMatchObject({ slug: "a", label: "Cambiada" });
  });

  it("un id inexistente devuelve not-found", async () => {
    expect(await updateCategory("nope", input("a"))).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("moveCategory", () => {
  async function tres() {
    const ids: string[] = [];
    for (const s of ["a", "b", "c"]) {
      const r = await createCategory(input(s));
      if (!r.ok) throw new Error("setup");
      ids.push(r.id);
    }
    return ids;
  }

  it('"down" sobre la primera la intercambia con la segunda', async () => {
    const [a] = await tres();
    expect(await moveCategory(a, "down")).toEqual({ ok: true, position: 2 });
    expect(await slugs()).toEqual(["b", "a", "c"]);
  });

  it('"up" sobre la tercera sube un lugar', async () => {
    const [, , c] = await tres();
    expect(await moveCategory(c, "up")).toEqual({ ok: true, position: 2 });
    expect(await slugs()).toEqual(["a", "c", "b"]);
  });

  it('"up" sobre la primera y "down" sobre la última devuelven edge y no cambian nada', async () => {
    const [a, , c] = await tres();
    expect(await moveCategory(a, "up")).toEqual({ ok: false, reason: "edge" });
    expect(await moveCategory(c, "down")).toEqual({ ok: false, reason: "edge" });
    expect(await slugs()).toEqual(["a", "b", "c"]);
  });

  it("un id inexistente devuelve not-found", async () => {
    await tres();
    expect(await moveCategory("nope", "up")).toEqual({ ok: false, reason: "not-found" });
  });

  it("con posiciones repetidas el movimiento las corrige", async () => {
    await tres();
    await getDb().update(category).set({ position: 7 });
    // Con posiciones iguales el orden sale del id (aleatorio): se mueve la que quedó primera.
    const [primera] = await listAdminCategories();
    expect(await moveCategory(primera.id, "down")).toMatchObject({ ok: true });
    const posiciones = (await listAdminCategories()).map((c) => c.position);
    expect(posiciones).toEqual([0, 1, 2]);
  });
});

describe("deleteCategory", () => {
  it("con un borrador devuelve in-use con total 1 y no la borra", async () => {
    const a = await createCategory(input("a"));
    if (!a.ok) throw new Error("setup");
    await conPost(a.id, "b-1", "borrador");
    expect(await deleteCategory(a.id)).toEqual({ ok: false, reason: "in-use", total: 1 });
    expect(await slugs()).toEqual(["a"]);
  });

  it("sin artículos la borra", async () => {
    const a = await createCategory(input("a"));
    if (!a.ok) throw new Error("setup");
    expect(await deleteCategory(a.id)).toEqual({ ok: true });
    expect(await slugs()).toEqual([]);
  });

  it("un id inexistente devuelve not-found", async () => {
    expect(await deleteCategory("nope")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("listAdminCategories", () => {
  it("devuelve published y total correctos con borradores y publicados mezclados", async () => {
    const a = await createCategory(input("a"));
    const b = await createCategory(input("b"));
    if (!a.ok || !b.ok) throw new Error("setup");
    await conPost(a.id, "p1", "publicado");
    await conPost(a.id, "p2", "publicado");
    await conPost(a.id, "p3", "borrador");
    expect(await listAdminCategories()).toMatchObject([
      { slug: "a", published: 2, total: 3 },
      { slug: "b", published: 0, total: 0 },
    ]);
  });

  it("ordena por position", async () => {
    await getDb().insert(category).values([
      { ...nuevaCategoria("z"), position: 1 },
      { ...nuevaCategoria("y"), position: 0 },
    ]);
    expect(await slugs()).toEqual(["y", "z"]);
  });
});
