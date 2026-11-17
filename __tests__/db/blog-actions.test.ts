import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { closeDb, getDb } from "@/db/client";
import { category, post, user } from "@/db/schema";
import {
  nuevaCategoria,
  nuevoPost,
  nuevoUsuario,
  resetBlog,
} from "./blog-helpers";

// Fuera de Next, "use cache" no hace nada y cacheLife/cacheTag no existen: se anulan.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { loadMorePostsAction } from "@/actions/blog";

describe("loadMorePostsAction", () => {
  beforeEach(resetBlog);
  afterEach(resetBlog);
  afterAll(closeDb);

  it("con un cursor inválido devuelve error y no lanza", async () => {
    await expect(loadMorePostsAction("basura", {})).resolves.toMatchObject({
      status: "error",
    });
  });

  it("con filtros de formato inválido devuelve error", async () => {
    await expect(
      loadMorePostsAction("x", { category: "NO VÁLIDO" }),
    ).resolves.toMatchObject({ status: "error" });
  });

  it("pagina con el cursor y los filtros", async () => {
    const db = getDb();
    await db.insert(user).values(nuevoUsuario("autor"));
    const [cat] = await db
      .insert(category)
      .values(nuevaCategoria())
      .returning();
    for (const [i, slug] of ["a", "b", "c"].entries()) {
      await db.insert(post).values({
        ...nuevoPost(cat.id, "autor", slug),
        publishedAt: new Date(Date.UTC(2026, 10, 10 + i)),
      });
    }
    const { getPublishedPosts } = await import("@/db/blog");
    const first = await getPublishedPosts({ category: "sistemas", limit: 1 });
    const res = await loadMorePostsAction(first.nextCursor!, {
      category: "sistemas",
    });
    expect(res.status).toBe("success");
    if (res.status === "success") {
      expect(res.items.map((p) => p.slug)).toEqual(["b", "a"]);
      expect(res.nextCursor).toBeNull();
    }
  });
});
