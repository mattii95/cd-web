import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
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
  getPublishedPostBySlug,
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
  media,
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
  media,
  user,
];
async function contar() {
  const db = getDb();
  return Promise.all(
    tablas.map(async (t) => (await db.select({ n: count() }).from(t))[0].n),
  );
}

let dir: string;

describe("seedBlog", () => {
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cd-seed-media-"));
    process.env.MEDIA_DIR = dir;
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));
  afterEach(async () => {
    for (const f of await readdir(dir)) await rm(path.join(dir, f));
  });
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

  it("carga las imágenes del mock: portada y bloque image resueltos", async () => {
    const db = getDb();
    await seedBlog(db, { authorEmail: AUTOR });

    const detail = await getPublishedPostBySlug(SLUG);
    expect(detail?.cover).toMatchObject({ width: 1920, height: 1080 });
    const image = detail?.body.find((b) => b.type === "image");
    expect(image).toMatchObject({
      image: { width: 1600, height: 900 },
      caption: expect.any(String),
    });
    expect((await db.select({ n: count() }).from(media))[0].n).toBe(2);
    expect(await readdir(dir)).toHaveLength(2);
  });

  it("es idempotente", async () => {
    const db = getDb();
    await seedBlog(db, { authorEmail: AUTOR });
    const primera = await contar();
    const archivos = await readdir(dir);
    await seedBlog(db, { authorEmail: AUTOR });
    expect(await contar()).toEqual(primera);
    expect((await readdir(dir)).sort()).toEqual(archivos.sort());
  });

  it("repone un archivo que falta en disco sin duplicar la fila", async () => {
    const db = getDb();
    await seedBlog(db, { authorEmail: AUTOR });
    const [primero] = await readdir(dir);
    await rm(path.join(dir, primero));
    await seedBlog(db, { authorEmail: AUTOR });
    expect(await readdir(dir)).toContain(primero);
    expect((await db.select({ n: count() }).from(media))[0].n).toBe(2);
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
