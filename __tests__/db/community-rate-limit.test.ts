import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { category, comment, commentVote, post, postRating, rateLimit, user } from "@/db/schema";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/dal";
import {
  deleteCommentAction,
  deleteReplyAction,
  rateAction,
  saveReplyAction,
  toggleVoteAction,
} from "@/actions/blog/comunidad";

const LIMITE = {
  status: "error",
  message: "Demasiadas acciones seguidas. Probá de nuevo en un minuto.",
};

const sesion = (id: string) =>
  vi.mocked(getCurrentUser).mockResolvedValue({ id, name: id, email: `${id}@demo.invalid` } as never);

// Deja el contador del usuario en `count`, como si ya hubiera usado ese tanto de la ventana.
async function llenar(userId: string, rule: string, count: number) {
  await getDb()
    .insert(rateLimit)
    .values({ id: crypto.randomUUID(), key: `actions|user:${userId}|${rule}`, count, lastRequest: Date.now() })
    .onConflictDoUpdate({ target: rateLimit.key, set: { count, lastRequest: Date.now() } });
}

async function escenario() {
  const db = getDb();
  await db.insert(user).values(["autor", "ana", "beto"].map((id) => nuevoUsuario(id)));
  const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
  const [p] = await db.insert(post).values(nuevoPost(cat.id, "autor")).returning();
  const [c] = await db
    .insert(comment)
    .values({ postId: p.id, userId: "ana", text: "hola", status: "aprobado" })
    .returning();
  return { p, c };
}

describe("rate limit de la comunidad", () => {
  beforeEach(async () => {
    await resetBlog();
    await getDb().delete(rateLimit);
    vi.clearAllMocks();
  });
  afterEach(resetBlog);
  afterAll(closeDb);

  it("el voto 61 en 60 s se rechaza y no cambia el voto", async () => {
    const { c } = await escenario();
    sesion("beto");
    await llenar("beto", "vote", 60);
    expect(await toggleVoteAction(c.id)).toEqual(LIMITE);
    expect(await getDb().select().from(commentVote)).toHaveLength(0);
  });

  it("la valoración 21 se rechaza y la de otro usuario pasa", async () => {
    const { p } = await escenario();
    await llenar("beto", "rate", 20);
    sesion("beto");
    expect(await rateAction(p.id, 4)).toEqual(LIMITE);
    sesion("ana");
    expect(await rateAction(p.id, 4)).toEqual({ status: "success" });
    expect(await getDb().select().from(postRating)).toHaveLength(1);
  });

  it("la respuesta 11 se rechaza", async () => {
    const { c } = await escenario();
    sesion("autor");
    await llenar("autor", "reply", 10);
    expect(await saveReplyAction(c.id, "gracias")).toEqual(LIMITE);
    const [row] = await getDb().select().from(comment).where(eq(comment.id, c.id));
    expect(row.replyText).toBeNull();
  });

  it("el borrado 21 de comentarios o respuestas se rechaza", async () => {
    const { c } = await escenario();
    sesion("ana");
    await llenar("ana", "delete-content", 20);
    expect(await deleteCommentAction(c.id)).toEqual(LIMITE);
    expect(await deleteReplyAction(c.id)).toEqual(LIMITE);
    expect(await getDb().select().from(comment)).toHaveLength(1);
  });

  it("pasada la ventana la acción vuelve a funcionar", async () => {
    const { c } = await escenario();
    sesion("beto");
    await llenar("beto", "vote", 60);
    expect(await toggleVoteAction(c.id)).toEqual(LIMITE);
    await getDb()
      .update(rateLimit)
      .set({ lastRequest: Date.now() - 61_000 })
      .where(eq(rateLimit.key, "actions|user:beto|vote"));
    expect(await toggleVoteAction(c.id)).toMatchObject({ status: "success", voted: true });
  });
});
