import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogDoc } from "@/db/blog-body";
import { closeDb, getDb } from "@/db/client";
import { getPublishedPostBySlug } from "@/db/blog";
import { createMedia } from "@/db/media";
import { authorProfile, category, post, user } from "@/db/schema";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }));

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  deleteMediaAction,
  loadMoreMediaAction,
  updateMediaAction,
} from "@/actions/admin/media";

const idle = { status: "idle" } as const;
let dir: string;

const png = (color: string) =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: color } })
    .png()
    .toBuffer();

const subir = async (color: string) =>
  (
    await createMedia({
      file: await png(color),
      originalName: `${color}.png`,
      alt: `Alt ${color}`,
      uploadedBy: null,
    })
  ).item;

async function crearPost(over: Partial<typeof post.$inferInsert>) {
  const db = getDb();
  await db.insert(user).values(nuevoUsuario("autor")).onConflictDoNothing();
  await db
    .insert(authorProfile)
    .values({ userId: "autor", jobTitle: "Fundador", bio: "Bio" })
    .onConflictDoNothing();
  const [cat] = await db.insert(category).values(nuevaCategoria()).onConflictDoNothing().returning();
  const categoryId = cat?.id ?? (await db.select().from(category))[0].id;
  const [p] = await db
    .insert(post)
    .values({ ...nuevoPost(categoryId, "autor"), ...over })
    .returning();
  return p;
}

const editForm = (id: string, alt: string, originalName: string) => {
  const f = new FormData();
  f.set("id", id);
  f.set("alt", alt);
  f.set("originalName", originalName);
  return f;
};

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "cd-media-actions-"));
  process.env.MEDIA_DIR = dir;
});
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({ id: "admin" } as never);
  await resetBlog();
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
  await rm(dir, { recursive: true, force: true });
});

describe("updateMediaAction", () => {
  it("llama a requireAdmin antes de tocar la base", async () => {
    const item = await subir("red");
    vi.mocked(requireAdmin).mockRejectedValue(new Error("no admin"));
    await expect(updateMediaAction(idle, editForm(item.id, "X", "x.png"))).rejects.toThrow(
      "no admin",
    );
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("sin uso devuelve 'Cambios guardados.' e invalida blog", async () => {
    const item = await subir("red");
    expect(await updateMediaAction(idle, editForm(item.id, "Nuevo", "nuevo.png"))).toEqual({
      status: "success",
      message: "Cambios guardados.",
    });
    expect(updateTag).toHaveBeenCalledWith("blog");
  });

  it("alt cambiado en una portada nombra el artículo; solo el nombre no", async () => {
    const item = await subir("red");
    await crearPost({ coverMediaId: item.id, title: "Señales", slug: "senales" });
    expect(await updateMediaAction(idle, editForm(item.id, "Alt nuevo", item.originalName))).toEqual({
      status: "success",
      message: "Cambios guardados. El texto alternativo cambió en: Señales.",
    });
    expect(await updateMediaAction(idle, editForm(item.id, "Alt nuevo", "otro.png"))).toEqual({
      status: "success",
      message: "Cambios guardados.",
    });
  });

  it("alt vacío devuelve el error del campo", async () => {
    const item = await subir("red");
    expect(await updateMediaAction(idle, editForm(item.id, "  ", "x.png"))).toEqual({
      status: "error",
      fieldErrors: { alt: "El texto alternativo no puede estar vacío." },
    });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("con un id inexistente devuelve 'Esa imagen ya no existe.'", async () => {
    expect(
      await updateMediaAction(idle, editForm(crypto.randomUUID(), "X", "x.png")),
    ).toEqual({ status: "error", message: "Esa imagen ya no existe." });
  });

  it("cambiar el alt de Medios cambia el alt del cuerpo sin alt propio", async () => {
    const item = await subir("red");
    const body: BlogDoc = {
      type: "doc",
      content: [{ type: "image", attrs: { mediaId: item.id, alt: null, caption: null } }],
    };
    await crearPost({ slug: "con-imagen", body });
    await updateMediaAction(idle, editForm(item.id, "Alt del blog", item.originalName));
    const detail = await getPublishedPostBySlug("con-imagen");
    const node = detail?.body.content[0];
    expect(node?.type === "image" && node.attrs.image.alt).toBe("Alt del blog");
  });
});

describe("deleteMediaAction", () => {
  it("con un id inexistente devuelve 'Esa imagen ya no existe.'", async () => {
    const f = new FormData();
    f.set("id", crypto.randomUUID());
    expect(await deleteMediaAction(idle, f)).toEqual({
      status: "error",
      message: "Esa imagen ya no existe.",
    });
  });
});

describe("loadMoreMediaAction", () => {
  it("devuelve la tanda filtrada con originalName y usage[].postId", async () => {
    const a = await subir("red");
    const b = await subir("blue");
    const p = await crearPost({ coverMediaId: a.id, title: "A", slug: "a" });
    const page1 = await loadMoreMediaAction({ cursor: "x", query: "", usage: null });
    expect(page1.status).toBe("error"); // cursor inválido

    // Sin cursor válido la primera tanda sale de listMedia; se arma uno con 1 elemento de margen.
    const { listMedia } = await import("@/db/media");
    const first = await listMedia({ limit: 1 });
    const r = await loadMoreMediaAction({
      cursor: first.nextCursor!,
      query: "",
      usage: "used",
    });
    if (r.status !== "success") throw new Error("esperaba success");
    // newest first: [blue, red]; la segunda tanda es red, que está en uso.
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({
      id: a.id,
      originalName: "red.png",
      usage: [{ postId: p.id, title: "A", as: "portada" }],
    });
    expect(b.id).not.toBe(r.items[0].id);
  });

  it("con usage inválido devuelve el error", async () => {
    expect(
      await loadMoreMediaAction({ cursor: "c", query: "", usage: "otro" as never }),
    ).toEqual({ status: "error", message: "No pudimos cargar más imágenes." });
  });
});
