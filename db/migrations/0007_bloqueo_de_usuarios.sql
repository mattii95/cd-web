ALTER TABLE "user" ADD COLUMN "banned_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_banned_by_user_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_ban_check" CHECK (("user"."banned_at" IS NULL) = ("user"."ban_reason" IS NULL));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_ban_reason_check" CHECK ("user"."ban_reason" IS NULL OR length(trim("user"."ban_reason")) BETWEEN 1 AND 300);