import type { BlogDoc } from "@/db/blog-body";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import sharp from "sharp";
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
import { closeDb, getDb } from "@/db/client";
import {
  countMedia,
  createMedia,
  deleteMedia,
  getMediaUsage,
  listMedia,
  MediaError,
  MediaInUseError,
  MediaNotFoundError,
  updateMedia,
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
  const categoryId = cat?.id ?? (await db.select().from(category))[0].id;
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

const img = (mediaId: string) =>
  ({ type: "image", attrs: { mediaId, alt: null, caption: null } }) as const;
const docWith = (...content: BlogDoc["content"]): BlogDoc => ({
  type: "doc",
  content,
});

describe("createMedia", () => {
  it("guarda <id>.webp y una fila con medidas y bytes del archivo", async () => {
    const { item, duplicate } = await subir("red");
    expect(duplicate).toBe(false);
    expect(await archivos()).toEqual([`${item.id}.webp`]);
    const file = path.join(dir, `${item.id}.webp`);
    expect(item).toMatchObject({
      width: 64,
      height: 48,
      src: `/media/${item.id}`,
    });
    expect(item.bytes).toBe((await stat(file)).size);
    const [row] = await getDb()
      .select()
      .from(media)
      .where(eq(media.id, item.id));
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
    const [row] = await getDb()
      .select()
      .from(media)
      .where(eq(media.id, item.id));
    expect(row.uploadedBy).toBeNull();
  });
});

describe("listMedia", () => {
  it("lista de la más nueva a la más vieja con su uso", async () => {
    const a = await subir("red");
    const b = await subir("blue");
    await crearPost({ coverMediaId: a.item.id, title: "Con portada" });
    const { items: list } = await listMedia();
    expect(list.map((m) => m.id)).toEqual([b.item.id, a.item.id]);
    expect(list[0].usage).toEqual([]);
    expect(list[1].usage.map((u) => u.title)).toEqual(["Con portada"]);
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
      createdAt:
        sql`'2026-01-01 10:00:00'::timestamp + ${mismaFecha ? 0 : i} * interval '1 second'` as never,
    });
  }
  return ids;
}

async function recorrer(limit: number) {
  const vistos: string[] = [];
  let cursor: string | null = null;
  do {
    const page: Awaited<ReturnType<typeof listMedia>> = await listMedia({
      limit,
      cursor,
    });
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
        createdAt:
          sql`'2026-01-01 10:00:00.000100'::timestamp + ${i} * interval '1 microsecond'` as never,
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
    await crearPost({
      coverMediaId: a.item.id,
      title: "Portada",
      slug: "portada",
    });
    await crearPost({
      status: "borrador",
      publishedAt: null,
      title: "Borrador",
      slug: "borrador",
      body: docWith(img(b.item.id), img(b.item.id)),
    });
    await crearPost({
      title: "Ambos",
      slug: "ambos",
      coverMediaId: b.item.id,
      body: docWith(img(b.item.id)),
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

describe("listMedia con búsqueda", () => {
  const subirConAlt = async (color: string, alt: string, name?: string) =>
    createMedia({
      file: await png(color),
      originalName: name ?? `${color}.png`,
      alt,
      uploadedBy: null,
    });

  it("filtra por alt u original_name sin distinguir mayúsculas", async () => {
    const a = await subirConAlt("red", "Foto del EQUIPO");
    const b = await subirConAlt("blue", "Otra", "equipo-2026.png");
    await subirConAlt("green", "Oficina");
    const { items } = await listMedia({ query: "equipo" });
    expect(new Set(items.map((m) => m.id))).toEqual(
      new Set([a.item.id, b.item.id]),
    );
  });

  it("escapa % y _ como texto literal", async () => {
    const pct = await subirConAlt("red", "Descuento 50% hoy");
    await subirConAlt("blue", "Cincuenta 500 hoy");
    const guion = await subirConAlt("green", "a_b");
    await subirConAlt("yellow", "axb");
    expect((await listMedia({ query: "50%" })).items.map((m) => m.id)).toEqual([
      pct.item.id,
    ]);
    expect((await listMedia({ query: "a_b" })).items.map((m) => m.id)).toEqual([
      guion.item.id,
    ]);
  });

  it("escapa la barra invertida", async () => {
    const a = await subirConAlt("red", "ruta a\\b");
    await subirConAlt("blue", "ruta ab");
    expect((await listMedia({ query: "a\\b" })).items.map((m) => m.id)).toEqual(
      [a.item.id],
    );
  });

  it("una búsqueda en blanco devuelve lo mismo que sin query", async () => {
    await sembrar(3);
    expect(await listMedia({ query: "   " })).toEqual(await listMedia());
  });

  it("la segunda página sigue filtrada y no repite", async () => {
    const db = getDb();
    for (let i = 0; i < 40; i++) {
      await db.insert(media).values({
        id: crypto.randomUUID(),
        sha256: `sha-q-${i}`,
        alt: i % 4 === 0 ? `otra ${i}` : `equipo ${i}`,
        width: 1,
        height: 1,
        bytes: 1,
        originalName: `f${i}.webp`,
      });
    }
    // 30 coinciden: 24 en la primera página y 6 en la segunda.
    const p1 = await listMedia({ query: "equipo" });
    expect(p1.items).toHaveLength(24);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = await listMedia({ query: "equipo", cursor: p1.nextCursor });
    expect(p2.items).toHaveLength(6);
    expect(p2.nextCursor).toBeNull();
    const ids = [...p1.items, ...p2.items].map((m) => m.id);
    expect(new Set(ids).size).toBe(30);
    expect(
      [...p1.items, ...p2.items].every((m) => m.alt.includes("equipo")),
    ).toBe(true);
  });
});

describe("countMedia", () => {
  it("devuelve el total de filas", async () => {
    expect(await countMedia()).toBe(0);
    await sembrar(3);
    expect(await countMedia()).toBe(3);
  });
});

describe("filtro de uso", () => {
  async function conUsos() {
    const portada = await subir("red");
    const cuerpo = await subir("blue");
    const libre = await subir("green");
    await crearPost({ coverMediaId: portada.item.id, title: "A", slug: "a" });
    await crearPost({
      status: "borrador",
      publishedAt: null,
      title: "B",
      slug: "b",
      body: docWith(img(cuerpo.item.id)),
    });
    return { portada, cuerpo, libre };
  }

  it("used devuelve portada y cuerpo de borrador; unused la libre", async () => {
    const { portada, cuerpo, libre } = await conUsos();
    const ids = async (usage: "used" | "unused") =>
      (await listMedia({ usage })).items.map((m) => m.id).sort();
    expect(await ids("used")).toEqual([portada.item.id, cuerpo.item.id].sort());
    expect(await ids("unused")).toEqual([libre.item.id]);
  });

  it("combina query y usage", async () => {
    const { libre } = await conUsos();
    const r = await listMedia({ query: "green", usage: "unused" });
    expect(r.items.map((m) => m.id)).toEqual([libre.item.id]);
    expect((await listMedia({ query: "red", usage: "unused" })).items).toEqual([]);
  });

  it("la segunda tanda sigue filtrada y no repite", async () => {
    await sembrar(30);
    const p1 = await listMedia({ usage: "unused" });
    expect(p1.items).toHaveLength(24);
    const p2 = await listMedia({ usage: "unused", cursor: p1.nextCursor! });
    expect(p2.items).toHaveLength(6);
    expect(p2.nextCursor).toBeNull();
    const all = new Set([...p1.items, ...p2.items].map((m) => m.id));
    expect(all.size).toBe(30);
  });

  it("countMedia coincide con recorrer todas las tandas", async () => {
    await conUsos();
    for (const usage of ["used", "unused"] as const) {
      expect(await countMedia({ usage })).toBe(
        (await listMedia({ usage })).items.length,
      );
    }
    expect(await countMedia({ query: "red", usage: "used" })).toBe(1);
  });
});

describe("updateMedia", () => {
  it("cambia alt y nombre", async () => {
    const { item } = await subir("red");
    expect(await updateMedia(item.id, { alt: "Nuevo", originalName: "nuevo.png" })).toEqual({
      ok: true,
      altChanged: true,
    });
    expect(await updateMedia(item.id, { alt: "Nuevo", originalName: "otro.png" })).toEqual({
      ok: true,
      altChanged: false,
    });
    const [row] = (await listMedia()).items;
    expect(row).toMatchObject({ alt: "Nuevo", originalName: "otro.png" });
  });

  it("con id inexistente devuelve not-found y no cambia nada", async () => {
    const { item } = await subir("red");
    expect(
      await updateMedia(crypto.randomUUID(), { alt: "X", originalName: "x.png" }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect((await listMedia()).items[0].alt).toBe(item.alt);
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
      body: docWith(
        {
          type: "paragraph",
          content: [{ type: "text", text: "hola" }],
        },
        img(item.id),
      ),
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

  it("con un id inexistente lanza MediaNotFoundError", async () => {
    await expect(deleteMedia(crypto.randomUUID())).rejects.toBeInstanceOf(
      MediaNotFoundError,
    );
  });

  it("al borrar un post su imagen queda sin usar", async () => {
    const { item } = await subir("red");
    const p = await crearPost({ coverMediaId: item.id });
    await getDb().delete(post).where(eq(post.id, p.id));
    expect(await getMediaUsage(item.id)).toEqual([]);
  });
});
