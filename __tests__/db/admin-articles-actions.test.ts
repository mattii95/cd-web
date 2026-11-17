import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/db/client";
import { getPublishedPosts } from "@/db/blog";
import { authorProfile, category, post, user } from "@/db/schema";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }));

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  deletePostAction,
  publishPostAction,
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
  await db.insert(user).values(nuevoUsuario("autor"));
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
