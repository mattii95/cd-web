import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createComment,
  deleteOwnComment,
  deleteReply,
  saveReply,
  toggleVote,
  upsertRating,
} from "@/db/blog-community";
import { closeDb, getDb } from "@/db/client";
import {
  category,
  comment,
  commentVote,
  post,
  postRating,
  user,
} from "@/db/schema";
import {
  nuevaCategoria,
  nuevoPost,
  nuevoUsuario,
  resetBlog,
} from "./blog-helpers";

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
  const [borrador] = await db
    .insert(post)
    .values({
      ...nuevoPost(cat.id, "autor", "borrador"),
      status: "borrador",
      publishedAt: null,
    })
    .returning();
  const insertarComentario = async (
    userId: string,
    status: "pendiente" | "aprobado" | "oculto" = "aprobado",
    postId = p.id,
  ) =>
    (
      await db
        .insert(comment)
        .values({ postId, userId, text: "hola", status })
        .returning()
    )[0];
  return { p, borrador, insertarComentario };
}

describe("escrituras de la comunidad", () => {
  beforeEach(resetBlog);
  afterEach(resetBlog);
  afterAll(closeDb);

  describe("upsertRating", () => {
    it("dos veces con el mismo usuario deja una sola fila con el último valor", async () => {
      const { p } = await crearEscenario();
      expect(await upsertRating(p.id, "ana", 2)).toBe(true);
      expect(await upsertRating(p.id, "ana", 5)).toBe(true);
      const rows = await getDb()
        .select()
        .from(postRating)
        .where(eq(postRating.postId, p.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].rating).toBe(5);
    });

    it("sobre un post borrador devuelve false y no inserta", async () => {
      const { borrador } = await crearEscenario();
      expect(await upsertRating(borrador.id, "ana", 4)).toBe(false);
      expect(await getDb().select().from(postRating)).toHaveLength(0);
    });
  });

  describe("createComment", () => {
    it("guarda el comentario pendiente y sin espacios en los bordes", async () => {
      const { p } = await crearEscenario();
      await upsertRating(p.id, "ana", 4);
      const c = await createComment(p.id, "ana", "  buen post  ");
      expect(c).toMatchObject({
        authorName: "ana",
        rating: 4,
        text: "buen post",
        usefulCount: 0,
        reply: null,
      });
      const [row] = await getDb()
        .select()
        .from(comment)
        .where(eq(comment.id, c!.id));
      expect(row).toMatchObject({ status: "pendiente", text: "buen post" });
    });

    it("sobre un post borrador devuelve null y no inserta", async () => {
      const { borrador } = await crearEscenario();
      expect(await createComment(borrador.id, "ana", "hola")).toBeNull();
      expect(await getDb().select().from(comment)).toHaveLength(0);
    });
  });

  describe("deleteOwnComment", () => {
    it("de un comentario ajeno devuelve null y no borra", async () => {
      const { p, insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      expect(await deleteOwnComment(c.id, "beto")).toBeNull();
      expect(await getDb().select().from(comment)).toHaveLength(1);
      expect(await deleteOwnComment(c.id, "ana")).toEqual({ postId: p.id });
    });

    it("borra también los votos de ese comentario", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      await getDb()
        .insert(commentVote)
        .values({ commentId: c.id, userId: "beto" });
      await deleteOwnComment(c.id, "ana");
      expect(await getDb().select().from(commentVote)).toHaveLength(0);
    });

    it("borra un comentario propio oculto", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana", "oculto");
      expect(await deleteOwnComment(c.id, "ana")).not.toBeNull();
      expect(await getDb().select().from(comment)).toHaveLength(0);
    });
  });

  describe("toggleVote", () => {
    it("dos veces deja el comentario sin el voto y devuelve el conteo inicial", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      expect(await toggleVote(c.id, "beto")).toEqual({
        voted: true,
        usefulCount: 1,
      });
      expect(await toggleVote(c.id, "beto")).toEqual({
        voted: false,
        usefulCount: 0,
      });
    });

    it("cuenta los votos de otros usuarios", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      await getDb()
        .insert(commentVote)
        .values({ commentId: c.id, userId: "autor" });
      expect(await toggleVote(c.id, "beto")).toEqual({
        voted: true,
        usefulCount: 2,
      });
    });

    it("sobre un comentario propio, pendiente u oculto devuelve null", async () => {
      const { insertarComentario } = await crearEscenario();
      const propio = await insertarComentario("ana");
      const pendiente = await insertarComentario("ana", "pendiente");
      const oculto = await insertarComentario("ana", "oculto");
      expect(await toggleVote(propio.id, "ana")).toBeNull();
      expect(await toggleVote(pendiente.id, "beto")).toBeNull();
      expect(await toggleVote(oculto.id, "beto")).toBeNull();
      expect(await getDb().select().from(commentVote)).toHaveLength(0);
    });

    it("sobre un comentario de un post borrador devuelve null", async () => {
      const { borrador, insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana", "aprobado", borrador.id);
      expect(await toggleVote(c.id, "beto")).toBeNull();
    });
  });

  describe("saveReply", () => {
    it("de un usuario que no es el autor del post devuelve null y no escribe", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      expect(await saveReply(c.id, "beto", "gracias")).toBeNull();
      const [row] = await getDb()
        .select()
        .from(comment)
        .where(eq(comment.id, c.id));
      expect(row.replyText).toBeNull();
      expect(row.repliedAt).toBeNull();
    });

    it("sobre un comentario no aprobado devuelve null", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana", "pendiente");
      expect(await saveReply(c.id, "autor", "gracias")).toBeNull();
    });

    it("reemplaza la respuesta existente y actualiza replied_at", async () => {
      const { p, insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      const primera = await saveReply(c.id, "autor", " uno ");
      expect(primera?.postId).toBe(p.id);
      await new Promise((r) => setTimeout(r, 10));
      const segunda = await saveReply(c.id, "autor", "dos");
      const [row] = await getDb()
        .select()
        .from(comment)
        .where(eq(comment.id, c.id));
      expect(row.replyText).toBe("dos");
      expect(row.repliedAt).toEqual(segunda!.repliedAt);
      expect(segunda!.repliedAt.getTime()).toBeGreaterThan(
        primera!.repliedAt.getTime(),
      );
    });
  });

  describe("deleteReply", () => {
    it("deja reply_text y replied_at en null", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      await saveReply(c.id, "autor", "gracias");
      expect(await deleteReply(c.id, "autor")).not.toBeNull();
      const [row] = await getDb()
        .select()
        .from(comment)
        .where(and(eq(comment.id, c.id)));
      expect(row.replyText).toBeNull();
      expect(row.repliedAt).toBeNull();
    });

    it("de un usuario que no es el autor del post devuelve null y no borra", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      await saveReply(c.id, "autor", "gracias");
      expect(await deleteReply(c.id, "beto")).toBeNull();
      const [row] = await getDb()
        .select()
        .from(comment)
        .where(eq(comment.id, c.id));
      expect(row.replyText).toBe("gracias");
    });

    it("sobre un comentario sin respuesta devuelve null", async () => {
      const { insertarComentario } = await crearEscenario();
      const c = await insertarComentario("ana");
      expect(await deleteReply(c.id, "autor")).toBeNull();
    });
  });
});
