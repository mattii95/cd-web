import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { getRelatedPosts, type BlogPost } from "@/lib/blog-posts";
import { PostCard } from "./post-card";

export function RelatedPosts({ post }: { post: BlogPost }) {
  return (
    <section className="bg-paper px-6 pb-24 text-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="m-0 font-display text-[32px] font-bold tracking-[-0.02em]">
            Seguí leyendo
          </h2>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 py-3 text-[15px] font-semibold text-accent no-underline"
          >
            Ver todos los artículos
            <ArrowRight size={16} className="fx-arrow" />
          </Link>
        </div>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-6 p-0">
          {getRelatedPosts(post, 3).map((p, i) => (
            <li key={p.slug} className={`fx-reveal r${(i % 2) + 1} flex`}>
              <PostCard post={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
