CREATE TYPE "public"."comment_status" AS ENUM('pendiente', 'aprobado', 'oculto');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('borrador', 'publicado');--> statement-breakpoint
CREATE TABLE "author_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"job_title" text NOT NULL,
	"bio" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"filter_label" text NOT NULL,
	"service_slug" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"status" "comment_status" DEFAULT 'pendiente' NOT NULL,
	"reply_text" text,
	"replied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_text_check" CHECK (length(trim("comment"."text")) > 0),
	CONSTRAINT "comment_reply_check" CHECK (("comment"."reply_text" IS NULL) = ("comment"."replied_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "comment_vote" (
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_vote_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"body" jsonb NOT NULL,
	"cta" text NOT NULL,
	"reading_minutes" integer NOT NULL,
	"category_id" text NOT NULL,
	"author_id" text NOT NULL,
	"status" "post_status" DEFAULT 'borrador' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_slug_unique" UNIQUE("slug"),
	CONSTRAINT "post_reading_minutes_check" CHECK ("post"."reading_minutes" > 0),
	CONSTRAINT "post_published_at_check" CHECK ("post"."status" <> 'publicado' OR "post"."published_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "post_rating" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" smallint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_rating_post_id_user_id_pk" PRIMARY KEY("post_id","user_id"),
	CONSTRAINT "post_rating_rating_check" CHECK ("post_rating"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "author_profile" ADD CONSTRAINT "author_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_vote" ADD CONSTRAINT "comment_vote_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_vote" ADD CONSTRAINT "comment_vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_rating" ADD CONSTRAINT "post_rating_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_rating" ADD CONSTRAINT "post_rating_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_post_id_status_created_at_index" ON "comment" USING btree ("post_id","status","created_at");--> statement-breakpoint
CREATE INDEX "comment_user_id_index" ON "comment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "post_status_published_at_index" ON "post" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "post_category_id_index" ON "post" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "post_author_id_index" ON "post" USING btree ("author_id");