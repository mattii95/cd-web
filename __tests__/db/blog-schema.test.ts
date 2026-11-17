import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import {
  category,
  comment,
  commentVote,
  post,
  postRating,
  postTag,
  tag,
  user,
} from "@/db/schema";
import {
  nuevaCategoria,
  nuevoPost,
  nuevoUsuario,
  resetBlog,
} from "./blog-helpers";

// Autor, lector, categoría y post publicado listos para cada test.
async function crearBase() {
  const db = getDb();
  await db.insert(user).values([nuevoUsuario("autor"), nuevoUsuario("lector")]);
  const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
  const [p] = await db
    .insert(post)
    .values(nuevoPost(cat.id, "autor"))
    .returning();
  return { cat, post: p };
}

describe("esquema del blog", () => {
  beforeEach(resetBlog);
  afterEach(resetBlog);
  afterAll(closeDb);

  it("una segunda valoración del mismo usuario en el mismo post falla", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    const row = { postId: p.id, userId: "lector", rating: 5 };
    await db.insert(postRating).values(row);
    await expect(db.insert(postRating).values(row)).rejects.toThrow();
  });

  it.each([0, 6])("rechaza la valoración %i", async (rating) => {
    const db = getDb();
    const { post: p } = await crearBase();
    await expect(
      db.insert(postRating).values({ postId: p.id, userId: "lector", rating }),
    ).rejects.toThrow();
  });

  it("rechaza un post publicado sin published_at", async () => {
    const db = getDb();
    const { cat } = await crearBase();
    await expect(
      db.insert(post).values({
        ...nuevoPost(cat.id, "autor", "sin-fecha"),
        publishedAt: null,
      }),
    ).rejects.toThrow();
  });

  it("rechaza un comentario con respuesta y sin replied_at", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    await expect(
      db.insert(comment).values({
        postId: p.id,
        userId: "lector",
        text: "hola",
        replyText: "gracias",
      }),
    ).rejects.toThrow();
  });

  it("un comentario nuevo queda pendiente", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    const [c] = await db
      .insert(comment)
      .values({ postId: p.id, userId: "lector", text: "hola" })
      .returning();
    expect(c.status).toBe("pendiente");
  });

  it("un usuario puede comentar dos veces en el mismo post", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    await db.insert(comment).values([
      { postId: p.id, userId: "lector", text: "uno" },
      { postId: p.id, userId: "lector", text: "dos" },
    ]);
    expect(await db.select().from(comment)).toHaveLength(2);
  });

  it("votar dos veces el mismo comentario falla", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    const [c] = await db
      .insert(comment)
      .values({ postId: p.id, userId: "autor", text: "hola" })
      .returning();
    const voto = { commentId: c.id, userId: "lector" };
    await db.insert(commentVote).values(voto);
    await expect(db.insert(commentVote).values(voto)).rejects.toThrow();
  });

  it("borrar un lector borra sus valoraciones, comentarios y votos", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    const [c] = await db
      .insert(comment)
      .values({ postId: p.id, userId: "lector", text: "hola" })
      .returning();
    await db.insert(postRating).values({
      postId: p.id,
      userId: "lector",
      rating: 4,
    });
    await db.insert(commentVote).values({ commentId: c.id, userId: "lector" });

    await db.delete(user).where(eq(user.id, "lector"));

    expect(await db.select().from(postRating)).toHaveLength(0);
    expect(await db.select().from(comment)).toHaveLength(0);
    expect(await db.select().from(commentVote)).toHaveLength(0);
  });

  it("borrar un post borra sus valoraciones, comentarios y votos", async () => {
    const db = getDb();
    const { post: p } = await crearBase();
    const [c] = await db
      .insert(comment)
      .values({ postId: p.id, userId: "lector", text: "hola" })
      .returning();
    await db.insert(postRating).values({
      postId: p.id,
      userId: "lector",
      rating: 4,
    });
    await db.insert(commentVote).values({ commentId: c.id, userId: "autor" });

    await db.delete(post).where(eq(post.id, p.id));

    expect(await db.select().from(postRating)).toHaveLength(0);
    expect(await db.select().from(comment)).toHaveLength(0);
    expect(await db.select().from(commentVote)).toHaveLength(0);
  });

  it("borrar el autor de un post falla", async () => {
    const db = getDb();
    await crearBase();
    await expect(db.delete(user).where(eq(user.id, "autor"))).rejects.toThrow();
  });

  it("borrar una categoría con posts falla", async () => {
    const db = getDb();
    const { cat } = await crearBase();
    await expect(
      db.delete(category).where(eq(category.id, cat.id)),
    ).rejects.toThrow();
  });

  describe("etiquetas", () => {
    const nuevaTag = (slug = "pymes", name = "Pymes") => ({ slug, name });

    it("insertar dos veces la misma pareja (post_id, tag_id) falla por la PK", async () => {
      const db = getDb();
      const { post: p } = await crearBase();
      const [t] = await db.insert(tag).values(nuevaTag()).returning();
      const fila = { postId: p.id, tagId: t.id };
      await db.insert(postTag).values(fila);
      await expect(db.insert(postTag).values(fila)).rejects.toThrow();
    });

    it.each([
      ["slug repetido", nuevaTag("pymes", "Otra")],
      ["slug con mayúsculas", nuevaTag("Pymes")],
      ["slug con espacios", nuevaTag("a b")],
      ["name vacío", nuevaTag("vacio", "")],
      ["name solo espacios", nuevaTag("blancos", "   ")],
    ])("rechaza una etiqueta con %s", async (_caso, fila) => {
      const db = getDb();
      await db.insert(tag).values(nuevaTag());
      await expect(db.insert(tag).values(fila)).rejects.toThrow();
    });

    it("borrar una etiqueta borra sus filas post_tag y deja los posts", async () => {
      const db = getDb();
      const { post: p } = await crearBase();
      const [t] = await db.insert(tag).values(nuevaTag()).returning();
      await db.insert(postTag).values({ postId: p.id, tagId: t.id });

      await db.delete(tag).where(eq(tag.id, t.id));

      expect(await db.select().from(postTag)).toHaveLength(0);
      expect(await db.select().from(post)).toHaveLength(1);
    });

    it("borrar un post borra sus filas post_tag y deja las etiquetas", async () => {
      const db = getDb();
      const { post: p } = await crearBase();
      const [t] = await db.insert(tag).values(nuevaTag()).returning();
      await db.insert(postTag).values({ postId: p.id, tagId: t.id });

      await db.delete(post).where(eq(post.id, p.id));

      expect(await db.select().from(postTag)).toHaveLength(0);
      expect(await db.select().from(tag)).toHaveLength(1);
    });
  });
});
