import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import type { PostDetail } from "@/db/blog";
import { getService } from "@/lib/services";

export function ArticleCta({ post }: { post: PostDetail }) {
  const service = getService(post.category.serviceSlug)!;
  return (
    <div className="fx-reveal fx-beam relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-3xl bg-[#050b1c] p-8 text-white">
      <div
        aria-hidden="true"
        className="fx-orb fx-orb1 -top-35 -right-20 size-[300px] bg-accent/45"
      />
      <p className="relative m-0 max-w-[420px] font-display text-2xl leading-[1.2] font-semibold">
        {post.cta}
      </p>
      <Link
        href={`/servicios/${service.slug}`}
        className="fx-btn relative inline-flex min-h-12 items-center gap-2.5 rounded-full bg-accent px-6 py-3.5 text-[15px] font-semibold text-white no-underline"
      >
        Ver {service.title}
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}
