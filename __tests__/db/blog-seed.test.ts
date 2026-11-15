import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { count, like } from "drizzle-orm";
import {
  getApprovedComments,
  getCategories,
  getPublishedPosts,
  getRatingSummary,
} from "@/db/blog";
import { closeDb, getDb } from "@/db/client";
import {
  account,
  authorProfile,
  category,
  comment,
  commentVote,
  post,
  postRating,
  user,
} from "@/db/schema";
import { seedBlog } from "@/db/seed/blog";
import { blogPosts } from "@/lib/blog-posts";
import { nuevoUsuario, resetBlog } from "./blog-helpers";

const AUTOR = "autor@demo.invalid";
const SLUG = "senales-sistema-a-medida";

const tablas = [
  category,
  authorProfile,
  post,
  postRating,
  comment,
  commentVote,
  user,
];
async function contar() {
  const db = getDb();
  return Promise.all(
    tablas.map(async (t) => (await db.select({ n: count() }).from(t))[0].n),
  );
}

describe("seedBlog", () => {
  beforeEach(async () => {
    await resetBlog();
    await getDb().insert(user).values(nuevoUsuario("autor"));
  });
  afterEach(resetBlog);
  afterAll(closeDb);

  it("carga categorías y posts con el autor dado", async () => {
    const db = getDb();
    await seedBlog(db, { authorEmail: AUTOR });

    expect((await getCategories()).map((c) => c.slug)).toEqual([
      "desarrollo-web",
      "sistemas",
      "saas",
      "ia",
    ]);
    const posts = await getPublishedPosts();
    expect(posts.map((p) => p.slug)).toEqual(blogPosts.map((p) => p.slug));
    expect(posts[0].author).toMatchObject({
      name: "autor",
      jobTitle: "Fundador de Courroux Digital",
    });
  });

  it("carga valoraciones, comentarios, votos y respuestas del mock", async () => {
    const db = getDb();
    await seedBlog(db, { authorEmail: AUTOR });
    const p = (await getPublishedPosts()).find((x) => x.slug === SLUG)!;

    const summary = await getRatingSummary(p.id);
    expect(summary.total).toBe(24);
    expect(summary.distribution).toEqual({ 1: 0, 2: 1, 3: 1, 4: 4, 5: 18 });
    expect(summary.average.toFixed(1)).toBe("4.6");

    const comments = await getApprovedComments(p.id);
    expect(comments.map((c) => c.authorName)).toEqual([
      "Lucía Fernández",
      "Martín Gómez",
      "Carla Ruiz",
      "Diego Sosa",
    ]);
    expect(comments.map((c) => c.usefulCount)).toEqual([12, 5, 8, 2]);
    expect(comments.map((c) => c.reply !== null)).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });

  it("es idempotente", async () => {
    const db = getDb();
    await seedBlog(db, { authorEmail: AUTOR });
    const primera = await contar();
    await seedBlog(db, { authorEmail: AUTOR });
    expect(await contar()).toEqual(primera);
  });

  it("los usuarios demo no tienen fila en account", async () => {
    const db = getDb();
    await seedBlog(db, { authorEmail: AUTOR });
    const demo = await db
      .select({ id: user.id })
      .from(user)
      .where(like(user.email, "%@demo.invalid"));
    expect(demo.length).toBeGreaterThan(24);
    const accounts = await db.select({ n: count() }).from(account);
    expect(accounts[0].n).toBe(0);
  });

  it("falla con un email que no existe y lo menciona", async () => {
    await expect(
      seedBlog(getDb(), { authorEmail: "nadie@demo.invalid" }),
    ).rejects.toThrow(/nadie@demo\.invalid/);
  });

  it("se niega a correr en producción sin insertar nada", async () => {
    const antes = await contar();
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(seedBlog(getDb(), { authorEmail: AUTOR })).rejects.toThrow(
        /production/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
    expect(await contar()).toEqual(antes);
  });
});
