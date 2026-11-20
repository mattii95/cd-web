import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getApprovedComments } from "@/db/blog";
import { closeDb, getDb } from "@/db/client";
import { category, comment, commentVote, post, user } from "@/db/schema";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }));

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  deleteCommentAsAdminAction,
  setCommentStatusAction,
  undoCommentStatusAction,
} from "@/actions/admin/comments";

const idle = { status: "idle" } as const;
const form = (ids: string[], status?: string) => {
  const f = new FormData();
  for (const id of ids) f.append("id", id);
  if (status) f.set("status", status);
  return f;
};
const err = (message: string) => ({ status: "error", message });
const GENERIC = err("No pudimos completar la acción. Intentá de nuevo en unos minutos.");
const GONE = err("Ese comentario ya no existe.");

const uuid = () => crypto.randomUUID();
let postA: string;
let postB: string;
let lector: string;

async function crear(
  extra: Partial<typeof comment.$inferInsert> = {},
  postId = postA,
): Promise<string> {
  const id = uuid();
  await getDb()
    .insert(comment)
    .values({ id, postId, userId: lector, text: "hola", status: "pendiente", ...extra });
  return id;
}
const estadoDe = async (id: string) =>
  (await getDb().select().from(comment).where(eq(comment.id, id)))[0]?.status;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({ id: "adm" } as never);
  await resetBlog();
  const db = getDb();
  const [autor] = await db.insert(user).values(nuevoUsuario("autor")).returning();
  const [lec] = await db.insert(user).values(nuevoUsuario("lector")).returning();
  lector = lec.id;
  const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
  const [a] = await db
    .insert(post)
    .values(nuevoPost(cat.id, autor.id, "senales-sistema-a-medida"))
    .returning();
  const [b] = await db.insert(post).values(nuevoPost(cat.id, autor.id, "otro-post")).returning();
  postA = a.id;
  postB = b.id;
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
});

describe("requireAdmin", () => {
  it("cada action lo llama antes de tocar la base", async () => {
    const id = await crear();
    vi.mocked(requireAdmin).mockRejectedValue(new Error("no admin"));
    await expect(setCommentStatusAction(idle, form([id], "aprobado"))).rejects.toThrow("no admin");
    await expect(undoCommentStatusAction([{ id, status: "oculto" }])).rejects.toThrow("no admin");
    await expect(deleteCommentAsAdminAction(idle, form([id]))).rejects.toThrow("no admin");
    expect(await estadoDe(id)).toBe("pendiente");
    expect(updateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setCommentStatusAction", () => {
  it("aprobar comentarios de dos artículos invalida el tag de cada uno y la lista", async () => {
    const a = await crear({}, postA);
    const b = await crear({}, postB);
    const res = await setCommentStatusAction(idle, form([a, b], "aprobado"));
    expect(res).toMatchObject({ status: "success", message: "Se aprobaron 2 comentarios." });
    expect(updateTag).toHaveBeenCalledTimes(2);
    expect(updateTag).toHaveBeenCalledWith(`comments:${postA}`);
    expect(updateTag).toHaveBeenCalledWith(`comments:${postB}`);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/comments");
  });

  it("mensajes de éxito para 1 y N, aprobar y ocultar", async () => {
    const a = await crear();
    expect(await setCommentStatusAction(idle, form([a], "aprobado"))).toMatchObject({
      message: "Comentario aprobado.",
    });
    expect(await setCommentStatusAction(idle, form([a], "oculto"))).toMatchObject({
      message: "Comentario oculto.",
    });
    const b = await crear();
    expect(await setCommentStatusAction(idle, form([a, b], "aprobado"))).toMatchObject({
      message: "Se aprobaron 2 comentarios.",
    });
    expect(await setCommentStatusAction(idle, form([a, b], "oculto"))).toMatchObject({
      message: "Se ocultaron 2 comentarios.",
    });
  });

  it("si ninguno cambió, no invalida y avisa", async () => {
    const a = await crear({ status: "aprobado" });
    const o = await crear({ status: "oculto" });
    expect(await setCommentStatusAction(idle, form([a], "aprobado"))).toEqual({
      status: "success",
      message: "Esos comentarios ya estaban aprobados.",
    });
    expect(await setCommentStatusAction(idle, form([o], "oculto"))).toEqual({
      status: "success",
      message: "Esos comentarios ya estaban ocultos.",
    });
    expect(updateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("devuelve undo con el estado anterior solo de los que cambiaron", async () => {
    const p = await crear();
    const o = await crear({ status: "oculto" });
    const a = await crear({ status: "aprobado" });
    const res = await setCommentStatusAction(idle, form([p, o, a], "aprobado"));
    expect(res).toMatchObject({ status: "success", message: "Se aprobaron 2 comentarios." });
    if (res.status !== "success") return;
    expect(res.undo).toHaveLength(2);
    expect(res.undo).toEqual(
      expect.arrayContaining([
        { id: p, status: "pendiente" },
        { id: o, status: "oculto" },
      ]),
    );
  });

  it("26 ids, un id que no es UUID o status pendiente dan el error genérico sin cambiar nada", async () => {
    const id = await crear();
    const muchos = Array.from({ length: 26 }, uuid);
    expect(await setCommentStatusAction(idle, form(muchos, "aprobado"))).toEqual(GENERIC);
    expect(await setCommentStatusAction(idle, form([id, "no-uuid"], "aprobado"))).toEqual(GENERIC);
    expect(await setCommentStatusAction(idle, form([id], "pendiente"))).toEqual(GENERIC);
    expect(await setCommentStatusAction(idle, form([], "aprobado"))).toEqual(GENERIC);
    expect(await estadoDe(id)).toBe("pendiente");
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("ningún id existe: 'Ese comentario ya no existe.'", async () => {
    expect(await setCommentStatusAction(idle, form([uuid()], "oculto"))).toEqual(GONE);
  });

  it("un error de base devuelve el mensaje genérico", async () => {
    vi.spyOn(getDb(), "transaction").mockRejectedValueOnce(new Error("db caída"));
    expect(await setCommentStatusAction(idle, form([uuid()], "oculto"))).toEqual(GENERIC);
  });

  it("aprobar un pendiente lo suma al blog público y ocultarlo lo saca", async () => {
    const id = await crear({ text: "me sirvió" });
    expect((await getApprovedComments(postA)).items).toEqual([]);

    await setCommentStatusAction(idle, form([id], "aprobado"));
    expect((await getApprovedComments(postA)).items.map((c) => c.text)).toEqual(["me sirvió"]);

    await setCommentStatusAction(idle, form([id], "oculto"));
    expect((await getApprovedComments(postA)).items).toEqual([]);
  });
});

describe("undoCommentStatusAction", () => {
  it("devuelve cada comentario a su estado anterior e invalida", async () => {
    const a = await crear({}, postA);
    const b = await crear({ status: "oculto" }, postB);
    await setCommentStatusAction(idle, form([a, b], "aprobado"));
    vi.clearAllMocks();

    expect(
      await undoCommentStatusAction([
        { id: a, status: "pendiente" },
        { id: b, status: "oculto" },
      ]),
    ).toEqual({ status: "success", message: "Se deshizo el cambio." });
    expect(await estadoDe(a)).toBe("pendiente");
    expect(await estadoDe(b)).toBe("oculto");
    expect(updateTag).toHaveBeenCalledWith(`comments:${postA}`);
    expect(updateTag).toHaveBeenCalledWith(`comments:${postB}`);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/comments");
  });

  it("datos inválidos dan el error genérico; ids inexistentes, 'ya no existe'", async () => {
    expect(await undoCommentStatusAction([])).toEqual(GENERIC);
    expect(await undoCommentStatusAction([{ id: "no-uuid", status: "pendiente" }])).toEqual(
      GENERIC,
    );
    expect(await undoCommentStatusAction([{ id: uuid(), status: "pendiente" }])).toEqual(GONE);
  });

  it("un error de base devuelve el mensaje genérico", async () => {
    vi.spyOn(getDb(), "transaction").mockRejectedValueOnce(new Error("db caída"));
    expect(await undoCommentStatusAction([{ id: uuid(), status: "pendiente" }])).toEqual(GENERIC);
  });
});

describe("deleteCommentAsAdminAction", () => {
  it("borra el comentario y sus votos e invalida el artículo", async () => {
    const id = await crear({ status: "aprobado" });
    await getDb().insert(commentVote).values({ commentId: id, userId: "autor" });
    expect(await deleteCommentAsAdminAction(idle, form([id]))).toEqual({
      status: "success",
      message: "Comentario borrado.",
    });
    expect(await estadoDe(id)).toBeUndefined();
    expect(await getDb().select().from(commentVote)).toHaveLength(0);
    expect(updateTag).toHaveBeenCalledWith(`comments:${postA}`);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/comments");
    expect((await getApprovedComments(postA)).items).toEqual([]);
  });

  it("id inválido da el error genérico; inexistente, 'ya no existe'", async () => {
    expect(await deleteCommentAsAdminAction(idle, form(["no-uuid"]))).toEqual(GENERIC);
    expect(await deleteCommentAsAdminAction(idle, form([uuid()]))).toEqual(GONE);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("un error de base devuelve el mensaje genérico", async () => {
    vi.spyOn(getDb(), "delete").mockImplementationOnce(() => {
      throw new Error("db caída");
    });
    expect(await deleteCommentAsAdminAction(idle, form([uuid()]))).toEqual(GENERIC);
  });
});
