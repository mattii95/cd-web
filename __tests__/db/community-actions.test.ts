import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import {
  category,
  comment,
  commentVote,
  post,
  postRating,
  rateLimit,
  user,
} from "@/db/schema";
import {
  nuevaCategoria,
  nuevoPost,
  nuevoUsuario,
  resetBlog,
} from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn() }));

import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  createCommentAction,
  deleteCommentAction,
  deleteReplyAction,
  loadMoreUserCommentsAction,
  rateAction,
  saveReplyAction,
  toggleVoteAction,
} from "@/app/(site)/blog/community-actions";

const SIN_SESION = {
  status: "error",
  message: "Iniciá sesión para continuar.",
};

const sesion = (id: string | null) =>
  vi
    .mocked(getCurrentUser)
    .mockResolvedValue(
      id ? ({ id, name: id, email: `${id}@demo.invalid` } as never) : null,
    );

async function crearEscenario() {
  const db = getDb();
  await db
    .insert(user)
    .values(["autor", "ana", "beto"].map((id) => nuevoUsuario(id)));
  const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
  const [p] = await db
    .insert(post)
    .values(nuevoPost(cat.id, "autor"))
    .returning();
  const [c] = await db
    .insert(comment)
    .values({ postId: p.id, userId: "ana", text: "hola", status: "aprobado" })
    .returning();
  return { p, c };
}

describe("acciones de la comunidad", () => {
  beforeEach(async () => {
    await resetBlog();
    await getDb().delete(rateLimit);
    vi.clearAllMocks();
  });
  afterEach(resetBlog);
  afterAll(closeDb);

  it("toda acción sin sesión devuelve el error de sesión y no escribe", async () => {
    const { p, c } = await crearEscenario();
    sesion(null);
    const resultados = await Promise.all([
      rateAction(p.id, 5),
      createCommentAction(p.id, "hola"),
      deleteCommentAction(c.id),
      toggleVoteAction(c.id),
      saveReplyAction(c.id, "gracias"),
      deleteReplyAction(c.id),
      loadMoreUserCommentsAction("x"),
    ]);
    for (const r of resultados) expect(r).toEqual(SIN_SESION);
    expect(await getDb().select().from(postRating)).toHaveLength(0);
    expect(await getDb().select().from(comment)).toHaveLength(1);
    expect(await getDb().select().from(commentVote)).toHaveLength(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  describe("createCommentAction", () => {
    it('con " a " o con 2001 caracteres devuelve el error de largo', async () => {
      const { p } = await crearEscenario();
      sesion("beto");
      for (const text of [" a ", "x".repeat(2001)]) {
        expect(await createCommentAction(p.id, text)).toEqual({
          status: "error",
          message: "El texto tiene que tener entre 2 y 2000 caracteres.",
        });
      }
    });

    it("crea el comentario pendiente y no invalida la caché", async () => {
      const { p } = await crearEscenario();
      sesion("beto");
      const res = await createCommentAction(p.id, " buen post ");
      expect(res).toMatchObject({
        status: "success",
        comment: { text: "buen post", authorName: "beto" },
      });
      expect(updateTag).not.toHaveBeenCalled();
    });

    it("el sexto comentario del mismo usuario en 10 minutos devuelve el error de límite y no inserta", async () => {
      const { p } = await crearEscenario();
      sesion("beto");
      for (let i = 0; i < 5; i++) {
        expect((await createCommentAction(p.id, "hola")).status).toBe(
          "success",
        );
      }
      expect(await createCommentAction(p.id, "hola")).toEqual({
        status: "error",
        message:
          "Publicaste varios comentarios seguidos. Probá de nuevo en unos minutos.",
      });
      expect(
        await getDb().select().from(comment).where(eq(comment.userId, "beto")),
      ).toHaveLength(5);
    });
  });

  describe("rateAction", () => {
    it("con valoración 6 o postId basura devuelve error y no lanza", async () => {
      const { p } = await crearEscenario();
      sesion("beto");
      await expect(rateAction(p.id, 6)).resolves.toMatchObject({
        status: "error",
      });
      await expect(rateAction("basura", 5)).resolves.toMatchObject({
        status: "error",
      });
      expect(await getDb().select().from(postRating)).toHaveLength(0);
    });

    it("guarda la valoración e invalida comments:<postId>", async () => {
      const { p } = await crearEscenario();
      sesion("beto");
      expect(await rateAction(p.id, 4)).toEqual({ status: "success" });
      expect(updateTag).toHaveBeenCalledWith(`comments:${p.id}`);
    });
  });

  describe("deleteCommentAction", () => {
    it("borra el comentario propio e invalida comments:<postId>", async () => {
      const { p, c } = await crearEscenario();
      sesion("ana");
      expect(await deleteCommentAction(c.id)).toEqual({ status: "success" });
      expect(updateTag).toHaveBeenCalledWith(`comments:${p.id}`);
    });

    it("de un comentario ajeno devuelve error y no invalida", async () => {
      const { c } = await crearEscenario();
      sesion("beto");
      expect(await deleteCommentAction(c.id)).toEqual({
        status: "error",
        message: "No pudimos borrar el comentario.",
      });
      expect(updateTag).not.toHaveBeenCalled();
    });
  });

  describe("toggleVoteAction", () => {
    it("devuelve el conteo real y no invalida la caché", async () => {
      const { c } = await crearEscenario();
      sesion("beto");
      expect(await toggleVoteAction(c.id)).toEqual({
        status: "success",
        voted: true,
        usefulCount: 1,
      });
      expect(updateTag).not.toHaveBeenCalled();
    });

    it("sobre un comentario propio devuelve error", async () => {
      const { c } = await crearEscenario();
      sesion("ana");
      expect(await toggleVoteAction(c.id)).toEqual({
        status: "error",
        message: "No pudimos registrar tu voto.",
      });
    });
  });

  describe("respuestas", () => {
    it("el autor del post responde y borra, e invalida comments:<postId> cada vez", async () => {
      const { p, c } = await crearEscenario();
      sesion("autor");
      const res = await saveReplyAction(c.id, " gracias ");
      expect(res).toMatchObject({
        status: "success",
        reply: { text: "gracias" },
      });
      expect(await deleteReplyAction(c.id)).toEqual({ status: "success" });
      expect(updateTag).toHaveBeenCalledTimes(2);
      expect(updateTag).toHaveBeenCalledWith(`comments:${p.id}`);
    });

    it("quien no es el autor del post recibe error y no invalida", async () => {
      const { c } = await crearEscenario();
      sesion("beto");
      const message = "No pudimos guardar la respuesta.";
      expect(await saveReplyAction(c.id, "gracias")).toEqual({
        status: "error",
        message,
      });
      expect(await deleteReplyAction(c.id)).toEqual({
        status: "error",
        message,
      });
      expect(updateTag).not.toHaveBeenCalled();
    });

    it("con un texto fuera de 2–2000 caracteres devuelve el error de largo", async () => {
      const { c } = await crearEscenario();
      sesion("autor");
      expect(await saveReplyAction(c.id, "x")).toMatchObject({
        status: "error",
        message: "El texto tiene que tener entre 2 y 2000 caracteres.",
      });
    });
  });

  describe("loadMoreUserCommentsAction", () => {
    it("con un cursor inválido devuelve error y no lanza", async () => {
      await crearEscenario();
      sesion("ana");
      expect(await loadMoreUserCommentsAction("basura")).toEqual({
        status: "error",
        message: "No pudimos cargar más comentarios.",
      });
    });

    it("devuelve la página siguiente del usuario de la sesión", async () => {
      const { p } = await crearEscenario();
      await getDb()
        .insert(comment)
        .values(
          Array.from({ length: 3 }, (_, i) => ({
            postId: p.id,
            userId: "beto",
            text: `b${i}`,
            createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)),
          })),
        );
      const { getUserComments } = await import("@/db/blog-community");
      const first = await getUserComments("beto", { limit: 1 });
      sesion("beto");
      const res = await loadMoreUserCommentsAction(first.nextCursor!);
      expect(res.status).toBe("success");
      if (res.status === "success") {
        expect(res.items.map((i) => i.text)).toEqual(["b1", "b0"]);
        expect(res.nextCursor).toBeNull();
      }
    });
  });
});
