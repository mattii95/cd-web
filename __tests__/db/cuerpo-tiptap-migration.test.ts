import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { blocksToDoc, type LegacyBlock } from "@/db/blog-body";
import { closeDb, getDb } from "@/db/client";
import { category, post, user } from "@/db/schema";
import {
  nuevaCategoria,
  nuevoPost,
  nuevoUsuario,
  resetBlog,
} from "./blog-helpers";

const MIGRATION = readFileSync("db/migrations/0005_cuerpo_tiptap.sql", "utf8");
const mediaId = "0b7c1c5e-6f0e-4a55-9a43-2d2a4f6c1b11";

const legacy: LegacyBlock[] = [
  { type: "p", text: "Un párrafo" },
  { type: "h2", id: "s1", text: "Un título" },
  { type: "tip", text: "Un consejo" },
  { type: "summary", text: "Un resumen" },
  { type: "image", mediaId },
  { type: "image", mediaId, alt: "Alt", caption: "Pie" },
];

async function crearPost(body: unknown) {
  const db = getDb();
  await db.insert(user).values(nuevoUsuario("autor"));
  const [cat] = await db.insert(category).values(nuevaCategoria()).returning();
  await db
    .insert(post)
    .values({ ...nuevoPost(cat.id, "autor"), body: body as never });
}

const leerBody = async () =>
  (
    await getDb()
      .select({ body: post.body })
      .from(post)
      .where(eq(post.slug, "post-1"))
  )[0].body;

const correrMigracion = () => getDb().execute(sql.raw(MIGRATION));

describe("migración 0005_cuerpo_tiptap", () => {
  beforeEach(resetBlog);
  afterEach(resetBlog);
  afterAll(closeDb);

  it("convierte el formato viejo igual que blocksToDoc", async () => {
    await crearPost(legacy);
    await correrMigracion();
    expect(await leerBody()).toEqual(blocksToDoc(legacy));
  });

  it("es idempotente y no toca un body que ya es doc", async () => {
    await crearPost(legacy);
    await correrMigracion();
    const primera = await leerBody();
    await correrMigracion();
    expect(await leerBody()).toEqual(primera);
  });

  it("un array vacío queda como doc vacío", async () => {
    await crearPost([]);
    await correrMigracion();
    expect(await leerBody()).toEqual({ type: "doc", content: [] });
  });
});
