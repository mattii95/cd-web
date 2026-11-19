import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/db/client";
import { getPublishedPosts } from "@/db/blog";
import { getMediaUsage } from "@/db/media";
import { authorProfile, category, media, post, user } from "@/db/schema";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }));

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  deletePostAction,
  publishPostAction,
  saveArticleAction,
  unpublishPostAction,
} from "@/actions/admin/articles";

const form = (id: string) => {
  const f = new FormData();
  f.set("id", id);
  return f;
};
const idle = { status: "idle" } as const;
const GONE = { status: "error", message: "Ese artículo ya no existe." };

async function crear(over: Partial<typeof post.$inferInsert> = {}) {
  const db = getDb();
  const [cat] = await db.select().from(category);
  const [p] = await db
    .insert(post)
    .values({ ...nuevoPost(cat.id, "autor", "mi-post"), ...over })
    .returning();
  return p;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({ id: "admin" } as never);
  await resetBlog();
  const db = getDb();
  await db.insert(user).values([nuevoUsuario("autor"), nuevoUsuario("admin")]);
  await db.insert(authorProfile).values({ userId: "autor", jobTitle: "Fundador", bio: "Bio" });
  await db.insert(category).values(nuevaCategoria());
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
});

const actions = [
  ["publishPostAction", publishPostAction],
  ["unpublishPostAction", unpublishPostAction],
  ["deletePostAction", deletePostAction],
] as const;

describe.each(actions)("%s", (_, action) => {
  it("llama a requireAdmin antes de tocar la base", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("no admin"));
    const p = await crear();
    await expect(action(idle, form(p.id))).rejects.toThrow("no admin");
    expect(await getDb().select().from(post)).toHaveLength(1);
  });

  it("con un id que no es UUID devuelve error y no toca la base", async () => {
    const p = await crear();
    expect(await action(idle, form("no-es-uuid"))).toEqual(GONE);
    expect(await getDb().select().from(post).where(eq(post.id, p.id))).toHaveLength(1);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("con un id inexistente devuelve que ya no existe", async () => {
    expect(await action(idle, form(crypto.randomUUID()))).toEqual(GONE);
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("publishPostAction", () => {
  it("publica un borrador e invalida las cachés", async () => {
    const p = await crear({ status: "borrador", publishedAt: null });
    expect(await publishPostAction(idle, form(p.id))).toEqual({
      status: "success",
      message: "Artículo publicado.",
    });
    const [row] = await getDb().select().from(post).where(eq(post.id, p.id));
    expect(row.status).toBe("publicado");
    expect(updateTag).toHaveBeenCalledWith("blog");
    expect(updateTag).toHaveBeenCalledWith("post:mi-post");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/articles");
  });

  it("publicar uno ya publicado devuelve éxito sin invalidar", async () => {
    const p = await crear();
    expect(await publishPostAction(idle, form(p.id))).toMatchObject({ status: "success" });
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe("unpublishPostAction", () => {
  it("pasa a borrador y el post deja de salir en getPublishedPosts", async () => {
    const p = await crear();
    expect((await getPublishedPosts()).items).toHaveLength(1);
    expect(await unpublishPostAction(idle, form(p.id))).toEqual({
      status: "success",
      message: "Artículo pasado a borrador.",
    });
    expect((await getPublishedPosts()).items).toHaveLength(0);
    expect(updateTag).toHaveBeenCalledWith("post:mi-post");
  });
});

describe("deletePostAction", () => {
  it("borra el post", async () => {
    const p = await crear();
    expect(await deletePostAction(idle, form(p.id))).toEqual({
      status: "success",
      message: "Artículo eliminado.",
    });
    expect(await getDb().select().from(post)).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/articles");
  });
});

// ---- saveArticleAction ----

async function articleForm(fields: Record<string, string | string[]> = {}) {
  const [cat] = await getDb().select().from(category);
  const base: Record<string, string | string[]> = {
    id: "",
    intent: "draft",
    updatedAt: "",
    title: "Mi artículo",
    slug: "mi-articulo",
    excerpt: "Resumen",
    cta: "Escribinos",
    categoryId: cat.id,
    body: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hola" }] }],
    }),
    tagSlugs: [],
    newTags: [],
    ...fields,
  };
  const f = new FormData();
  for (const [k, v] of Object.entries(base)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
const filaPost = async (id: string) => (await getDb().select().from(post).where(eq(post.id, id)))[0];

describe("saveArticleAction", () => {
  it("llama a requireAdmin antes de tocar la base", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("no admin"));
    await expect(saveArticleAction(idle, await articleForm())).rejects.toThrow("no admin");
    expect(await getDb().select().from(post)).toHaveLength(0);
  });

  it("sin id e intent draft crea el borrador con el autor admin", async () => {
    const r = await saveArticleAction(idle, await articleForm({ newTags: ["SEO"] }));
    expect(r).toMatchObject({ status: "success", message: "Borrador guardado.", postStatus: "borrador" });
    if (r.status !== "success") return;
    expect(await filaPost(r.id)).toMatchObject({ status: "borrador", authorId: "admin" });
  });

  it("tagSlugs inexistente responde el toast de etiqueta y no crea nada", async () => {
    const r = await saveArticleAction(idle, await articleForm({ tagSlugs: ["borrada"] }));
    expect(r).toMatchObject({
      status: "error",
      message: "Una de las etiquetas ya no existe. Recargá la página.",
    });
    expect(await getDb().select().from(post)).toHaveLength(0);
  });

  it("publish publica, sale en getPublishedPosts e invalida cachés", async () => {
    const r = await saveArticleAction(idle, await articleForm({ intent: "publish" }));
    expect(r).toMatchObject({ status: "success", message: "Artículo publicado.", slug: "mi-articulo" });
    expect(updateTag).toHaveBeenCalledWith("blog");
    expect(updateTag).toHaveBeenCalledWith("post:mi-articulo");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/articles");
    const list = await getPublishedPosts();
    expect(list.items.map((p) => p.slug)).toContain("mi-articulo");
  });

  it("unpublish pasa a borrador y deja de salir en getPublishedPosts", async () => {
    const c = await saveArticleAction(idle, await articleForm({ intent: "publish" }));
    if (c.status !== "success") throw new Error("setup");
    const r = await saveArticleAction(
      idle,
      await articleForm({ intent: "unpublish", id: c.id, updatedAt: c.updatedAt }),
    );
    expect(r).toMatchObject({ status: "success", message: "Artículo pasado a borrador.", postStatus: "borrador" });
    const list = await getPublishedPosts();
    expect(list.items).toHaveLength(0);
  });

  it("save sobre un publicado no cambia status ni published_at", async () => {
    const c = await saveArticleAction(idle, await articleForm({ intent: "publish" }));
    if (c.status !== "success") throw new Error("setup");
    const antes = await filaPost(c.id);
    const r = await saveArticleAction(
      idle,
      await articleForm({ intent: "save", id: c.id, updatedAt: c.updatedAt, title: "Otro título" }),
    );
    expect(r).toMatchObject({ status: "success", message: "Cambios guardados.", postStatus: "publicado" });
    const despues = await filaPost(c.id);
    expect(despues).toMatchObject({ status: "publicado", title: "Otro título" });
    expect(despues.publishedAt).toEqual(antes.publishedAt);
  });

  it("cambiar el slug de un borrador invalida el slug nuevo y el anterior", async () => {
    const c = await saveArticleAction(idle, await articleForm());
    if (c.status !== "success") throw new Error("setup");
    vi.clearAllMocks();
    await saveArticleAction(
      idle,
      await articleForm({ id: c.id, updatedAt: c.updatedAt, slug: "nuevo-slug" }),
    );
    expect(updateTag).toHaveBeenCalledWith("post:nuevo-slug");
    expect(updateTag).toHaveBeenCalledWith("post:mi-articulo");
  });

  it("slug repetido, updatedAt viejo e id inexistente devuelven su mensaje", async () => {
    await crear({ slug: "ocupado" });
    expect(await saveArticleAction(idle, await articleForm({ slug: "ocupado" }))).toEqual({
      status: "error",
      fieldErrors: { slug: "Ya hay un artículo con esa URL." },
    });

    const c = await saveArticleAction(idle, await articleForm());
    if (c.status !== "success") throw new Error("setup");
    const viejo = new Date(new Date(c.updatedAt).getTime() - 5000).toISOString();
    expect(await saveArticleAction(idle, await articleForm({ id: c.id, updatedAt: viejo }))).toEqual({
      status: "error",
      message: "Alguien modificó este artículo. Recargá para ver los cambios.",
    });

    expect(
      await saveArticleAction(idle, await articleForm({ id: crypto.randomUUID(), updatedAt: c.updatedAt })),
    ).toEqual(GONE);
    expect(await saveArticleAction(idle, await articleForm({ id: "no-es-uuid" }))).toEqual(GONE);
  });

  it("al guardar bien revalida /admin/media", async () => {
    await saveArticleAction(idle, await articleForm());
    expect(revalidatePath).toHaveBeenCalledWith("/admin/media");
  });

  it("con una portada que no existe devuelve el toast, no guarda ni revalida", async () => {
    const r = await saveArticleAction(
      idle,
      await articleForm({ coverMediaId: crypto.randomUUID() }),
    );
    expect(r).toEqual({
      status: "error",
      message: "Una de las imágenes ya no está en Medios. Elegí otra.",
    });
    expect(await getDb().select().from(post)).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("guardar una portada la deja en cover_media_id y en el uso de la imagen", async () => {
    const [m] = await getDb()
      .insert(media)
      .values({ sha256: "u", alt: "Alt", width: 1, height: 1, bytes: 1, originalName: "u.png" })
      .returning();
    const r = await saveArticleAction(idle, await articleForm({ coverMediaId: m.id }));
    if (r.status !== "success") throw new Error("setup");
    expect((await filaPost(r.id)).coverMediaId).toBe(m.id);
    expect(await getMediaUsage(m.id)).toEqual([
      { postId: r.id, slug: "mi-articulo", title: "Mi artículo", as: "portada" },
    ]);
  });

  it("errores de validación vuelven por campo y no escriben", async () => {
    const r = await saveArticleAction(idle, await articleForm({ intent: "publish", excerpt: "" }));
    expect(r).toMatchObject({ status: "error", fieldErrors: { excerpt: expect.any(String) } });
    expect(await getDb().select().from(post)).toHaveLength(0);
  });

  it("un body con un enlace javascript: devuelve error y no escribe", async () => {
    const body = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] },
          ],
        },
      ],
    });
    const r = await saveArticleAction(idle, await articleForm({ body }));
    expect(r).toMatchObject({ status: "error", fieldErrors: { body: expect.any(String) } });
    expect(await getDb().select().from(post)).toHaveLength(0);
  });
});
