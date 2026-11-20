import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  countPendingComments,
  deleteCommentAsAdmin,
  listAdminComments,
  listCommentedPosts,
  restoreCommentsStatus,
  setCommentsStatus,
  type CommentStatus,
} from "@/db/admin-comments";
import { closeDb, getDb } from "@/db/client";
import { category, comment, commentVote, post, user } from "@/db/schema";
import { COMMENTS_PER_PAGE, type AdminCommentQuery } from "@/lib/admin/comment-params";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

const all: AdminCommentQuery = { estado: "todos", articulo: null, q: null, page: 1 };
const list = (q: Partial<AdminCommentQuery> = {}) => listAdminComments({ ...all, ...q });
const ids = async (q: Partial<AdminCommentQuery> = {}) => (await list(q)).items.map((c) => c.id);

let seq = 0;
let postA: string;
let postB: string;
let lector: string;

async function crear(
  id: string,
  extra: Partial<typeof comment.$inferInsert> = {},
  postId = postA,
  userId = lector,
) {
  await getDb()
    .insert(comment)
    .values({
      id,
      postId,
      userId,
      text: `texto ${id}`,
      status: "pendiente",
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq++)),
      ...extra,
    });
}
const estadoDe = async (id: string) =>
  (await getDb().select().from(comment).where(eq(comment.id, id)))[0]?.status;

beforeEach(async () => {
  await resetBlog();
  seq = 0;
  const db = getDb();
  const [autor] = await db.insert(user).values(nuevoUsuario("autor")).returning();
  const [lec] = await db
    .insert(user)
    .values({ ...nuevoUsuario("lector"), name: "Lía Lectora", email: "lia@demo.invalid" })
    .returning();
  lector = lec.id;
  const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
  const [a] = await db
    .insert(post)
    .values({ ...nuevoPost(cat.id, autor.id, "post-a"), title: "Alfa" })
    .returning();
  const [b] = await db
    .insert(post)
    .values({
      ...nuevoPost(cat.id, autor.id, "post-b"),
      title: "Beta",
      status: "borrador",
      publishedAt: null,
    })
    .returning();
  postA = a.id;
  postB = b.id;
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
});

describe("listAdminComments: orden y paginación", () => {
  it("pendientes va por alta ascendente; el resto por alta descendente", async () => {
    await crear("c1");
    await crear("c2");
    await crear("c3");
    expect(await ids({ estado: "pendientes" })).toEqual(["c1", "c2", "c3"]);
    expect(await ids({ estado: "todos" })).toEqual(["c3", "c2", "c1"]);
    await getDb().update(comment).set({ status: "aprobado" });
    expect(await ids({ estado: "aprobados" })).toEqual(["c3", "c2", "c1"]);
    await getDb().update(comment).set({ status: "oculto" });
    expect(await ids({ estado: "ocultos" })).toEqual(["c3", "c2", "c1"]);
  });

  it("pagina de a 25 y acota la página fuera de rango", async () => {
    for (let i = 0; i < COMMENTS_PER_PAGE + 5; i++) await crear(`c${String(i).padStart(2, "0")}`);
    const p1 = await list();
    expect(p1).toMatchObject({ total: 30, page: 1, pageCount: 2 });
    expect(p1.items).toHaveLength(25);
    expect((await list({ page: 2 })).items).toHaveLength(5);
    expect((await list({ page: 99 })).page).toBe(2);
  });
});

describe("listAdminComments: filtros", () => {
  beforeEach(async () => {
    await crear("p1");
    await crear("p2");
    await crear("a1", { status: "aprobado" });
    await crear("o1", { status: "oculto" });
  });

  it("pendientes, aprobados y ocultos son disjuntos y suman todos", async () => {
    const p = await ids({ estado: "pendientes" });
    const a = await ids({ estado: "aprobados" });
    const o = await ids({ estado: "ocultos" });
    const t = await ids({ estado: "todos" });
    expect(new Set([...p, ...a, ...o]).size).toBe(p.length + a.length + o.length);
    expect([...p, ...a, ...o].sort()).toEqual([...t].sort());
    expect(t).toHaveLength(4);
  });

  it("q busca en el texto, el nombre y el email", async () => {
    await crear("x", { text: "oferta única" });
    expect(await ids({ q: "oferta" })).toEqual(["x"]);
    expect(await ids({ q: "lectora" })).toHaveLength(5); // nombre del autor
    expect(await ids({ q: "LIA@DEMO" })).toHaveLength(5); // email, sin distinguir mayúsculas
    expect(await ids({ q: "nadie" })).toEqual([]);
  });

  it("q: '50%' no devuelve todos (el comodín se escapa)", async () => {
    await crear("d", { text: "Descuento 50% off" });
    expect(await ids({ q: "50%" })).toEqual(["d"]);
    expect(await ids({ q: "_" })).toEqual([]);
  });

  it("articulo, estado y q se aplican a la vez; counts respeta articulo y q, no estado", async () => {
    await crear("b1", { text: "hola mundo" }, postB);
    await crear("b2", { text: "hola mundo", status: "aprobado" }, postB);
    await crear("b3", { text: "otra cosa" }, postB);

    const r = await list({ articulo: postB, estado: "pendientes", q: "hola" });
    expect(r.items.map((c) => c.id)).toEqual(["b1"]);
    expect(r.total).toBe(1);
    expect(r.counts).toEqual({ pendiente: 1, aprobado: 1, oculto: 0 });
  });

  it("counts sin filtros cuenta todos los estados", async () => {
    expect((await list()).counts).toEqual({ pendiente: 2, aprobado: 1, oculto: 1 });
  });
});

describe("listAdminComments: filas", () => {
  it("trae usefulCount, reply, author y post.published", async () => {
    const [votante] = await getDb()
      .insert(user)
      .values(nuevoUsuario("votante"))
      .returning();
    await crear("c1", { status: "aprobado" });
    await crear("c2", {
      status: "aprobado",
      replyText: "gracias",
      repliedAt: new Date("2026-11-12"),
    }, postB);
    await getDb()
      .insert(commentVote)
      .values({ commentId: "c1", userId: votante.id });

    const { items } = await list();
    const c1 = items.find((c) => c.id === "c1")!;
    const c2 = items.find((c) => c.id === "c2")!;
    expect(c1.usefulCount).toBe(1);
    expect(c1.reply).toBeNull();
    expect(c1.author).toEqual({
      id: lector,
      name: "Lía Lectora",
      email: "lia@demo.invalid",
      image: null,
    });
    expect(c1.post).toEqual({ id: postA, title: "Alfa", slug: "post-a", published: true });
    expect(c2.usefulCount).toBe(0);
    expect(c2.reply).toEqual({ text: "gracias", repliedAt: new Date("2026-11-12") });
    expect(c2.post.published).toBe(false);
  });
});

describe("listCommentedPosts / countPendingComments", () => {
  it("solo artículos con comentarios, por título, incluidos los borrador", async () => {
    expect(await listCommentedPosts()).toEqual([]);
    await crear("c1", {}, postB);
    await crear("c2", {}, postA);
    await crear("c3", {}, postA);
    expect(await listCommentedPosts()).toEqual([
      { id: postA, title: "Alfa" },
      { id: postB, title: "Beta" },
    ]);
  });

  it("cuenta solo los pendientes", async () => {
    await crear("p1");
    await crear("p2");
    await crear("a1", { status: "aprobado" });
    await crear("o1", { status: "oculto" });
    expect(await countPendingComments()).toBe(2);
  });
});

describe("setCommentsStatus", () => {
  it("cambia solo los que tenían otro estado y devuelve su estado previo", async () => {
    await crear("p1");
    await crear("p2", {}, postB);
    await crear("a1", { status: "aprobado" });
    const r = await setCommentsStatus(["p1", "p2", "a1"], "aprobado");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.changed).toHaveLength(2);
    expect(r.changed).toEqual(
      expect.arrayContaining([
        { id: "p1", postId: postA, previous: "pendiente" },
        { id: "p2", postId: postB, previous: "pendiente" },
      ]),
    );
    expect(await estadoDe("p1")).toBe("aprobado");
    expect(await estadoDe("p2")).toBe("aprobado");
  });

  it("si todos ya tenían ese estado, changed viene vacío", async () => {
    await crear("o1", { status: "oculto" });
    expect(await setCommentsStatus(["o1"], "oculto")).toEqual({ ok: true, changed: [] });
  });

  it("con ids que no existen devuelve not-found y no cambia nada", async () => {
    await crear("p1");
    expect(await setCommentsStatus(["nada", "tampoco"], "oculto")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await estadoDe("p1")).toBe("pendiente");
  });

  it("ignora los ids inexistentes mezclados con existentes", async () => {
    await crear("p1");
    const r = await setCommentsStatus(["p1", "nada"], "oculto");
    expect(r).toMatchObject({ ok: true });
    expect(await estadoDe("p1")).toBe("oculto");
  });
});

describe("restoreCommentsStatus", () => {
  it("devuelve cada comentario a su estado anterior, incluido pendiente", async () => {
    await crear("c1", { status: "aprobado" });
    await crear("c2", { status: "oculto" }, postB);
    await crear("c3", { status: "aprobado" });
    const items: { id: string; status: CommentStatus }[] = [
      { id: "c1", status: "pendiente" },
      { id: "c2", status: "aprobado" },
      { id: "c3", status: "oculto" },
    ];
    const r = await restoreCommentsStatus(items);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.postIds].sort()).toEqual([postA, postB].sort());
    expect(await estadoDe("c1")).toBe("pendiente");
    expect(await estadoDe("c2")).toBe("aprobado");
    expect(await estadoDe("c3")).toBe("oculto");
  });

  it("con ids que no existen devuelve not-found", async () => {
    expect(await restoreCommentsStatus([{ id: "nada", status: "pendiente" }])).toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("deleteCommentAsAdmin", () => {
  it("borra el comentario y sus votos", async () => {
    const [votante] = await getDb().insert(user).values(nuevoUsuario("votante")).returning();
    await crear("c1", { status: "aprobado" });
    await getDb().insert(commentVote).values({ commentId: "c1", userId: votante.id });

    expect(await deleteCommentAsAdmin("c1")).toEqual({ ok: true, postId: postA });
    expect(await estadoDe("c1")).toBeUndefined();
    expect(await getDb().select().from(commentVote)).toHaveLength(0);
  });

  it("con un id inexistente devuelve not-found", async () => {
    expect(await deleteCommentAsAdmin("nada")).toEqual({ ok: false, reason: "not-found" });
  });
});
