import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getApprovedComments } from "@/db/blog";
import { closeDb, getDb } from "@/db/client";
import { account, category, comment, post, session, user } from "@/db/schema";
import { nuevaCategoria, nuevoPost, resetBlog } from "./blog-helpers";

vi.mock("next/cache", () => ({ updateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/dal", () => ({ requireAdmin: vi.fn() }));

import { revalidatePath, updateTag } from "next/cache";
import { getAuth } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/auth/dal";
import {
  banUserAction,
  deleteUserAction,
  resendUserVerificationAction,
  revokeUserSessionsAction,
  unbanUserAction,
} from "@/actions/admin/users";

const idle = { status: "idle" } as const;
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const err = (message: string) => ({ status: "error", message });
const ok = (message: string) => ({ status: "success", message });

const GONE = err("Ese usuario ya no existe.");
const DB_ERROR = err("No pudimos completar la acción. Intentá de nuevo en unos minutos.");
const PASSWORD = "secreta123";

async function usuario(id: string, extra: Partial<typeof user.$inferInsert> = {}) {
  await getDb()
    .insert(user)
    .values({ id, name: id, email: `${id}@demo.invalid`, emailVerified: true, ...extra });
}
async function sesion(userId: string, n = 1) {
  await getDb()
    .insert(session)
    .values(
      Array.from({ length: n }, (_, i) => ({
        id: `${userId}-s${i}`,
        token: `${userId}-t${i}`,
        userId,
        expiresAt: new Date(Date.now() + 60_000),
      })),
    );
}
const sesionesDe = async (id: string) =>
  (await getDb().select().from(session).where(eq(session.userId, id))).length;
const existe = async (id: string) =>
  (await getDb().select().from(user).where(eq(user.id, id))).length === 1;

const invalida = () => expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
const noInvalida = () => {
  expect(updateTag).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("BETTER_AUTH_SECRET", process.env.BETTER_AUTH_SECRET ?? "x".repeat(32));
  vi.stubEnv("BETTER_AUTH_URL", process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
  vi.mocked(requireAdmin).mockResolvedValue({ id: "adm" } as never);
  await resetBlog();
  await getDb().delete(user);
  await usuario("adm", { role: "admin", name: "Admin" });
});
afterAll(async () => {
  await resetBlog();
  await getDb().delete(user);
  await closeDb();
});

describe("requireAdmin y revalidación", () => {
  const actions = [
    ["banUserAction", banUserAction, { id: "l", reason: "spam" }],
    ["unbanUserAction", unbanUserAction, { id: "l" }],
    ["revokeUserSessionsAction", revokeUserSessionsAction, { id: "l" }],
    ["resendUserVerificationAction", resendUserVerificationAction, { id: "l" }],
    ["deleteUserAction", deleteUserAction, { id: "l", confirmEmail: "l@demo.invalid" }],
  ] as const;

  it.each(actions)("%s llama a requireAdmin antes de tocar la base", async (_n, action, fields) => {
    await usuario("l", { emailVerified: false, bannedAt: new Date(), banReason: "x" });
    vi.mocked(requireAdmin).mockRejectedValue(new Error("no admin"));
    await expect(action(idle, form(fields))).rejects.toThrow("no admin");
    expect(await existe("l")).toBe(true);
    const [row] = await getDb().select().from(user).where(eq(user.id, "l"));
    expect(row.banReason).toBe("x"); // ni desbloqueó ni cambió nada
  });

  it("revalida /admin/users cuando algo cambió y updateTag('blog') solo al borrar", async () => {
    await usuario("a");
    await usuario("b", { bannedAt: new Date(), banReason: "x" });
    await usuario("c", { emailVerified: false });
    await usuario("d");
    vi.spyOn(getAuth().api, "sendVerificationEmail").mockResolvedValue({ status: true } as never);

    await banUserAction(idle, form({ id: "a", reason: "spam" }));
    await unbanUserAction(idle, form({ id: "b" }));
    await revokeUserSessionsAction(idle, form({ id: "d" }));
    await resendUserVerificationAction(idle, form({ id: "c" }));
    expect(revalidatePath).toHaveBeenCalledTimes(4);
    invalida();
    expect(updateTag).not.toHaveBeenCalled();

    await deleteUserAction(idle, form({ id: "d", confirmEmail: "d@demo.invalid" }));
    expect(updateTag).toHaveBeenCalledOnce();
    expect(updateTag).toHaveBeenCalledWith("blog");
  });
});

describe("banUserAction", () => {
  it("bloquea y devuelve el mensaje con las sesiones cerradas", async () => {
    await usuario("l", { name: "Lola" });
    await sesion("l", 2);
    expect(await banUserAction(idle, form({ id: "l", reason: "  spam  " }))).toEqual(
      ok("Lola quedó bloqueado. Se cerraron 2 sesiones."),
    );
    const [row] = await getDb().select().from(user).where(eq(user.id, "l"));
    expect(row).toMatchObject({ banReason: "spam", bannedBy: "adm" });
  });

  it("motivo vacío o largo da error de campo y no bloquea", async () => {
    await usuario("l");
    expect(await banUserAction(idle, form({ id: "l", reason: "  " }))).toEqual({
      status: "error",
      fieldErrors: { reason: "Escribí el motivo del bloqueo." },
    });
    expect(await banUserAction(idle, form({ id: "l", reason: "a".repeat(301) }))).toEqual({
      status: "error",
      fieldErrors: { reason: "El motivo puede tener hasta 300 caracteres." },
    });
    noInvalida();
    const [row] = await getDb().select().from(user).where(eq(user.id, "l"));
    expect(row.bannedAt).toBeNull();
  });

  it("admin, ya bloqueado e id inexistente", async () => {
    await usuario("otro-adm", { role: "admin" });
    await usuario("b", { bannedAt: new Date(), banReason: "x" });
    expect(await banUserAction(idle, form({ id: "otro-adm", reason: "x" }))).toEqual(
      err("No se puede hacer esto con un administrador."),
    );
    expect(await banUserAction(idle, form({ id: "b", reason: "x" }))).toEqual(
      err("Ese usuario ya estaba bloqueado."),
    );
    expect(await banUserAction(idle, form({ id: "nadie", reason: "x" }))).toEqual(GONE);
    expect(await banUserAction(idle, form({ reason: "x" }))).toEqual(GONE);
    noInvalida();
  });

  it("después de bloquear, la sesión abierta deja de valer", async () => {
    const auth = getAuth();
    await usuario("l");
    await getDb().insert(account).values({
      id: "l-cred",
      accountId: "l",
      providerId: "credential",
      userId: "l",
      password: await (await auth.$context).password.hash(PASSWORD),
    });
    const { headers: res } = await auth.api.signInEmail({
      body: { email: "l@demo.invalid", password: PASSWORD },
      returnHeaders: true,
    });
    const cookie = res.get("set-cookie")!.split(";")[0];
    const conCookie = () => new Headers({ cookie });
    expect(await auth.api.getSession({ headers: conCookie() })).not.toBeNull();

    await banUserAction(idle, form({ id: "l", reason: "spam" }));
    expect(await auth.api.getSession({ headers: conCookie() })).toBeNull();
  });
});

describe("unbanUserAction", () => {
  it("desbloquea", async () => {
    await usuario("b", { name: "Beto", bannedAt: new Date(), banReason: "x" });
    expect(await unbanUserAction(idle, form({ id: "b" }))).toEqual(
      ok("Beto ya puede volver a iniciar sesión."),
    );
  });

  it("no bloqueado e inexistente", async () => {
    await usuario("l");
    expect(await unbanUserAction(idle, form({ id: "l" }))).toEqual(err("Ese usuario no está bloqueado."));
    expect(await unbanUserAction(idle, form({ id: "nadie" }))).toEqual(GONE);
    noInvalida();
  });
});

describe("revokeUserSessionsAction", () => {
  it("cierra las sesiones y devuelve el mensaje", async () => {
    await usuario("l", { name: "Lola" });
    await sesion("l", 3);
    expect(await revokeUserSessionsAction(idle, form({ id: "l" }))).toEqual(
      ok("Se cerraron 3 sesiones de Lola."),
    );
    expect(await sesionesDe("l")).toBe(0);
  });

  it("sobre el admin que la llama no borra su sesión", async () => {
    await sesion("adm");
    expect(await revokeUserSessionsAction(idle, form({ id: "adm" }))).toEqual(
      err("Para cerrar tu sesión usá «Cerrar sesión»."),
    );
    expect(await sesionesDe("adm")).toBe(1);
    noInvalida();
  });

  it("vale para otro admin", async () => {
    await usuario("otro", { role: "admin" });
    await sesion("otro");
    expect((await revokeUserSessionsAction(idle, form({ id: "otro" }))).status).toBe("success");
    expect(await sesionesDe("otro")).toBe(0);
  });

  it("id inexistente", async () => {
    expect(await revokeUserSessionsAction(idle, form({ id: "nadie" }))).toEqual(GONE);
  });
});

describe("resendUserVerificationAction", () => {
  it("sin verificar: llama a sendVerificationEmail con su email", async () => {
    const send = vi
      .spyOn(getAuth().api, "sendVerificationEmail")
      .mockResolvedValue({ status: true } as never);
    await usuario("c", { emailVerified: false });
    expect(await resendUserVerificationAction(idle, form({ id: "c" }))).toEqual(
      ok("Le reenviamos el email de verificación a c@demo.invalid."),
    );
    // Sin headers: con la cookie del admin, Better Auth rechaza el pedido por EMAIL_MISMATCH.
    expect(send).toHaveBeenCalledWith({
      body: { email: "c@demo.invalid", callbackURL: "/cuenta/verificar?estado=ok" },
    });
  });

  it("verificado o bloqueado: no envía", async () => {
    const send = vi
      .spyOn(getAuth().api, "sendVerificationEmail")
      .mockResolvedValue({ status: true } as never);
    await usuario("v");
    await usuario("b", { emailVerified: false, bannedAt: new Date(), banReason: "x" });
    const msg = err("Ese usuario ya no necesita verificar su email.");
    expect(await resendUserVerificationAction(idle, form({ id: "v" }))).toEqual(msg);
    expect(await resendUserVerificationAction(idle, form({ id: "b" }))).toEqual(msg);
    expect(await resendUserVerificationAction(idle, form({ id: "nadie" }))).toEqual(GONE);
    expect(send).not.toHaveBeenCalled();
  });

  it("si el envío falla, devuelve el error genérico", async () => {
    vi.spyOn(getAuth().api, "sendVerificationEmail").mockRejectedValue(new Error("smtp"));
    await usuario("c", { emailVerified: false });
    expect(await resendUserVerificationAction(idle, form({ id: "c" }))).toEqual(DB_ERROR);
    noInvalida();
  });
});

describe("deleteUserAction", () => {
  it("borra con el email correcto", async () => {
    await usuario("l", { name: "Lola" });
    expect(
      await deleteUserAction(idle, form({ id: "l", confirmEmail: " L@Demo.invalid " })),
    ).toEqual(ok("Se borró la cuenta de Lola."));
    expect(await existe("l")).toBe(false);
  });

  it("email que no coincide: error en el campo, no borra", async () => {
    await usuario("l");
    expect(await deleteUserAction(idle, form({ id: "l", confirmEmail: "x@y.z" }))).toEqual({
      status: "error",
      fieldErrors: { confirmEmail: "El email no coincide." },
    });
    expect(await existe("l")).toBe(true);
    noInvalida();
  });

  it("admin, autor e id inexistente", async () => {
    await usuario("otro", { role: "admin" });
    await usuario("autor");
    const [cat] = await getDb().insert(category).values(nuevaCategoria()).returning();
    await getDb().insert(post).values(nuevoPost(cat.id, "autor"));

    expect(await deleteUserAction(idle, form({ id: "otro", confirmEmail: "otro@demo.invalid" }))).toEqual(
      err("No se puede hacer esto con un administrador."),
    );
    expect(await deleteUserAction(idle, form({ id: "autor", confirmEmail: "autor@demo.invalid" }))).toEqual(
      err("No se puede borrar: es autor de 1 artículo."),
    );
    expect(await deleteUserAction(idle, form({ id: "nadie", confirmEmail: "x" }))).toEqual(GONE);
    noInvalida();
  });

  it("un lector que comentó un artículo publicado deja de aparecer en sus comentarios", async () => {
    await usuario("autor");
    await usuario("l", { name: "Lola" });
    const [cat] = await getDb().insert(category).values(nuevaCategoria()).returning();
    const [p] = await getDb().insert(post).values(nuevoPost(cat.id, "autor")).returning();
    await getDb()
      .insert(comment)
      .values({ postId: p.id, userId: "l", text: "hola", status: "aprobado" });
    expect((await getApprovedComments(p.id)).items.map((c) => c.authorName)).toEqual(["Lola"]);

    await deleteUserAction(idle, form({ id: "l", confirmEmail: "l@demo.invalid" }));
    expect((await getApprovedComments(p.id)).items).toEqual([]);
  });

  it("un error de base devuelve el mensaje genérico", async () => {
    vi.spyOn(getDb(), "transaction").mockRejectedValueOnce(new Error("db caída"));
    expect(await deleteUserAction(idle, form({ id: "x", confirmEmail: "x" }))).toEqual(DB_ERROR);
  });
});
