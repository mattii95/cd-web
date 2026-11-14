"use client";

import { useState } from "react";
import {
  blogCategories,
  type BlogCategoryTag,
  type BlogPost,
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
  const [featured, ...rest] = posts;
  const matches = (p: BlogPost) => filter === "todos" || p.category === filter;

  return (
    <section className="bg-paper px-6 pt-[72px] pb-24 text-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
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

        {matches(featured) && (
          <FeaturedPost post={featured} date={featuredDate} />
        )}

        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-6 p-0">
          {rest.filter(matches).map((post, i) => (
            <li key={post.slug} className={`fx-reveal r${(i % 2) + 1} flex`}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
