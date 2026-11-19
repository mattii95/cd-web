CREATE TYPE "public"."category_icon" AS ENUM('code', 'layers', 'cloud', 'sparkles', 'bolt', 'chat');--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "icon" "category_icon" NOT NULL DEFAULT 'code';--> statement-breakpoint
UPDATE "category" SET "icon" = CASE "slug"
	WHEN 'sistemas' THEN 'layers'::"category_icon"
	WHEN 'saas' THEN 'cloud'::"category_icon"
	WHEN 'ia' THEN 'sparkles'::"category_icon"
	ELSE 'code'::"category_icon"
END;--> statement-breakpoint
ALTER TABLE "category" ALTER COLUMN "icon" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_slug_check" CHECK ("category"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_label_check" CHECK (length(trim("category"."label")) > 0);--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_filter_label_check" CHECK (length(trim("category"."filter_label")) > 0);