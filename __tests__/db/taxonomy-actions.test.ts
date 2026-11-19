import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listAdminCategories } from "@/db/admin-categories";
import { closeDb, getDb } from "@/db/client";
import { category, post, user } from "@/db/schema";
import { nuevaCategoria, nuevoPost, nuevoUsuario, resetBlog } from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }));

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/dal";
import {
  deleteCategoryAction,
  moveCategoryAction,
  saveCategoryAction,
} from "@/actions/admin/categories";

const idle = { status: "idle" } as const;
const GONE = { status: "error", message: "Esa categoría ya no existe." };
const DB_ERROR = {
  status: "error",
  message: "No pudimos guardar el cambio. Intentá de nuevo en unos minutos.",
};

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const categoriaForm = (over: Record<string, string> = {}) =>
  form({
    label: "Marketing",
    filterLabel: "Marketing",
    slug: "marketing",
    serviceSlug: "desarrollo-web",
    icon: "bolt",
    ...over,
  });

const invalidaCategorias = () => {
  expect(updateTag).toHaveBeenCalledWith("blog");
  expect(revalidatePath).toHaveBeenCalledWith("/admin/categories");
  expect(revalidatePath).toHaveBeenCalledWith("/admin/articles");
};
const noInvalida = () => {
  expect(updateTag).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue({ id: "admin" } as never);
  await resetBlog();
  await getDb().insert(user).values(nuevoUsuario("autor"));
});
afterAll(async () => {
  await resetBlog();
  await closeDb();
});

describe.each([
  ["saveCategoryAction", () => saveCategoryAction(idle, categoriaForm())],
  ["moveCategoryAction", () => moveCategoryAction(idle, form({ id: "x", direction: "up" }))],
  ["deleteCategoryAction", () => deleteCategoryAction(idle, form({ id: "x" }))],
])("%s", (_, run) => {
  it("llama a requireAdmin antes de tocar la base", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("no admin"));
    await expect(run()).rejects.toThrow("no admin");
    expect(await getDb().select().from(category)).toHaveLength(0);
    noInvalida();
  });
});

describe("saveCategoryAction", () => {
  it("sin id crea la categoría e invalida las cachés", async () => {
    expect(await saveCategoryAction(idle, categoriaForm())).toEqual({
      status: "success",
      message: "Categoría creada.",
    });
    expect(await listAdminCategories()).toMatchObject([{ slug: "marketing", icon: "bolt" }]);
    invalidaCategorias();
  });

  it("con id edita y responde Categoría actualizada.", async () => {
    await saveCategoryAction(idle, categoriaForm());
    const [c] = await listAdminCategories();
    expect(
      await saveCategoryAction(idle, categoriaForm({ id: c.id, label: "Otro nombre" })),
    ).toEqual({ status: "success", message: "Categoría actualizada." });
    expect((await listAdminCategories())[0].label).toBe("Otro nombre");
  });

  it("con datos inválidos devuelve los errores por campo y no invalida", async () => {
    const r = await saveCategoryAction(idle, categoriaForm({ label: "", icon: "star" }));
    expect(r).toMatchObject({ status: "error", fieldErrors: { label: expect.any(String), icon: expect.any(String) } });
    expect(await listAdminCategories()).toHaveLength(0);
    noInvalida();
  });

  it("con un slug repetido marca el campo slug", async () => {
    await saveCategoryAction(idle, categoriaForm());
    expect(await saveCategoryAction(idle, categoriaForm({ label: "Otra" }))).toEqual({
      status: "error",
      fieldErrors: { slug: "Ya hay una categoría con esa URL." },
    });
    expect(updateTag).toHaveBeenCalledTimes(1); // solo el de la primera
  });

  it("con un id inexistente o que no es uuid dice que ya no existe", async () => {
    expect(
      await saveCategoryAction(idle, categoriaForm({ id: crypto.randomUUID() })),
    ).toEqual(GONE);
    expect(await saveCategoryAction(idle, categoriaForm({ id: "nope" }))).toEqual(GONE);
    noInvalida();
  });

  it("si la base falla responde el error de base", async () => {
    await getDb().insert(category).values(nuevaCategoria("x"));
    const c = (await listAdminCategories())[0];
    // Una transacción que falla (base caída) no debe filtrar el error a la UI.
    vi.spyOn(getDb(), "transaction").mockRejectedValueOnce(new Error("boom"));
    expect(await saveCategoryAction(idle, categoriaForm({ id: c.id }))).toEqual(DB_ERROR);
    vi.restoreAllMocks();
  });
});

describe("moveCategoryAction", () => {
  it("mueve, devuelve la nueva posición e invalida", async () => {
    await saveCategoryAction(idle, categoriaForm({ slug: "a" }));
    await saveCategoryAction(idle, categoriaForm({ slug: "b" }));
    vi.clearAllMocks();
    const [a] = await listAdminCategories();
    expect(await moveCategoryAction(idle, form({ id: a.id, direction: "down" }))).toEqual({
      status: "success",
      message: "Orden actualizado.",
      position: 2,
    });
    expect((await listAdminCategories()).map((c) => c.slug)).toEqual(["b", "a"]);
    invalidaCategorias();
  });

  it("en el extremo o con un id inexistente no invalida", async () => {
    await saveCategoryAction(idle, categoriaForm());
    vi.clearAllMocks();
    const [c] = await listAdminCategories();
    expect(await moveCategoryAction(idle, form({ id: c.id, direction: "up" }))).toMatchObject({
      status: "error",
    });
    expect(
      await moveCategoryAction(idle, form({ id: crypto.randomUUID(), direction: "up" })),
    ).toEqual(GONE);
    expect(await moveCategoryAction(idle, form({ id: c.id, direction: "left" }))).toEqual(GONE);
    noInvalida();
  });
});

describe("deleteCategoryAction", () => {
  it("borra una categoría sin artículos e invalida", async () => {
    await saveCategoryAction(idle, categoriaForm());
    vi.clearAllMocks();
    const [c] = await listAdminCategories();
    expect(await deleteCategoryAction(idle, form({ id: c.id }))).toEqual({
      status: "success",
      message: "Categoría borrada.",
    });
    expect(await listAdminCategories()).toHaveLength(0);
    invalidaCategorias();
  });

  it("con artículos responde la cantidad y no borra", async () => {
    await saveCategoryAction(idle, categoriaForm());
    const [c] = await listAdminCategories();
    await getDb().insert(post).values(nuevoPost(c.id, "autor", "uno"));
    await getDb().insert(post).values({ ...nuevoPost(c.id, "autor", "dos"), status: "borrador", publishedAt: null });
    vi.clearAllMocks();
    expect(await deleteCategoryAction(idle, form({ id: c.id }))).toEqual({
      status: "error",
      message: "No se puede borrar: tiene 2 artículos.",
    });
    expect(await listAdminCategories()).toHaveLength(1);
    noInvalida();
  });

  it("con un id inexistente dice que ya no existe", async () => {
    expect(await deleteCategoryAction(idle, form({ id: crypto.randomUUID() }))).toEqual(GONE);
    expect(await deleteCategoryAction(idle, form({ id: "nope" }))).toEqual(GONE);
    noInvalida();
  });
});
