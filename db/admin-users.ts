import "server-only";
import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { isDeleteConfirmed } from "@/lib/admin/user-form";
import { USERS_PER_PAGE, type AdminUserQuery } from "@/lib/admin/user-params";
import { METHOD_ORDER, type LoginMethod, type Role } from "@/lib/auth/dal";
import { getDb } from "./client";
import { account, post, session, user } from "./schema";

// Consultas del panel: sin caché. Quien escribe revalida la página (y `blog` si borra).

export type UserStatus = "activo" | "sin-verificar" | "bloqueado";
export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  status: UserStatus;
  bannedAt: Date | null;
  banReason: string | null;
  bannedByName: string | null;
  methods: LoginMethod[];
  lastActiveAt: Date | null; // max(session.updated_at)
  sessions: number;
  posts: number; // artículos como autor, de cualquier estado
  comments: number;
  ratings: number;
  votes: number;
  createdAt: Date;
};
export type AdminUserList = {
  items: AdminUserRow[];
  total: number; // con búsqueda y filtros
  page: number; // acotada a [1, pageCount]
  pageCount: number; // ≥ 1
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

function listWhere({ q, estado, rol }: AdminUserQuery): SQL | undefined {
  const pattern = q ? `%${escapeLike(q)}%` : null;
  return and(
    pattern ? or(ilike(user.name, pattern), ilike(user.email, pattern)) : undefined,
    estado === "bloqueados" ? isNotNull(user.bannedAt) : undefined,
    estado === "activos" ? and(isNull(user.bannedAt), eq(user.emailVerified, true)) : undefined,
    estado === "sin-verificar"
      ? and(isNull(user.bannedAt), eq(user.emailVerified, false))
      : undefined,
    rol ? eq(user.role, rol === "admins" ? "admin" : "lector") : undefined,
  );
}

const statusOf = (u: { bannedAt: Date | null; emailVerified: boolean }): UserStatus =>
  u.bannedAt ? "bloqueado" : u.emailVerified ? "activo" : "sin-verificar";

export async function listAdminUsers(query: AdminUserQuery): Promise<AdminUserList> {
  const db = getDb();
  const where = listWhere(query);

  const [{ total }] = await db.select({ total: count() }).from(user).where(where);
  const pageCount = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  const page = Math.min(query.page, pageCount);

  const banner = alias(user, "banner");
  // Subconsultas correlacionadas: corren solo sobre las filas de la página.
  const n = (table: string, col: string) =>
    sql<number>`(select count(*)::int from ${sql.identifier(table)} where ${sql.identifier(table)}.${sql.identifier(col)} = ${user.id})`;

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      emailVerified: user.emailVerified,
      bannedAt: user.bannedAt,
      banReason: user.banReason,
      bannedByName: banner.name,
      createdAt: user.createdAt,
      methods: sql<string[]>`coalesce((select array_agg(distinct ${account.providerId}) from ${account} where ${account.userId} = ${user.id}), '{}')`,
      lastActiveAt: sql<Date | null>`(select max(${session.updatedAt}) from ${session} where ${session.userId} = ${user.id})`.mapWith(
        user.createdAt,
      ),
      sessions: n("session", "user_id"),
      posts: n("post", "author_id"),
      comments: n("comment", "user_id"),
      ratings: n("post_rating", "user_id"),
      votes: n("comment_vote", "user_id"),
    })
    .from(user)
    .leftJoin(banner, eq(banner.id, user.bannedBy))
    .where(where)
    .orderBy(desc(user.createdAt), desc(user.id)) // id desempata: sin él, las páginas se mezclan
    .limit(USERS_PER_PAGE)
    .offset((page - 1) * USERS_PER_PAGE);

  const items = rows.map(({ emailVerified, methods, ...r }) => ({
    ...r,
    status: statusOf({ bannedAt: r.bannedAt, emailVerified }),
    methods: METHOD_ORDER.filter((m) => methods.includes(m)),
  }));
  return { items, total, page, pageCount };
}

type Guarded<T> = T | { ok: false; reason: "not-found" | "protected" };

// "protected" = el destino es administrador: las reglas viven acá, no solo en el menú.
export async function banUser(
  id: string,
  reason: string,
  by: string,
): Promise<Guarded<{ ok: true; name: string; revoked: number } | { ok: false; reason: "already" }>> {
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ name: user.name, role: user.role, bannedAt: user.bannedAt })
      .from(user)
      .where(eq(user.id, id))
      .for("update");
    if (!target) return { ok: false as const, reason: "not-found" as const };
    if (target.role === "admin") return { ok: false as const, reason: "protected" as const };
    if (target.bannedAt) return { ok: false as const, reason: "already" as const };

    await tx
      .update(user)
      .set({ bannedAt: new Date(), banReason: reason, bannedBy: by })
      .where(eq(user.id, id));
    const gone = await tx.delete(session).where(eq(session.userId, id)).returning({ id: session.id });
    return { ok: true as const, name: target.name, revoked: gone.length };
  });
}

export async function unbanUser(
  id: string,
): Promise<{ ok: true; name: string } | { ok: false; reason: "not-found" | "not-banned" }> {
  const db = getDb();
  const [row] = await db
    .update(user)
    .set({ bannedAt: null, banReason: null, bannedBy: null })
    .where(and(eq(user.id, id), isNotNull(user.bannedAt)))
    .returning({ name: user.name });
  if (row) return { ok: true, name: row.name };
  const [exists] = await db.select({ id: user.id }).from(user).where(eq(user.id, id));
  return { ok: false, reason: exists ? "not-banned" : "not-found" };
}

export async function revokeUserSessions(
  id: string,
): Promise<{ ok: true; name: string; revoked: number } | { ok: false; reason: "not-found" }> {
  return getDb().transaction(async (tx) => {
    const [target] = await tx.select({ name: user.name }).from(user).where(eq(user.id, id));
    if (!target) return { ok: false as const, reason: "not-found" as const };
    const gone = await tx.delete(session).where(eq(session.userId, id)).returning({ id: session.id });
    return { ok: true as const, name: target.name, revoked: gone.length };
  });
}

// session, account, author_profile, comment, comment_vote y post_rating caen en cascada;
// media.uploaded_by queda en NULL.
export async function deleteUser(
  id: string,
  confirmEmail: string,
): Promise<
  Guarded<
    | { ok: true; name: string }
    | { ok: false; reason: "author"; posts: number }
    | { ok: false; reason: "mismatch" }
  >
> {
  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ name: user.name, email: user.email, role: user.role })
      .from(user)
      .where(eq(user.id, id))
      .for("update");
    if (!target) return { ok: false as const, reason: "not-found" as const };
    if (target.role === "admin") return { ok: false as const, reason: "protected" as const };

    const [{ posts }] = await tx.select({ posts: count() }).from(post).where(eq(post.authorId, id));
    if (posts > 0) return { ok: false as const, reason: "author" as const, posts };
    if (!isDeleteConfirmed(confirmEmail, target.email))
      return { ok: false as const, reason: "mismatch" as const };

    await tx.delete(user).where(eq(user.id, id));
    return { ok: true as const, name: target.name };
  });
}

export async function getUserForVerification(id: string) {
  const [row] = await getDb()
    .select({ email: user.email, emailVerified: user.emailVerified, bannedAt: user.bannedAt })
    .from(user)
    .where(eq(user.id, id));
  return row ?? null;
}
