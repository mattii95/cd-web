import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Cloud, Code, Layers, Sparkles } from "@/components/icons";
import { getCategory, getRecentPosts } from "@/lib/blog-posts";

// Ícono de la miniatura según la categoría del post.
const thumbIcons: Record<string, ReactNode> = {
  sistemas: <Layers />,
  saas: <Cloud />,
  ia: <Sparkles />,
  "desarrollo-web": <Code />,
};

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
          {getRecentPosts(3).map((post, i) => {
            const category = getCategory(post.category);
            return (
              <li key={post.slug} className={`fx-reveal r${(i % 2) + 1} flex`}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="fx-card group flex flex-1 flex-col overflow-hidden rounded-[20px] border border-paper-border bg-white text-surface no-underline"
                >
                  <div
                    aria-hidden="true"
                    className="relative flex aspect-video items-center justify-center overflow-hidden bg-background bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px]"
                  >
                    <span className="fx-orb fx-orb1 top-[-10%] left-[22%] aspect-square w-[55%] bg-accent/45 blur-[50px]" />
                    <span className="fx-ring absolute aspect-square w-[44%] rounded-full border border-dashed border-accent-light/45" />
                    <span className="relative flex size-16 items-center justify-center rounded-2xl bg-accent text-white shadow-[0_0_40px_rgba(26,102,245,0.7)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] group-hover:-translate-y-1.5 group-hover:scale-[1.03]">
                      {thumbIcons[post.category]}
                    </span>
                    <span className="absolute bottom-3 left-4 font-mono text-[11px] text-accent-softer">
                      {`// ${post.category}`}
                    </span>
                  </div>

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
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
