import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  banUser,
  deleteUser,
  listAdminUsers,
  revokeUserSessions,
  unbanUser,
} from "@/db/admin-users";
import { closeDb, getDb } from "@/db/client";
import {
  account,
  category,
  comment,
  commentVote,
  media,
  post,
  postRating,
  session,
  user,
} from "@/db/schema";
import type { AdminUserQuery } from "@/lib/admin/user-params";
import { USERS_PER_PAGE } from "@/lib/admin/user-params";
import { nuevaCategoria, nuevoPost, resetBlog } from "./blog-helpers";

const all: AdminUserQuery = { q: null, estado: null, rol: null, page: 1 };
const list = (q: Partial<AdminUserQuery> = {}) => listAdminUsers({ ...all, ...q });
const ids = async (q: Partial<AdminUserQuery> = {}) => (await list(q)).items.map((u) => u.id);

let seq = 0;
async function usuario(
  id: string,
  extra: Partial<typeof user.$inferInsert> = {},
) {
  const [u] = await getDb()
    .insert(user)
    .values({
      id,
      name: id,
      email: `${id}@demo.invalid`,
      emailVerified: true,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq++)),
      ...extra,
    })
    .returning();
  return u;
}
const bloqueado = (id: string, extra: Partial<typeof user.$inferInsert> = {}) =>
  usuario(id, { bannedAt: new Date(), banReason: "spam", ...extra });

async function sesion(userId: string, n: number, updatedAt = new Date()) {
  await getDb()
    .insert(session)
    .values(
      Array.from({ length: n }, (_, i) => ({
        id: `${userId}-s${i}`,
        token: `${userId}-t${i}`,
        userId,
        expiresAt: new Date(Date.now() + 60_000),
        updatedAt,
      })),
    );
}
const sesionesDe = async (userId: string) =>
  (await getDb().select().from(session).where(eq(session.userId, userId))).length;
const existe = async (id: string) =>
  (await getDb().select().from(user).where(eq(user.id, id))).length === 1;

beforeEach(async () => {
  await resetBlog();
  await getDb().delete(user);
  seq = 0;
});
afterAll(async () => {
  await resetBlog();
  await getDb().delete(user);
  await closeDb();
});

describe("listAdminUsers: orden, paginación y búsqueda", () => {
  it("ordena por alta descendente", async () => {
    await usuario("a");
    await usuario("b");
    await usuario("c");
    expect(await ids()).toEqual(["c", "b", "a"]);
  });

  it("pagina de a 25 y acota la página fuera de rango", async () => {
    for (let i = 0; i < USERS_PER_PAGE + 5; i++) await usuario(`u${String(i).padStart(2, "0")}`);
    const p1 = await list();
    expect(p1).toMatchObject({ total: 30, page: 1, pageCount: 2 });
    expect(p1.items).toHaveLength(25);
    const p2 = await list({ page: 2 });
    expect(p2.items).toHaveLength(5);
    expect((await list({ page: 99 })).page).toBe(2);
  });

  it("busca por nombre o email, sin distinguir mayúsculas", async () => {
    await usuario("ana", { name: "Ana Pérez", email: "ana@demo.invalid" });
    await usuario("beto", { name: "Beto", email: "beto@otro.invalid" });
    expect(await ids({ q: "pérez" })).toEqual(["ana"]);
    expect(await ids({ q: "OTRO.inv" })).toEqual(["beto"]);
  });

  it("q: '50%' no devuelve todos (el comodín se escapa)", async () => {
    await usuario("a", { name: "Ana" });
    await usuario("b", { name: "Descuento 50% off" });
    expect(await ids({ q: "50%" })).toEqual(["b"]);
    expect(await ids({ q: "_" })).toEqual([]);
  });
});

describe("listAdminUsers: filtros", () => {
  beforeEach(async () => {
    await usuario("activo");
    await usuario("sinver", { emailVerified: false });
    await bloqueado("bloq");
    await bloqueado("bloq-sinver", { emailVerified: false });
    await usuario("admin", { role: "admin" });
  });

  it("activos, bloqueados y sin-verificar son disjuntos y suman el total", async () => {
    const activos = await ids({ estado: "activos" });
    const bloqueados = await ids({ estado: "bloqueados" });
    const sinVerificar = await ids({ estado: "sin-verificar" });
    expect(activos.sort()).toEqual(["activo", "admin"]);
    expect(bloqueados.sort()).toEqual(["bloq", "bloq-sinver"]);
    expect(sinVerificar).toEqual(["sinver"]);
    expect(activos.length + bloqueados.length + sinVerificar.length).toBe((await list()).total);
  });

  it("un bloqueado sin verificar solo sale en bloqueados", async () => {
    expect(await ids({ estado: "sin-verificar" })).not.toContain("bloq-sinver");
  });

  it("rol, estado y q se aplican a la vez", async () => {
    await usuario("admin2", { role: "admin", emailVerified: false });
    expect(await ids({ rol: "admins" })).toHaveLength(2);
    expect(await ids({ rol: "admins", estado: "sin-verificar" })).toEqual(["admin2"]);
    expect(await ids({ rol: "admins", estado: "activos", q: "admin" })).toEqual(["admin"]);
    expect(await ids({ rol: "admins", estado: "activos", q: "zzz" })).toEqual([]);
    expect((await list({ rol: "lectores" })).total).toBe(4);
  });

  it("el estado de cada fila sale de las reglas", async () => {
    const byId = Object.fromEntries((await list()).items.map((u) => [u.id, u.status]));
    expect(byId).toMatchObject({
      activo: "activo",
      sinver: "sin-verificar",
      bloq: "bloqueado",
      "bloq-sinver": "bloqueado",
    });
  });
});

describe("listAdminUsers: datos por fila", () => {
  it("trae métodos, sesiones, actividad, artículos, comentarios, puntuaciones y votos", async () => {
    const db = getDb();
    await usuario("autor");
    await usuario("lector");
    const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
    const [p1] = await db.insert(post).values(nuevoPost(cat.id, "autor", "p1")).returning();
    const [p2] = await db.insert(post).values(nuevoPost(cat.id, "autor", "p2")).returning();
    const [c1] = await db
      .insert(comment)
      .values({ postId: p1.id, userId: "lector", text: "hola", status: "aprobado" })
      .returning();
    await db.insert(comment).values({ postId: p2.id, userId: "lector", text: "chau" });
    await db.insert(postRating).values({ postId: p1.id, userId: "lector", rating: 5 });
    await db.insert(commentVote).values({ commentId: c1.id, userId: "lector" });
    await db.insert(account).values(
      ["github", "credential"].map((p) => ({
        id: `lector-${p}`,
        accountId: p,
        providerId: p,
        userId: "lector",
      })),
    );
    await sesion("lector", 2, new Date("2026-05-01T10:00:00Z"));
    await db.update(session).set({ updatedAt: new Date("2026-06-01T10:00:00Z") }).where(eq(session.id, "lector-s1"));

    const { items } = await list();
    const lector = items.find((u) => u.id === "lector")!;
    expect(lector).toMatchObject({
      methods: ["credential", "github"],
      sessions: 2,
      posts: 0,
      comments: 2,
      ratings: 1,
      votes: 1,
    });
    expect(lector.lastActiveAt).toEqual(new Date("2026-06-01T10:00:00Z"));
    const autor = items.find((u) => u.id === "autor")!;
    expect(autor).toMatchObject({ posts: 2, sessions: 0, comments: 0, methods: [] });
    expect(autor.lastActiveAt).toBeNull();
  });

  it("trae el nombre de quien bloqueó, o null si quedó vacío", async () => {
    await usuario("adm", { role: "admin", name: "Admin Uno" });
    await bloqueado("x", { bannedBy: "adm" });
    await bloqueado("y");
    const by = Object.fromEntries((await list()).items.map((u) => [u.id, u.bannedByName]));
    expect(by).toMatchObject({ x: "Admin Uno", y: null });
    expect((await list()).items.find((u) => u.id === "x")).toMatchObject({
      banReason: "spam",
      bannedAt: expect.any(Date),
    });
  });
});

describe("banUser", () => {
  it("bloquea a un lector con 2 sesiones y las borra", async () => {
    await usuario("adm", { role: "admin" });
    await usuario("l");
    await sesion("l", 2);
    expect(await banUser("l", "spam", "adm")).toEqual({ ok: true, name: "l", revoked: 2 });
    const [row] = await getDb().select().from(user).where(eq(user.id, "l"));
    expect(row).toMatchObject({ banReason: "spam", bannedBy: "adm" });
    expect(row.bannedAt).toBeInstanceOf(Date);
    expect(await sesionesDe("l")).toBe(0);
  });

  it("protected, already y not-found no cambian nada", async () => {
    await usuario("adm", { role: "admin" });
    await sesion("adm", 1);
    await bloqueado("b");
    await sesion("b", 1);

    expect(await banUser("adm", "x", "adm")).toEqual({ ok: false, reason: "protected" });
    expect(await banUser("b", "otro", "adm")).toEqual({ ok: false, reason: "already" });
    expect(await banUser("nadie", "x", "adm")).toEqual({ ok: false, reason: "not-found" });

    const [adm] = await getDb().select().from(user).where(eq(user.id, "adm"));
    expect(adm.bannedAt).toBeNull();
    const [b] = await getDb().select().from(user).where(eq(user.id, "b"));
    expect(b.banReason).toBe("spam");
    expect(await sesionesDe("adm")).toBe(1);
    expect(await sesionesDe("b")).toBe(1);
  });
});

describe("unbanUser", () => {
  it("pone las tres columnas en NULL", async () => {
    await usuario("adm", { role: "admin" });
    await bloqueado("b", { bannedBy: "adm" });
    expect(await unbanUser("b")).toEqual({ ok: true, name: "b" });
    const [row] = await getDb().select().from(user).where(eq(user.id, "b"));
    expect([row.bannedAt, row.banReason, row.bannedBy]).toEqual([null, null, null]);
  });

  it("not-banned y not-found", async () => {
    await usuario("l");
    expect(await unbanUser("l")).toEqual({ ok: false, reason: "not-banned" });
    expect(await unbanUser("nadie")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("revokeUserSessions", () => {
  it("borra solo las sesiones de ese usuario y devuelve cuántas", async () => {
    await usuario("a");
    await usuario("b");
    await sesion("a", 3);
    await sesion("b", 1);
    expect(await revokeUserSessions("a")).toEqual({ ok: true, name: "a", revoked: 3 });
    expect(await sesionesDe("a")).toBe(0);
    expect(await sesionesDe("b")).toBe(1);
  });

  it("not-found con un id inexistente", async () => {
    expect(await revokeUserSessions("nadie")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("deleteUser", () => {
  it("borra al lector y todo lo que cuelga de él; la imagen queda con uploaded_by NULL", async () => {
    const db = getDb();
    await usuario("autor");
    await usuario("l");
    const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
    const [p] = await db.insert(post).values(nuevoPost(cat.id, "autor")).returning();
    const [c] = await db
      .insert(comment)
      .values({ postId: p.id, userId: "l", text: "hola", status: "aprobado" })
      .returning();
    await db.insert(commentVote).values({ commentId: c.id, userId: "l" });
    await db.insert(postRating).values({ postId: p.id, userId: "l", rating: 4 });
    await db.insert(account).values({ id: "l-acc", accountId: "l", providerId: "google", userId: "l" });
    await sesion("l", 1);
    const [img] = await db
      .insert(media)
      .values({
        sha256: "h",
        alt: "alt",
        width: 1,
        height: 1,
        bytes: 1,
        originalName: "a.png",
        uploadedBy: "l",
      })
      .returning();

    expect(await deleteUser("l", " L@DEMO.invalid ")).toEqual({ ok: true, name: "l" });

    expect(await existe("l")).toBe(false);
    expect(await db.select().from(comment)).toHaveLength(0);
    expect(await db.select().from(commentVote)).toHaveLength(0);
    expect(await db.select().from(postRating)).toHaveLength(0);
    expect(await db.select().from(session)).toHaveLength(0);
    expect(await db.select().from(account)).toHaveLength(0);
    const [m] = await db.select().from(media).where(eq(media.id, img.id));
    expect(m.uploadedBy).toBeNull();
  });

  it("autor, admin y email que no coincide no borran nada", async () => {
    const db = getDb();
    await usuario("autor");
    await usuario("adm", { role: "admin" });
    await usuario("l");
    const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
    await db.insert(post).values(nuevoPost(cat.id, "autor", "a")).returning();
    await db.insert(post).values({ ...nuevoPost(cat.id, "autor", "b"), status: "borrador", publishedAt: null });

    expect(await deleteUser("autor", "autor@demo.invalid")).toEqual({
      ok: false,
      reason: "author",
      posts: 2,
    });
    expect(await deleteUser("adm", "adm@demo.invalid")).toEqual({ ok: false, reason: "protected" });
    expect(await deleteUser("l", "l@demo.inval")).toEqual({ ok: false, reason: "mismatch" });
    expect(await deleteUser("nadie", "x")).toEqual({ ok: false, reason: "not-found" });

    for (const id of ["autor", "adm", "l"]) expect(await existe(id)).toBe(true);
  });
});
