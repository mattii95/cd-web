import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { closeDb, getDb } from "@/db/client";
import { media, user } from "@/db/schema";
import { nuevoUsuario, resetBlog } from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }));

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  searchMediaAction,
  uploadMediaAction,
  uploadPickerMediaAction,
} from "@/actions/admin/media";

const idle = { status: "idle" } as const;
const LOAD_ERROR = {
  status: "error",
  message: "No pudimos cargar las imágenes.",
};
let dir: string;

const png = (color: string) =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: color } })
    .png()
    .toBuffer();

async function form(file: Blob, name: string, alt = "Un alt") {
  const f = new FormData();
  f.set("file", new File([file], name));
  f.set("alt", alt);
  return f;
}
const pngForm = async (color = "red", alt?: string) =>
  form(new Blob([new Uint8Array(await png(color))]), `${color}.png`, alt);

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "cd-picker-"));
  process.env.MEDIA_DIR = dir;
});
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({ id: "admin" } as never);
  await resetBlog();
  for (const f of await readdir(dir)) await rm(path.join(dir, f));
  await getDb()
    .insert(user)
    .values(nuevoUsuario("admin"))
    .onConflictDoNothing();
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
  await rm(dir, { recursive: true, force: true });
});

describe("requireAdmin", () => {
  it("se llama antes de tocar la base o el disco", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("no admin"));
    await expect(
      searchMediaAction({ query: "", cursor: null }),
    ).rejects.toThrow("no admin");
    await expect(
      uploadPickerMediaAction(idle, await pngForm()),
    ).rejects.toThrow("no admin");
    expect(await getDb().select().from(media)).toHaveLength(0);
    expect(await readdir(dir)).toHaveLength(0);
  });
});

describe("searchMediaAction", () => {
  const sembrar = async (n: number, alt = (i: number) => `equipo ${i}`) => {
    for (let i = 0; i < n; i++) {
      await getDb()
        .insert(media)
        .values({
          id: crypto.randomUUID(),
          sha256: `sha-${i}-${Math.random()}`,
          alt: alt(i),
          width: 10,
          height: 20,
          bytes: 99,
          originalName: `f${i}.webp`,
        });
    }
  };

  it("devuelve PickerItem sin usage, bytes ni originalName", async () => {
    await sembrar(1);
    const r = await searchMediaAction({ query: "", cursor: null });
    if (r.status !== "success") throw new Error("esperaba success");
    expect(r.nextCursor).toBeNull();
    expect(Object.keys(r.items[0]).sort()).toEqual([
      "alt",
      "height",
      "id",
      "src",
      "width",
    ]);
    expect(r.items[0].src).toBe(`/media/${r.items[0].id}`);
  });

  it("filtra por query y pagina", async () => {
    await sembrar(30, (i) => (i < 26 ? `equipo ${i}` : `otra ${i}`));
    const p1 = await searchMediaAction({ query: "equipo", cursor: null });
    if (p1.status !== "success") throw new Error("esperaba success");
    expect(p1.items).toHaveLength(24);
    const p2 = await searchMediaAction({
      query: "equipo",
      cursor: p1.nextCursor,
    });
    if (p2.status !== "success") throw new Error("esperaba success");
    expect(p2.items).toHaveLength(2);
    expect(p2.nextCursor).toBeNull();
  });

  it("con un cursor inválido devuelve el error", async () => {
    expect(await searchMediaAction({ query: "", cursor: "basura" })).toEqual(
      LOAD_ERROR,
    );
  });

  it("con una búsqueda de más de 100 caracteres devuelve el error", async () => {
    expect(
      await searchMediaAction({ query: "x".repeat(101), cursor: null }),
    ).toEqual(LOAD_ERROR);
  });
});

describe("uploadPickerMediaAction", () => {
  it("con un PNG válido sube, devuelve el item y revalida /admin/media", async () => {
    const r = await uploadPickerMediaAction(idle, await pngForm("red", "Roja"));
    if (r.status !== "success") throw new Error("esperaba success");
    expect(r.message).toBe("Imagen subida.");
    expect(r.item).toMatchObject({ alt: "Roja", width: 64, height: 48 });
    expect(r.item.src).toBe(`/media/${r.item.id}`);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/media");
  });

  it("con el mismo archivo otra vez devuelve el mismo item", async () => {
    const a = await uploadPickerMediaAction(idle, await pngForm());
    const b = await uploadPickerMediaAction(idle, await pngForm());
    if (a.status !== "success" || b.status !== "success") {
      throw new Error("esperaba success");
    }
    expect(b.message).toBe("Esa imagen ya estaba subida.");
    expect(b.item.id).toBe(a.item.id);
    expect(await getDb().select().from(media)).toHaveLength(1);
  });

  it("con un .txt devuelve el mensaje de MediaError y no crea nada", async () => {
    const r = await uploadPickerMediaAction(
      idle,
      await form(new Blob(["hola"]), "nota.txt"),
    );
    expect(r.status).toBe("error");
    expect(await getDb().select().from(media)).toHaveLength(0);
    expect(await readdir(dir)).toHaveLength(0);
  });

  it("sin alt devuelve el mismo mensaje que uploadMediaAction", async () => {
    const data = await pngForm("red", "   ");
    const a = await uploadPickerMediaAction(idle, data);
    const b = await uploadMediaAction(idle, data);
    expect(a).toEqual(b);
    expect(a.status).toBe("error");
  });
});
