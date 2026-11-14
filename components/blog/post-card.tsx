import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { getCategory, type BlogPost } from "@/lib/blog-posts";
import { PostThumb } from "./post-thumb";

export function PostCard({ post }: { post: BlogPost }) {
  const category = getCategory(post.category);
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="fx-card group flex flex-1 flex-col overflow-hidden rounded-[20px] border border-paper-border bg-white text-surface no-underline"
    >
      <PostThumb category={post.category} />
      <div className="flex flex-1 flex-col gap-2.5 px-6 pt-[22px] pb-[26px]">
        <div className="flex items-center gap-2.5 text-[13px] text-text-faint">
          <span className="rounded-full border border-[#c9d9fb] bg-accent-tint px-2.5 py-1 font-mono text-[11px] font-medium text-[#1450c8]">
            {category.label}
          </span>
          {post.readingMinutes} min de lectura
        </div>
        <h3 className="m-0 font-display text-xl leading-[1.3] font-semibold">
          {post.title}
        </h3>
        <p className="m-0 text-[15px] leading-[1.55] text-text-faint">
          {post.excerpt}
        </p>
        <span className="mt-auto inline-flex items-center gap-2 pt-1.5 text-sm font-semibold text-accent">
          Leer artículo
          <ArrowRight size={16} className="fx-arrow" />
        </span>
      </div>
    </Link>
  );
}
