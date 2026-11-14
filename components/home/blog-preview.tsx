import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { PostCard } from "@/components/blog/post-card";
import { getRecentPosts } from "@/lib/blog-posts";

export function BlogPreview() {
  return (
    <section
      id="blog"
      className="relative overflow-hidden bg-paper px-6 py-28 text-surface"
    >
      <div
        aria-hidden="true"
        className="fx-orb fx-orb1 top-30 -right-40 size-[460px] bg-accent/[0.12]"
      />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-[620px] flex-col gap-4">
            <span className="font-mono text-[13px] font-medium text-accent">
              {"// blog"}
            </span>
            <h2 className="m-0 font-display text-[clamp(32px,3.8vw,50px)] leading-[1.05] font-bold tracking-[-0.025em]">
              Ideas para hacer crecer tu negocio con tecnología
            </h2>
          </div>
          <Link
            href="/blog"
            className="fx-btn inline-flex min-h-12 items-center gap-2.5 rounded-full bg-background px-6 py-3.5 text-[15px] font-semibold text-white no-underline"
          >
            Ver todos los artículos
            <ArrowRight />
          </Link>
        </div>

        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-6 p-0">
          {getRecentPosts(3).map((post, i) => (
            <li key={post.slug} className={`fx-reveal r${(i % 2) + 1} flex`}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
