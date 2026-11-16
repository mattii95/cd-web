import Link from "next/link";
import {
  blogAuthor,
  formatAverage,
  getCategory,
  getRatingSummary,
  getTag,
  type BlogPost,
} from "@/lib/blog-posts";
import { PostThumb } from "./post-thumb";
import { TagList } from "./tag-list";

const gridBg =
  "bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]";

export function ArticleHero({
  post,
  date,
}: {
  post: BlogPost;
  date: string; // ya formateada en el servidor
}) {
  const category = getCategory(post.category);
  const rating = post.reviews && getRatingSummary(post.reviews);
  return (
    <section className="relative overflow-hidden bg-background text-white">
      <div
        aria-hidden="true"
        className={`fx-grid absolute inset-0 ${gridBg}`}
      />
      <div
        aria-hidden="true"
        className="fx-orb fx-orb1 top-5 -right-25 size-[520px] bg-accent/45"
      />
      {/* pt: 92px de header (absoluto) + 40px de aire */}
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-[22px] px-6 pt-[132px]">
        <nav
          aria-label="Breadcrumb"
          className="fx-rise d1 text-sm text-text-muted"
        >
          <Link
            href="/blog"
            className="text-text-muted no-underline hover:text-white"
          >
            Blog
          </Link>{" "}
          / <span className="text-white">{category.label}</span>
        </nav>
        <h1 className="fx-rise d2 m-0 max-w-[920px] font-display text-[clamp(36px,4.8vw,62px)] leading-[1.05] font-bold tracking-[-0.03em]">
          {post.title}
        </h1>
        <p className="fx-rise d3 m-0 max-w-[720px] text-[19px] leading-[1.6] text-text-muted">
          {post.excerpt}
        </p>
        <div className="fx-rise d3">
          <TagList tags={post.tags.map((s) => getTag(s)!)} tone="dark" />
        </div>
        <div className="fx-rise d4 flex flex-wrap items-center gap-[18px] text-sm text-text-muted">
          <span className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full bg-accent font-mono text-sm font-semibold text-white"
            >
              {blogAuthor.initials}
            </span>
            <span className="flex flex-col">
              <strong className="text-[15px] text-white">
                {blogAuthor.name}
              </strong>
              <span>{blogAuthor.role}</span>
            </span>
          </span>
          <span aria-hidden="true" className="h-7 w-px bg-white/15" />
          <span>{date}</span>
          <span className="rounded-full border border-accent-light/45 px-2.5 py-[5px] font-mono text-xs text-accent-softer">
            {post.readingMinutes} min de lectura
          </span>
          {post.reviews && rating && (
            <a
              href="#valoraciones"
              className="inline-flex items-center gap-1.5 py-2.5 text-sm text-white no-underline"
            >
              <span
                aria-hidden="true"
                className="text-accent-light [text-shadow:0_0_10px_rgba(77,139,255,0.8)]"
              >
                ★
              </span>
              <strong>{formatAverage(rating.average)}</strong>
              <span className="text-text-muted">
                ({rating.total} valoraciones · {post.reviews.comments.length}{" "}
                comentarios)
              </span>
            </a>
          )}
        </div>
        <div className="fx-rise d4 mt-6 overflow-hidden rounded-t-3xl border border-b-0 border-white/12">
          <PostThumb
            category={post.category}
            cover={post.cover}
            variant="banner"
          />
        </div>
      </div>
    </section>
  );
}
