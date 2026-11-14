import Link from "next/link";
import { blogAuthor, getCategory, type BlogPost } from "@/lib/blog-posts";
import { PostThumb } from "./post-thumb";

export function FeaturedPost({
  post,
  date,
}: {
  post: BlogPost;
  date: string; // ya formateada en el servidor
}) {
  const category = getCategory(post.category);
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="fx-card group grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] overflow-hidden rounded-3xl border border-paper-border bg-white text-surface no-underline"
    >
      <PostThumb category={post.category} large />
      <div className="flex flex-col justify-center gap-4 p-[clamp(28px,4vw,48px)]">
        <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-text-faint">
          <span className="rounded-full bg-[#050b1c] px-3 py-[5px] text-xs font-semibold text-white">
            Destacado
          </span>
          <span className="rounded-full border border-[#c9d9fb] bg-accent-tint px-2.5 py-1 font-mono text-[11px] font-medium text-[#1450c8]">
            {category.label}
          </span>
          {post.readingMinutes} min de lectura
        </div>
        <h2 className="m-0 font-display text-[clamp(26px,2.8vw,36px)] leading-[1.15] font-bold tracking-[-0.02em]">
          {post.title}
        </h2>
        <p className="m-0 text-[17px] leading-[1.6] text-text-faint">
          {post.excerpt}
        </p>
        <span className="mt-2 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-accent font-mono text-xs font-semibold text-white"
          >
            {blogAuthor.initials}
          </span>
          <span className="flex flex-col text-[13px]">
            <strong className="text-sm">{blogAuthor.name}</strong>
            <span className="text-text-faint">{date}</span>
          </span>
        </span>
      </div>
    </Link>
  );
}
