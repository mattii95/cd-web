CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"original_name" text NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "media_sha256_unique" UNIQUE("sha256"),
	CONSTRAINT "media_alt_check" CHECK (length(trim("media"."alt")) > 0),
	CONSTRAINT "media_width_check" CHECK ("media"."width" > 0),
	CONSTRAINT "media_height_check" CHECK ("media"."height" > 0),
	CONSTRAINT "media_bytes_check" CHECK ("media"."bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "cover_media_id" text;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_created_at_index" ON "media" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_cover_media_id_index" ON "post" USING btree ("cover_media_id");