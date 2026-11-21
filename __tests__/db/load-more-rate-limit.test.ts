import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db/client";
import { rateLimit } from "@/db/schema";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/dal";
import { loadMoreCommentsAction, loadMorePostsAction } from "@/actions/blog";
import { loadMoreUserCommentsAction } from "@/actions/blog/comunidad";

const LIMITE = {
  status: "error",
  message: "Demasiadas acciones seguidas. Probá de nuevo en un minuto.",
};
// Sin TRUSTED_IP_HEADER todas las requests caen en el bucket "local".
const KEY = "actions|local|load-more";
const POST_ID = "00000000-0000-4000-8000-000000000000";

async function llenar(count: number) {
  await getDb()
    .insert(rateLimit)
    .values({ id: crypto.randomUUID(), key: KEY, count, lastRequest: Date.now() })
    .onConflictDoUpdate({ target: rateLimit.key, set: { count, lastRequest: Date.now() } });
}

describe("rate limit de cargar más", () => {
  beforeEach(async () => {
    await getDb().delete(rateLimit);
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "ana", name: "ana", email: "a@a.invalid" } as never);
  });
  afterAll(closeDb);

  it("la llamada 61 desde la misma IP devuelve error en las tres acciones", async () => {
    await llenar(60);
    expect(await loadMorePostsAction("x", {})).toEqual(LIMITE);
    expect(await loadMoreCommentsAction(POST_ID, "x")).toEqual(LIMITE);
    expect(await loadMoreUserCommentsAction("x")).toEqual(LIMITE);
  });

  it("las tres comparten el mismo contador", async () => {
    await llenar(58);
    await loadMorePostsAction("x", {});
    await loadMoreCommentsAction(POST_ID, "x");
    expect(await loadMoreUserCommentsAction("x")).toEqual(LIMITE);
  });

  it("un cursor inválido no gasta de más: sigue devolviendo su error de siempre bajo el límite", async () => {
    expect(await loadMorePostsAction("basura", {})).toMatchObject({
      status: "error",
      message: "No pudimos cargar más artículos.",
    });
  });

  it("pasada la ventana vuelve a funcionar", async () => {
    await llenar(60);
    expect(await loadMorePostsAction("x", {})).toEqual(LIMITE);
    await getDb()
      .update(rateLimit)
      .set({ lastRequest: Date.now() - 61_000 })
      .where(eq(rateLimit.key, KEY));
    expect(await loadMorePostsAction("x", {})).not.toEqual(LIMITE);
  });
});
