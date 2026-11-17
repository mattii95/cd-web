import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/db/client";
import {
  countMedia,
  createMedia,
  deleteMedia,
  getMediaUsage,
  listMedia,
  MediaError,
  MediaInUseError,
  updateMediaAlt,
} from "@/db/media";
import { InvalidCursorError } from "@/lib/pagination";
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
    const { items: list } = await listMedia();
    expect(list.map((m) => m.id)).toEqual([b.item.id, a.item.id]);
    expect(list[0].usage).toEqual([]);
    expect(list[1].usage.map((u) => u.title)).toEqual(["Con portada"]);
  });

  it("cambia el alt y rechaza uno vacío", async () => {
    const { item } = await subir("red");
    await updateMediaAlt(item.id, "Nuevo alt");
    expect((await listMedia()).items[0].alt).toBe("Nuevo alt");
    await expect(updateMediaAlt(item.id, "  ")).rejects.toThrow();
  });
});

// Inserta n filas de media con created_at separado por un segundo (la 0 es la más nueva).
async function sembrar(n: number, mismaFecha = false) {
  const db = getDb();
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = crypto.randomUUID();
    ids.push(id);
    await db.insert(media).values({
      id,
      sha256: `sha-${id}`,
      alt: `Alt ${i}`,
      width: 10,
      height: 10,
      bytes: 10,
      originalName: `${i}.webp`,
      createdAt: sql`'2026-01-01 10:00:00'::timestamp + ${mismaFecha ? 0 : i} * interval '1 second'` as never,
    });
  }
  return ids;
}

async function recorrer(limit: number) {
  const vistos: string[] = [];
  let cursor: string | null = null;
  do {
    const page: Awaited<ReturnType<typeof listMedia>> = await listMedia({ limit, cursor });
    vistos.push(...page.items.map((m) => m.id));
    cursor = page.nextCursor;
  } while (cursor);
  return vistos;
}

describe("listMedia paginada", () => {
  it("con 30 imágenes devuelve 24 y nextCursor, y luego las 6 restantes", async () => {
    await sembrar(30);
    const p1 = await listMedia();
    expect(p1.items).toHaveLength(24);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await listMedia({ cursor: p1.nextCursor });
    expect(p2.items).toHaveLength(6);
    expect(p2.nextCursor).toBeNull();
    expect(new Set([...p1.items, ...p2.items].map((m) => m.id)).size).toBe(30);
  });

  it("con el mismo created_at desempata por id descendente sin repetir", async () => {
    const ids = await sembrar(5, true);
    const vistos = await recorrer(2);
    expect(vistos).toHaveLength(5);
    expect(new Set(vistos)).toEqual(new Set(ids));
    const rows = await getDb().execute<{ id: string }>(
      sql`select id from media order by created_at desc, id desc`,
    );
    expect(vistos).toEqual(rows.rows.map((r) => r.id));
  });

  it("con fechas que difieren en microsegundos no salta ni repite", async () => {
    const db = getDb();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = crypto.randomUUID();
      ids.push(id);
      await db.insert(media).values({
        id,
        sha256: `sha-${id}`,
        alt: "a",
        width: 1,
        height: 1,
        bytes: 1,
        originalName: "x.webp",
        createdAt: sql`'2026-01-01 10:00:00.000100'::timestamp + ${i} * interval '1 microsecond'` as never,
      });
    }
    const vistos = await recorrer(2);
    expect(vistos).toEqual([...ids].reverse());
  });

  it("subir una imagen después de pedir la primera página no repite en la segunda", async () => {
    await sembrar(5);
    const p1 = await listMedia({ limit: 2 });
    await subir("red");
    const p2 = await listMedia({ limit: 2, cursor: p1.nextCursor });
    const ids1 = p1.items.map((m) => m.id);
    expect(p2.items.some((m) => ids1.includes(m.id))).toBe(false);
  });

  it("resuelve el uso con un número fijo de consultas", async () => {
    await sembrar(2);
    const spy = vi.spyOn(Pool.prototype, "query");
    try {
      await listMedia();
      const con2 = spy.mock.calls.length;
      await sembrar(22);
      spy.mockClear();
      expect((await listMedia()).items).toHaveLength(24);
      expect(spy.mock.calls.length).toBe(con2);
      expect(con2).toBe(3); // imágenes + portadas + cuerpos
    } finally {
      spy.mockRestore();
    }
  });

  it("devuelve el mismo usage que getMediaUsage", async () => {
    const a = await subir("red");
    const b = await subir("blue");
    const c = await subir("green");
    await crearPost({ coverMediaId: a.item.id, title: "Portada", slug: "portada" });
    await crearPost({
      status: "borrador",
      publishedAt: null,
      title: "Borrador",
      slug: "borrador",
      body: [
        { type: "image", mediaId: b.item.id },
        { type: "image", mediaId: b.item.id },
      ],
    });
    await crearPost({
      title: "Ambos",
      slug: "ambos",
      coverMediaId: b.item.id,
      body: [{ type: "image", mediaId: b.item.id }],
    });
    const { items } = await listMedia();
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.usage).toEqual(await getMediaUsage(item.id));
    }
    expect(items.find((m) => m.id === c.item.id)?.usage).toEqual([]);
    expect(items.find((m) => m.id === b.item.id)?.usage).toHaveLength(3);
  });

  it("con un cursor inválido lanza InvalidCursorError", async () => {
    await expect(listMedia({ cursor: "basura" })).rejects.toBeInstanceOf(
      InvalidCursorError,
    );
  });
});

describe("countMedia", () => {
  it("devuelve el total de filas", async () => {
    expect(await countMedia()).toBe(0);
    await sembrar(3);
    expect(await countMedia()).toBe(3);
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
