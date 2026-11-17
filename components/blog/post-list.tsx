"use client";

import Link from "next/link";
import { useState } from "react";
import { loadMorePostsAction } from "@/actions/blog";
import type { BlogCategoryRow, PostSummary, TagRow } from "@/db/blog";
import { FeaturedPost } from "./featured-post";
import { LoadMore } from "./load-more";
import { PostCard } from "./post-card";

// Los filtros viven en la URL: cada opción es un enlace que conserva el otro filtro.
function filterHref(categoria?: string, etiqueta?: string) {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (etiqueta) params.set("etiqueta", etiqueta);
  const qs = params.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

// La página lo monta con key = categoria|etiqueta: al cambiar un filtro se reinicia lo cargado.
export function PostList({
  initialPosts,
  initialCursor,
  categories,
  tags,
  categoria,
  etiqueta,
}: {
  initialPosts: PostSummary[]; // primera página; el primero es el destacado
  initialCursor: string | null;
  categories: BlogCategoryRow[];
  tags: TagRow[];
  categoria?: string; // ya validados contra la base
  etiqueta?: string;
}) {
  const [more, setMore] = useState<PostSummary[]>([]);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [featured, ...first] = initialPosts;
  const rest = [...first, ...more];

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const result = await loadMorePostsAction(cursor, {
        category: categoria,
        tag: etiqueta,
      });
      if (result.status === "success") {
        setMore((prev) => [...prev, ...result.items]);
        setCursor(result.nextCursor);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const categoryFilters = [
    { slug: undefined, label: "Todos" },
    ...categories.map((c) => ({
      slug: c.slug as string,
      label: c.filterLabel,
    })),
  ];
  const tagFilters = [
    { slug: undefined, name: "Todas", count: null },
    ...tags.map((t) => ({ ...t, slug: t.slug as string | undefined })),
  ];

  return (
    <section className="bg-paper px-6 pt-[72px] pb-24 text-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
        <div className="flex flex-col items-start gap-3">
          <div
            role="group"
            aria-label="Filtrar por categoría"
            className="flex flex-wrap gap-1.5 self-start rounded-full border border-paper-border bg-white p-1.5"
          >
            {categoryFilters.map((f) => {
              const active = f.slug === categoria;
              return (
                <Link
                  key={f.slug ?? "todos"}
                  href={filterHref(f.slug, etiqueta)}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full px-[18px] py-2.5 text-sm font-semibold no-underline ${
                    active
                      ? "bg-accent text-white shadow-[0_0_20px_rgba(26,102,245,0.5)]"
                      : "bg-transparent text-[#2b3449]"
                  }`}
                >
                  {f.label}
                </Link>
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
            {tagFilters.map((t) => {
              const active = t.slug === etiqueta;
              return (
                <Link
                  key={t.slug ?? "todas"}
                  href={filterHref(categoria, t.slug)}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium no-underline ${
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
                </Link>
              );
            })}
          </div>
        </div>

        {featured && <FeaturedPost post={featured} />}

        {featured ? (
          <>
            {rest.length > 0 && (
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-6 p-0">
                {rest.map((post, i) => (
                  <li
                    key={post.id}
                    className={`fx-reveal r${(i % 2) + 1} flex`}
                  >
                    <PostCard post={post} />
                  </li>
                ))}
              </ul>
            )}
            {cursor && (
              <LoadMore
                label="Cargar más"
                errorMessage="No pudimos cargar más artículos."
                loading={loading}
                failed={failed}
                onClick={loadMore}
              />
            )}
          </>
        ) : (
          <p className="m-0 text-base text-text-faint">
            No hay artículos con esa combinación.
          </p>
        )}
      </div>
    </section>
  );
}
