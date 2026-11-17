"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "@/components/icons";
import { type AdminPostQuery, articlesHref } from "@/lib/admin/article-params";

type Props = { query: AdminPostQuery; categories: { slug: string; label: string }[] };

const control =
  "min-h-11 rounded-lg border border-cms-control bg-cms-panel px-3 text-sm text-cms-ink";

export function ArticleFilters({ query, categories }: Props) {
  const router = useRouter();
  const [text, setText] = useState(query.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (patch: Partial<AdminPostQuery>, replace = false) => {
    const href = articlesHref(query, patch);
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };
  const hasFilters = Boolean(query.q || query.category || query.updated);

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-cms-line bg-cms-panel-alt px-4 py-3">
      <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1">
        <label htmlFor="article-search" className="text-xs font-semibold text-cms-text">
          Buscar
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-cms-muted" />
          <input
            id="article-search"
            type="search"
            value={text}
            placeholder="Título o slug"
            onChange={(e) => {
              setText(e.target.value);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => go({ q: e.target.value.trim() || null }, true), 300);
            }}
            className={`${control} w-full pl-10`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="article-category" className="text-xs font-semibold text-cms-text">
          Categoría
        </label>
        <select
          id="article-category"
          value={query.category ?? ""}
          onChange={(e) => go({ category: e.target.value || null })}
          className={control}
        >
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="article-updated" className="text-xs font-semibold text-cms-text">
          Actualizado
        </label>
        <select
          id="article-updated"
          value={query.updated ?? ""}
          onChange={(e) => go({ updated: (e.target.value || null) as AdminPostQuery["updated"] })}
          className={control}
        >
          <option value="">Cualquier fecha</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="year">Este año</option>
        </select>
      </div>
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            clearTimeout(timer.current);
            setText("");
            go({ q: null, category: null, updated: null });
          }}
          className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold text-cms-link underline-offset-2 hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
