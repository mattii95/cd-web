import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { StoredBlogBlock } from "../blog-body";
import { user } from "./auth";

export const postStatus = pgEnum("post_status", ["borrador", "publicado"]);
export const commentStatus = pgEnum("comment_status", [
  "pendiente",
  "aprobado",
  "oculto",
]);

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp().notNull().defaultNow();
const updatedAt = () =>
  timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const category = pgTable("category", {
  id: id(),
  slug: text().notNull().unique(), // BlogCategoryTag
  label: text().notNull(), // badge
  filterLabel: text().notNull(), // botón de filtro
  serviceSlug: text().notNull(), // ServiceSlug del CTA; sin FK, los servicios viven en código
  position: integer().notNull(), // orden de los filtros
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const authorProfile = pgTable("author_profile", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  jobTitle: text().notNull(),
  bio: text().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const post = pgTable(
  "post",
  {
    id: id(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    excerpt: text().notNull(),
    body: jsonb().$type<StoredBlogBlock[]>().notNull(),
    cta: text().notNull(),
    readingMinutes: integer().notNull(),
    categoryId: text()
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    authorId: text()
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: postStatus().notNull().default("borrador"),
    publishedAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("post_reading_minutes_check", sql`${t.readingMinutes} > 0`),
    check(
      "post_published_at_check",
      sql`${t.status} <> 'publicado' OR ${t.publishedAt} IS NOT NULL`,
    ),
    index().on(t.status, t.publishedAt),
    index().on(t.categoryId),
    index().on(t.authorId),
  ],
);

export const postRating = pgTable(
  "post_rating",
  {
    postId: text()
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    rating: smallint().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.userId] }),
    check("post_rating_rating_check", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

export const comment = pgTable(
  "comment",
  {
    id: id(),
    postId: text()
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text().notNull(),
    status: commentStatus().notNull().default("pendiente"),
    replyText: text(), // respuesta del autor del post
    repliedAt: timestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("comment_text_check", sql`length(trim(${t.text})) > 0`),
    check(
      "comment_reply_check",
      sql`(${t.replyText} IS NULL) = (${t.repliedAt} IS NULL)`,
    ),
    index().on(t.postId, t.status, t.createdAt),
    index().on(t.userId),
  ],
);

export const commentVote = pgTable(
  "comment_vote",
  {
    commentId: text()
      .notNull()
      .references(() => comment.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);
