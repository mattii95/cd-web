import Link from "next/link";
import type { PostDetail, RatingSummary } from "@/db/blog";
import { formatAverage } from "@/lib/blog-posts";
import { PersonAvatar } from "./person-avatar";
import { PostThumb } from "./post-thumb";
import { TagList } from "./tag-list";

const gridBg =
  "bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]";

export function ArticleHero({
  post,
  date,
  rating,
}: {
  post: PostDetail;
  date: string; // ya formateada en el servidor
  rating: RatingSummary;
}) {
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
          / <span className="text-white">{post.category.label}</span>
        </nav>
        <h1 className="fx-rise d2 m-0 max-w-[920px] font-display text-[clamp(36px,4.8vw,62px)] leading-[1.05] font-bold tracking-[-0.03em]">
          {post.title}
        </h1>
        <p className="fx-rise d3 m-0 max-w-[720px] text-[19px] leading-[1.6] text-text-muted">
          {post.excerpt}
        </p>
        <div className="fx-rise d3">
          <TagList tags={post.tags} tone="dark" />
        </div>
        <div className="fx-rise d4 flex flex-wrap items-center gap-[18px] text-sm text-text-muted">
          <span className="flex items-center gap-3">
            <PersonAvatar
              name={post.author.name}
              image={post.author.image}
              className="size-10 text-sm"
            />
            <span className="flex flex-col">
              <strong className="text-[15px] text-white">
                {post.author.name}
              </strong>
              {post.author.jobTitle && <span>{post.author.jobTitle}</span>}
            </span>
          </span>
          <span aria-hidden="true" className="h-7 w-px bg-white/15" />
          <span>{date}</span>
          <span className="rounded-full border border-accent-light/45 px-2.5 py-[5px] font-mono text-xs text-accent-softer">
            {post.readingMinutes} min de lectura
          </span>
          {rating.total > 0 && (
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
                ({rating.total}{" "}
                {rating.total === 1 ? "valoración" : "valoraciones"})
              </span>
            </a>
          )}
        </div>
        <div className="fx-rise d4 mt-6 overflow-hidden rounded-t-3xl border border-b-0 border-white/12">
          <PostThumb
            category={post.category.slug}
            icon={post.category.icon}
            cover={post.cover}
            variant="banner"
          />
        </div>
      </div>
    </section>
  );
}
