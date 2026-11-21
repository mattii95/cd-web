import "server-only";
import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  bucketKeys,
  DASHBOARD_TIME_ZONE,
  type DashboardRange,
} from "@/lib/admin/dashboard-params";
import type { CommentStatus } from "./admin-comments";
import { getDb } from "./client";
import { category, comment, post, postRating, user } from "./schema";

// Consultas del Inicio del panel: sin caché y sin now(). Todo agrega en SQL.
// Las columnas `timestamp` guardan UTC y comparan contra el ISO de la fecha.

const ts = (d: Date) => sql`${d.toISOString()}::timestamp`;
const inCurrent = (col: AnyPgColumn, r: DashboardRange): SQL =>
  sql`${col} >= ${ts(r.from)} and ${col} <= ${ts(r.to)}`;
const inPrevious = (col: AnyPgColumn, r: DashboardRange): SQL =>
  sql`${col} >= ${ts(r.prevFrom)} and ${col} < ${ts(r.from)}`;
const countWhere = (cond: SQL) =>
  sql<number>`(count(*) filter (where ${cond}))::int`;

export type PeriodCount = { current: number; previous: number };
export type DashboardKpis = {
  users: { total: number; signups: PeriodCount };
  comments: { created: PeriodCount; pending: number };
  posts: { published: number; drafts: number; publishedInPeriod: PeriodCount };
  ratings: { count: PeriodCount; average: number | null }; // average del período actual
};

export async function getDashboardKpis(
  range: DashboardRange,
): Promise<DashboardKpis> {
  const db = getDb();
  const [[u], [c], [p], [r]] = await Promise.all([
    db
      .select({
        total: count(),
        current: countWhere(inCurrent(user.createdAt, range)),
        previous: countWhere(inPrevious(user.createdAt, range)),
      })
      .from(user),
    db
      .select({
        current: countWhere(inCurrent(comment.createdAt, range)),
        previous: countWhere(inPrevious(comment.createdAt, range)),
        pending: countWhere(sql`${comment.status} = 'pendiente'`),
      })
      .from(comment),
    db
      .select({
        published: countWhere(sql`${post.status} = 'publicado'`),
        drafts: countWhere(sql`${post.status} = 'borrador'`),
        current: countWhere(
          sql`${post.status} = 'publicado' and ${inCurrent(post.publishedAt, range)}`,
        ),
        previous: countWhere(
          sql`${post.status} = 'publicado' and ${inPrevious(post.publishedAt, range)}`,
        ),
      })
      .from(post),
    db
      .select({
        current: countWhere(inCurrent(postRating.createdAt, range)),
        previous: countWhere(inPrevious(postRating.createdAt, range)),
        average: sql<
          number | null
        >`(avg(${postRating.rating}) filter (where ${inCurrent(postRating.createdAt, range)}))::float`,
      })
      .from(postRating),
  ]);
  return {
    users: {
      total: u.total,
      signups: { current: u.current, previous: u.previous },
    },
    comments: {
      created: { current: c.current, previous: c.previous },
      pending: c.pending,
    },
    posts: {
      published: p.published,
      drafts: p.drafts,
      publishedInPeriod: { current: p.current, previous: p.previous },
    },
    ratings: {
      count: { current: r.current, previous: r.previous },
      average: r.average,
    },
  };
}

export type ActivityPoint = {
  key: string;
  users: number;
  comments: number;
  ratings: number;
};

// Clave "YYYY-MM-DD" del día (o del lunes de la semana) en hora de Buenos Aires.
// unit y zona van como literal: un parámetro distinto en SELECT y GROUP BY no empareja.
function bucketExpr(col: AnyPgColumn, range: DashboardRange): SQL<string> {
  const unit = sql.raw(`'${range.bucket}'`);
  const zone = sql.raw(`'${DASHBOARD_TIME_ZONE}'`);
  return sql<string>`to_char(date_trunc(${unit}, ${col} at time zone 'UTC' at time zone ${zone}), 'YYYY-MM-DD')`;
}

async function countByBucket(
  table: PgTable,
  col: AnyPgColumn,
  range: DashboardRange,
): Promise<Map<string, number>> {
  const key = bucketExpr(col, range);
  const rows = await getDb()
    .select({ key, n: count() })
    .from(table)
    .where(inCurrent(col, range))
    .groupBy(key);
  return new Map(rows.map((x) => [x.key, x.n]));
}

export async function getActivitySeries(
  range: DashboardRange,
): Promise<ActivityPoint[]> {
  const [users, comments, ratings] = await Promise.all([
    countByBucket(user, user.createdAt, range),
    countByBucket(comment, comment.createdAt, range),
    countByBucket(postRating, postRating.createdAt, range),
  ]);
  return bucketKeys(range).map((key) => ({
    key,
    users: users.get(key) ?? 0,
    comments: comments.get(key) ?? 0,
    ratings: ratings.get(key) ?? 0,
  }));
}

export async function getCommentStatusBreakdown(
  range: DashboardRange,
): Promise<Record<CommentStatus, number>> {
  const rows = await getDb()
    .select({ status: comment.status, n: count() })
    .from(comment)
    .where(inCurrent(comment.createdAt, range))
    .groupBy(comment.status);
  const out: Record<CommentStatus, number> = {
    pendiente: 0,
    aprobado: 0,
    oculto: 0,
  };
  for (const x of rows) out[x.status] = x.n;
  return out;
}

export async function getRatingDistribution(
  range: DashboardRange,
): Promise<{ stars: 1 | 2 | 3 | 4 | 5; count: number }[]> {
  const rows = await getDb()
    .select({ stars: postRating.rating, n: count() })
    .from(postRating)
    .where(inCurrent(postRating.createdAt, range))
    .groupBy(postRating.rating);
  const byStars = new Map(rows.map((x) => [x.stars, x.n]));
  return ([5, 4, 3, 2, 1] as const).map((stars) => ({
    stars,
    count: byStars.get(stars) ?? 0,
  }));
}

// Todas las categorías, con 0 en las vacías; solo cuenta artículos publicados.
export async function getPublishedByCategory(): Promise<
  { id: string; label: string; count: number }[]
> {
  const rows = await getDb()
    .select({ id: category.id, label: category.label, n: count(post.id) })
    .from(category)
    .leftJoin(
      post,
      and(eq(post.categoryId, category.id), eq(post.status, "publicado")),
    )
    .groupBy(category.id)
    .orderBy(asc(category.position), asc(category.id));
  return rows.map((x) => ({ id: x.id, label: x.label, count: x.n }));
}

export type TopPost = {
  id: string;
  title: string;
  comments: number; // aprobados en el período
  ratings: number; // creadas en el período
  average: number | null;
};

export async function getTopPosts(
  range: DashboardRange,
  limit = 5,
): Promise<TopPost[]> {
  const db = getDb();
  const c = db
    .select({ postId: comment.postId, n: count().as("comment_n") })
    .from(comment)
    .where(
      and(eq(comment.status, "aprobado"), inCurrent(comment.createdAt, range)),
    )
    .groupBy(comment.postId)
    .as("c");
  const r = db
    .select({
      postId: postRating.postId,
      n: count().as("rating_n"),
      avg: sql<number>`avg(${postRating.rating})::float`.as("rating_avg"),
    })
    .from(postRating)
    .where(inCurrent(postRating.createdAt, range))
    .groupBy(postRating.postId)
    .as("r");

  const comments = sql<number>`coalesce(${c.n}, 0)::int`;
  const ratings = sql<number>`coalesce(${r.n}, 0)::int`;
  const rows = await db
    .select({
      id: post.id,
      title: post.title,
      comments,
      ratings,
      average: r.avg,
    })
    .from(post)
    .leftJoin(c, eq(c.postId, post.id))
    .leftJoin(r, eq(r.postId, post.id))
    .where(and(eq(post.status, "publicado"), sql`${comments} + ${ratings} > 0`))
    .orderBy(
      desc(sql`${comments} + ${ratings}`),
      sql`${r.avg} desc nulls last`,
      asc(post.title),
      asc(post.id),
    )
    .limit(limit);
  return rows.map((x) => ({ ...x, average: x.average ?? null }));
}

export type PendingPreview = {
  id: string;
  text: string; // ya recortado a 120 + "…"
  createdAt: Date;
  author: { name: string };
  post: { title: string };
};

const PREVIEW_MAX = 120;

export async function getOldestPendingComments(
  limit = 5,
): Promise<PendingPreview[]> {
  const rows = await getDb()
    .select({
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      authorName: user.name,
      postTitle: post.title,
    })
    .from(comment)
    .innerJoin(user, eq(user.id, comment.userId))
    .innerJoin(post, eq(post.id, comment.postId))
    .where(eq(comment.status, "pendiente"))
    .orderBy(asc(comment.createdAt), asc(comment.id))
    .limit(limit);
  return rows.map((x) => ({
    id: x.id,
    text:
      x.text.length > PREVIEW_MAX
        ? `${x.text.slice(0, PREVIEW_MAX).trimEnd()}…`
        : x.text,
    createdAt: x.createdAt,
    author: { name: x.authorName },
    post: { title: x.postTitle },
  }));
}

export type NewUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
};

export async function getNewestUsers(limit = 5): Promise<NewUser[]> {
  return getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt), desc(user.id))
    .limit(limit);
}
