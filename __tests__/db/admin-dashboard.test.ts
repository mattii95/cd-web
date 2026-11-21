import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getActivitySeries,
  getCommentStatusBreakdown,
  getDashboardKpis,
  getNewestUsers,
  getOldestPendingComments,
  getPublishedByCategory,
  getRatingDistribution,
  getTopPosts,
} from "@/db/admin-dashboard";
import { closeDb, getDb } from "@/db/client";
import { category, comment, post, postRating, user } from "@/db/schema";
import { bucketKeys, dashboardRange } from "@/lib/admin/dashboard-params";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

// Fechas en 2030: lejos de cualquier dato del seed, así que los períodos solo ven lo que crea cada test.
const NOW = new Date("2030-06-15T15:00:00Z"); // 12:00 en Buenos Aires
const r7 = dashboardRange(7, NOW); // from = 2030-06-09T03:00:00Z, prevFrom = 2030-06-02T03:00:00Z
const r90 = dashboardRange(90, NOW);
const EN_PERIODO = new Date("2030-06-12T12:00:00Z");

let autor: string;
let lector: string;
let cat: string;
let n = 0;

const crearPost = async (slug: string, extra: Partial<typeof post.$inferInsert> = {}) => {
  const [p] = await getDb()
    .insert(post)
    .values({ ...nuevoPost(cat, autor, slug), ...extra })
    .returning();
  return p.id;
};
const crearComentario = async (
  postId: string,
  createdAt: Date,
  extra: Partial<typeof comment.$inferInsert> = {},
) => {
  const [c] = await getDb()
    .insert(comment)
    .values({ postId, userId: lector, text: `texto ${n++}`, status: "pendiente", createdAt, ...extra })
    .returning();
  return c.id;
};
const crearUsuario = (id: string, createdAt: Date) =>
  getDb()
    .insert(user)
    .values({ ...nuevoUsuario(id), createdAt });
// Un usuario distinto por valoración: la PK es (post, usuario).
const valorar = async (postId: string, rating: number, createdAt: Date) => {
  const id = `val${n++}`;
  await crearUsuario(id, new Date("2030-01-01T00:00:00Z"));
  await getDb().insert(postRating).values({ postId, userId: id, rating, createdAt });
};

beforeEach(async () => {
  await resetBlog();
  n = 0;
  const db = getDb();
  [{ id: autor }] = await db.insert(user).values(nuevoUsuario("autor")).returning();
  [{ id: lector }] = await db.insert(user).values(nuevoUsuario("lector")).returning();
  [{ id: cat }] = await db.insert(category).values(nuevaCategoria()).returning();
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
});

describe("getDashboardKpis", () => {
  it("cuenta altas, comentarios y valoraciones en el período actual y en el anterior", async () => {
    const p = await crearPost("p1");
    await crearUsuario("u-actual", EN_PERIODO);
    await crearUsuario("u-previo", new Date("2030-06-05T12:00:00Z"));
    await crearComentario(p, EN_PERIODO);
    await crearComentario(p, EN_PERIODO);
    await crearComentario(p, new Date("2030-06-05T12:00:00Z"));
    await valorar(p, 4, EN_PERIODO);
    await valorar(p, 2, new Date("2030-06-05T12:00:00Z"));

    const k = await getDashboardKpis(r7);
    expect(k.users.signups).toEqual({ current: 1, previous: 1 });
    expect(k.comments.created).toEqual({ current: 2, previous: 1 });
    expect(k.ratings.count).toEqual({ current: 1, previous: 1 });
  });

  it("un dato justo en from cuenta en el actual y 1 ms antes, en el anterior", async () => {
    const p = await crearPost("p1");
    await crearComentario(p, r7.from);
    await crearComentario(p, new Date(r7.from.getTime() - 1));
    const k = await getDashboardKpis(r7);
    expect(k.comments.created).toEqual({ current: 1, previous: 1 });
  });

  it("publicados en el período usa published_at; publicados y borradores cuentan todo", async () => {
    await crearPost("viejo", { publishedAt: new Date("2030-01-01T00:00:00Z") });
    await crearPost("nuevo", { publishedAt: EN_PERIODO });
    await crearPost("previo", { publishedAt: new Date("2030-06-05T12:00:00Z") });
    await crearPost("borrador", { status: "borrador", publishedAt: null });
    const { posts } = await getDashboardKpis(r7);
    expect(posts.published).toBe(3);
    expect(posts.drafts).toBe(1);
    expect(posts.publishedInPeriod).toEqual({ current: 1, previous: 1 });
  });

  it("pendientes cuenta todos, de cualquier fecha", async () => {
    const p = await crearPost("p1");
    await crearComentario(p, new Date("2020-01-01T00:00:00Z"));
    await crearComentario(p, EN_PERIODO);
    await crearComentario(p, EN_PERIODO, { status: "aprobado" });
    expect((await getDashboardKpis(r7)).comments.pending).toBe(2);
  });

  it("el promedio es del período actual y null sin valoraciones", async () => {
    const p = await crearPost("p1");
    expect((await getDashboardKpis(r7)).ratings.average).toBeNull();
    await valorar(p, 5, EN_PERIODO);
    await valorar(p, 4, EN_PERIODO);
    await valorar(p, 1, new Date("2030-06-05T12:00:00Z")); // período anterior: no entra
    expect((await getDashboardKpis(r7)).ratings.average).toBe(4.5);
  });
});

describe("getActivitySeries", () => {
  it("devuelve un punto por clave, con 0 en los vacíos, y suma los tres estados de comentario", async () => {
    const p = await crearPost("p1");
    await crearComentario(p, EN_PERIODO);
    await crearComentario(p, EN_PERIODO, { status: "aprobado" });
    await crearComentario(p, EN_PERIODO, { status: "oculto" });
    await crearUsuario("u1", EN_PERIODO);
    await valorar(p, 3, EN_PERIODO);

    const serie = await getActivitySeries(r7);
    expect(serie.map((x) => x.key)).toEqual(bucketKeys(r7));
    expect(serie.find((x) => x.key === "2030-06-12")).toEqual({
      key: "2030-06-12",
      users: 1,
      comments: 3,
      ratings: 1,
    });
    expect(serie.find((x) => x.key === "2030-06-10")).toEqual({
      key: "2030-06-10",
      users: 0,
      comments: 0,
      ratings: 0,
    });
  });

  it("un comentario de las 02:00 UTC cae en el día anterior de Buenos Aires", async () => {
    const p = await crearPost("p1");
    await crearComentario(p, new Date("2030-06-13T02:00:00Z"));
    const serie = await getActivitySeries(r7);
    expect(serie.find((x) => x.key === "2030-06-12")?.comments).toBe(1);
    expect(serie.find((x) => x.key === "2030-06-13")?.comments).toBe(0);
  });

  it("con 90 días, el lunes y el domingo de la misma semana caen en el mismo punto", async () => {
    const p = await crearPost("p1");
    await crearComentario(p, new Date("2030-06-10T15:00:00Z")); // lunes 10/6
    await crearComentario(p, new Date("2030-06-09T15:00:00Z")); // domingo 9/6
    const serie = await getActivitySeries(r90);
    expect(serie.find((x) => x.key === "2030-06-10")?.comments).toBe(1);
    expect(serie.find((x) => x.key === "2030-06-03")?.comments).toBe(1);
  });
});

describe("getCommentStatusBreakdown", () => {
  it("devuelve las tres claves, con 0 en las vacías, y solo cuenta el período", async () => {
    const p = await crearPost("p1");
    await crearComentario(p, EN_PERIODO);
    await crearComentario(p, EN_PERIODO);
    await crearComentario(p, EN_PERIODO, { status: "aprobado" });
    await crearComentario(p, new Date("2030-01-01T00:00:00Z"), { status: "oculto" });
    expect(await getCommentStatusBreakdown(r7)).toEqual({ pendiente: 2, aprobado: 1, oculto: 0 });
  });
});

describe("getRatingDistribution", () => {
  it("devuelve siempre 5 filas, de 5 a 1", async () => {
    expect(await getRatingDistribution(r7)).toEqual([
      { stars: 5, count: 0 },
      { stars: 4, count: 0 },
      { stars: 3, count: 0 },
      { stars: 2, count: 0 },
      { stars: 1, count: 0 },
    ]);
    const p = await crearPost("p1");
    await valorar(p, 4, EN_PERIODO);
    await valorar(p, 4, EN_PERIODO);
    await valorar(p, 1, new Date("2030-01-01T00:00:00Z")); // fuera del período
    const dist = await getRatingDistribution(r7);
    expect(dist.map((x) => x.stars)).toEqual([5, 4, 3, 2, 1]);
    expect(dist.find((x) => x.stars === 4)?.count).toBe(2);
    expect(dist.find((x) => x.stars === 1)?.count).toBe(0);
  });
});

describe("getPublishedByCategory", () => {
  it("devuelve todas las categorías por position, con 0 en las vacías, sin contar borradores", async () => {
    const db = getDb();
    const [segunda] = await db
      .insert(category)
      .values({ ...nuevaCategoria("web"), position: 0 })
      .returning();
    await crearPost("a");
    await crearPost("b");
    await crearPost("c", { status: "borrador", publishedAt: null });
    const [vacia] = await db
      .insert(category)
      .values({ ...nuevaCategoria("vacia"), position: 2 })
      .returning();

    const rows = await getPublishedByCategory();
    expect(rows.map((x) => [x.id, x.count])).toEqual([
      [segunda.id, 0],
      [cat, 2],
      [vacia.id, 0],
    ]);
    expect(rows[0].label).toBe("web");
  });
});

describe("getTopPosts", () => {
  it("ordena por comentarios aprobados + valoraciones, desempata por promedio y título", async () => {
    const a = await crearPost("a", { title: "Alfa" }); // 1 comentario + 1 valoración (2) promedio 3
    const b = await crearPost("b", { title: "Beta" }); // 2 + 0
    const c = await crearPost("c", { title: "Gamma" }); // 1 + 1 (2) promedio 5
    const d = await crearPost("d", { title: "Delta" }); // 1 + 1 (2) promedio 5: empata con Gamma, gana por título
    for (const [p, stars] of [[a, 3], [c, 5], [d, 5]] as const) {
      await crearComentario(p, EN_PERIODO, { status: "aprobado" });
      await valorar(p, stars, EN_PERIODO);
    }
    await crearComentario(b, EN_PERIODO, { status: "aprobado" });
    await crearComentario(b, EN_PERIODO, { status: "aprobado" });

    const top = await getTopPosts(r7);
    expect(top.map((x) => x.title)).toEqual(["Delta", "Gamma", "Alfa", "Beta"]);
    expect(top[0]).toEqual({ id: d, title: "Delta", comments: 1, ratings: 1, average: 5 });
    expect(top[3].average).toBeNull();
  });

  it("excluye borradores, comentarios no aprobados y artículos con suma 0", async () => {
    const borrador = await crearPost("bor", { status: "borrador", publishedAt: null });
    const pendiente = await crearPost("pen");
    const viejo = await crearPost("vie");
    await crearPost("cero");
    await crearComentario(borrador, EN_PERIODO, { status: "aprobado" });
    await crearComentario(pendiente, EN_PERIODO); // pendiente: no suma
    await crearComentario(viejo, new Date("2030-01-01T00:00:00Z"), { status: "aprobado" });
    expect(await getTopPosts(r7)).toEqual([]);
  });

  it("devuelve como máximo 5", async () => {
    for (let i = 0; i < 6; i++) {
      const p = await crearPost(`p${i}`);
      await crearComentario(p, EN_PERIODO, { status: "aprobado" });
    }
    expect(await getTopPosts(r7)).toHaveLength(5);
  });
});

describe("getOldestPendingComments", () => {
  it("devuelve los 5 pendientes más viejos y recorta el texto a 120 caracteres con …", async () => {
    const p = await crearPost("p1");
    const largo = "a".repeat(200);
    for (let i = 0; i < 6; i++) {
      await crearComentario(p, new Date(Date.UTC(2030, 0, 1 + i)), {
        text: i === 0 ? largo : `corto ${i}`,
      });
    }
    await crearComentario(p, new Date("2029-01-01T00:00:00Z"), { status: "aprobado" });

    const rows = await getOldestPendingComments();
    expect(rows).toHaveLength(5);
    expect(rows[0].text).toBe(`${"a".repeat(120)}…`);
    expect(rows[1].text).toBe("corto 1");
    expect(rows[0].author.name).toBe("lector");
    expect(rows[0].post.title).toBe("p1");
    expect(rows.map((x) => x.createdAt.getUTCDate())).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("getNewestUsers", () => {
  it("devuelve los 5 usuarios más nuevos", async () => {
    for (let i = 1; i <= 6; i++) {
      await crearUsuario(`nuevo${i}`, new Date(Date.UTC(2031, 0, i)));
    }
    const rows = await getNewestUsers();
    expect(rows.map((x) => x.id)).toEqual(["nuevo6", "nuevo5", "nuevo4", "nuevo3", "nuevo2"]);
    expect(rows[0]).toMatchObject({ email: "nuevo6@demo.invalid", image: null });
  });
});
