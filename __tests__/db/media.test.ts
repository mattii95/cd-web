import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db/client";
import {
  createMedia,
  deleteMedia,
  getMediaUsage,
  listMedia,
  MediaError,
  MediaInUseError,
  updateMediaAlt,
} from "@/db/media";
import { authorProfile, category, media, post, user } from "@/db/schema";
import {
  nuevaCategoria,
  nuevoPost,
  nuevoUsuario,
  resetBlog,
} from "./blog-helpers";

let dir: string;

// Colores distintos dan sha256 distintos.
const png = (color: string) =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: color } })
    .png()
    .toBuffer();

const subir = async (color: string, extra: { uploadedBy?: string } = {}) =>
  createMedia({
    file: await png(color),
    originalName: `${color}.png`,
    alt: `Imagen ${color}`,
    uploadedBy: extra.uploadedBy ?? null,
  });

const archivos = () => readdir(dir);

async function crearPost(over: Partial<typeof post.$inferInsert>) {
  const db = getDb();
  await db.insert(user).values(nuevoUsuario("autor")).onConflictDoNothing();
  await db
    .insert(authorProfile)
    .values({ userId: "autor", jobTitle: "Fundador", bio: "Bio" })
    .onConflictDoNothing();
  const [cat] = await db
    .insert(category)
    .values(nuevaCategoria())
    .onConflictDoNothing()
    .returning();
  const categoryId =
    cat?.id ?? (await db.select().from(category))[0].id;
  const [p] = await db
    .insert(post)
    .values({ ...nuevoPost(categoryId, "autor"), ...over })
    .returning();
  return p;
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "cd-media-"));
  process.env.MEDIA_DIR = dir;
});
beforeEach(resetBlog);
afterEach(async () => {
  for (const f of await archivos()) await rm(path.join(dir, f));
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
  await rm(dir, { recursive: true, force: true });
});

describe("createMedia", () => {
  it("guarda <id>.webp y una fila con medidas y bytes del archivo", async () => {
    const { item, duplicate } = await subir("red");
    expect(duplicate).toBe(false);
    expect(await archivos()).toEqual([`${item.id}.webp`]);
    const file = path.join(dir, `${item.id}.webp`);
    expect(item).toMatchObject({ width: 64, height: 48, src: `/media/${item.id}` });
    expect(item.bytes).toBe((await stat(file)).size);
    const [row] = await getDb().select().from(media).where(eq(media.id, item.id));
    expect(row.bytes).toBe(item.bytes);
  });

  it("con el mismo archivo devuelve la misma fila y un solo archivo", async () => {
    const a = await subir("red");
    const b = await subir("red");
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.item.id).toBe(a.item.id);
    expect(await archivos()).toHaveLength(1);
    expect(await getDb().select().from(media)).toHaveLength(1);
  });

  it("con un archivo inválido no deja fila ni archivo", async () => {
    await expect(
      createMedia({
        file: Buffer.from("no soy una imagen"),
        originalName: "x.jpg",
        alt: "x",
        uploadedBy: null,
      }),
    ).rejects.toBeInstanceOf(MediaError);
    expect(await archivos()).toHaveLength(0);
    expect(await getDb().select().from(media)).toHaveLength(0);
  });

  it("si el insert falla borra el archivo recién escrito", async () => {
    await expect(
      createMedia({
        file: await png("blue"),
        originalName: "b.png",
        alt: "   ", // viola el check de alt
        uploadedBy: null,
      }),
    ).rejects.toThrow();
    expect(await archivos()).toHaveLength(0);
  });
});

describe("tabla media", () => {
  it("rechaza alt vacío o solo espacios", async () => {
    const { item } = await subir("red");
    for (const alt of ["", "   "]) {
      await expect(
        getDb().update(media).set({ alt }).where(eq(media.id, item.id)),
      ).rejects.toThrow();
    }
  });

  it("borrar al usuario que subió deja la imagen con uploaded_by nulo", async () => {
    await getDb().insert(user).values(nuevoUsuario("sube"));
    const { item } = await subir("red", { uploadedBy: "sube" });
    await getDb().delete(user).where(eq(user.id, "sube"));
    const [row] = await getDb().select().from(media).where(eq(media.id, item.id));
    expect(row.uploadedBy).toBeNull();
  });
});

describe("listMedia y updateMediaAlt", () => {
  it("lista de la más nueva a la más vieja con su uso", async () => {
    const a = await subir("red");
    const b = await subir("blue");
    await crearPost({ coverMediaId: a.item.id, title: "Con portada" });
    const list = await listMedia();
    expect(list.map((m) => m.id)).toEqual([b.item.id, a.item.id]);
    expect(list[0].usage).toEqual([]);
    expect(list[1].usage.map((u) => u.title)).toEqual(["Con portada"]);
  });

  it("cambia el alt y rechaza uno vacío", async () => {
    const { item } = await subir("red");
    await updateMediaAlt(item.id, "Nuevo alt");
    expect((await listMedia())[0].alt).toBe("Nuevo alt");
    await expect(updateMediaAlt(item.id, "  ")).rejects.toThrow();
  });
});

describe("deleteMedia", () => {
  it("de una portada lanza MediaInUseError con el título del post", async () => {
    const { item } = await subir("red");
    await crearPost({ coverMediaId: item.id, title: "Mi post" });
    const err = await deleteMedia(item.id).catch((e) => e);
    expect(err).toBeInstanceOf(MediaInUseError);
    expect(err.usage).toMatchObject([{ title: "Mi post", as: "portada" }]);
    expect(await archivos()).toHaveLength(1);
  });

  it("de una imagen en el body de un borrador lanza MediaInUseError", async () => {
    const { item } = await subir("red");
    await crearPost({
      status: "borrador",
      publishedAt: null,
      title: "Borrador",
      body: [
        { type: "p", text: "hola" },
        { type: "image", mediaId: item.id },
      ],
    });
    expect(await getMediaUsage(item.id)).toMatchObject([
      { title: "Borrador", as: "cuerpo" },
    ]);
    await expect(deleteMedia(item.id)).rejects.toBeInstanceOf(MediaInUseError);
  });

  it("sin uso borra la fila y el archivo", async () => {
    const { item } = await subir("red");
    await deleteMedia(item.id);
    expect(await getDb().select().from(media)).toHaveLength(0);
    expect(await archivos()).toHaveLength(0);
  });

  it("si el archivo ya no está, igual borra la fila", async () => {
    const { item } = await subir("red");
    await rm(path.join(dir, `${item.id}.webp`));
    await expect(deleteMedia(item.id)).resolves.toBeUndefined();
    expect(await getDb().select().from(media)).toHaveLength(0);
  });

  it("al borrar un post su imagen queda sin usar", async () => {
    const { item } = await subir("red");
    const p = await crearPost({ coverMediaId: item.id });
    await getDb().delete(post).where(eq(post.id, p.id));
    expect(await getMediaUsage(item.id)).toEqual([]);
  });
});
