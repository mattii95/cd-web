"use client";

import { useState } from "react";
import {
  blogCategories,
  type BlogCategoryTag,
  getUsedTags,
  mockToSummary,
  type BlogPost,
  type BlogTagSlug,
} from "@/lib/blog-posts";
import { FeaturedPost } from "./featured-post";
import { PostCard } from "./post-card";

type Filter = "todos" | BlogCategoryTag;

const filters: { value: Filter; label: string }[] = [
  { value: "todos", label: "Todos" },
  ...blogCategories.map((c) => ({ value: c.tag, label: c.filterLabel })),
];

// posts viene ordenado por fecha: el primero es el destacado.
export function PostList({
  posts,
  featuredDate,
}: {
  posts: BlogPost[];
  featuredDate: string;
}) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [tag, setTag] = useState<"todas" | BlogTagSlug>("todas");
  const [featured, ...rest] = posts;
  const usedTags = getUsedTags(posts);
  const matches = (p: BlogPost) =>
    (filter === "todos" || p.category === filter) &&
    (tag === "todas" || p.tags.includes(tag));
  const visible = rest.filter(matches);
  const showFeatured = !!featured && matches(featured);

  return (
    <section className="bg-paper px-6 pt-[72px] pb-24 text-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
        <div className="flex flex-col items-start gap-3">
          <div
            role="group"
            aria-label="Filtrar por categoría"
            className="flex flex-wrap gap-1.5 self-start rounded-full border border-paper-border bg-white p-1.5"
          >
            {filters.map((f) => {
              const active = f.value === filter;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  className={`min-h-11 cursor-pointer rounded-full border-0 px-[18px] py-2.5 text-sm font-semibold ${
                    active
                      ? "bg-accent text-white shadow-[0_0_20px_rgba(26,102,245,0.5)]"
                      : "bg-transparent text-[#2b3449]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Filtrar por etiqueta"
            className="flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 text-sm font-medium text-text-faint">
              Etiquetas
            </span>
            {[
              { slug: "todas" as const, name: "Todas", count: null },
              ...usedTags,
            ].map((t) => {
              const active = t.slug === tag;
              return (
                <button
                  key={t.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTag(t.slug)}
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium ${
                    active
                      ? "border-accent bg-accent text-white"
                      : "border-paper-border bg-white text-[#2b3449]"
                  }`}
                >
                  {t.name}
                  {t.count !== null && (
                    <span
                      className={`font-mono text-xs ${active ? "text-white/80" : "text-text-faint"}`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {showFeatured && <FeaturedPost post={featured} date={featuredDate} />}

        {showFeatured || visible.length > 0 ? (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-6 p-0">
            {visible.map((post, i) => (
              <li key={post.slug} className={`fx-reveal r${(i % 2) + 1} flex`}>
                <PostCard post={mockToSummary(post)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-base text-text-faint">
            No hay artículos con esa combinación.
          </p>
        )}
      </div>
    </section>
  );
}
