"use client";

import { useRouter } from "next/navigation";
import {
  type AdminPostQuery,
  articlesHref,
  PER_PAGE_OPTIONS,
} from "@/lib/admin/article-params";

export function PerPageSelect({ query }: { query: AdminPostQuery }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2 text-sm text-cms-text">
      <label htmlFor="per-page">Filas por página</label>
      <select
        id="per-page"
        value={query.perPage}
        onChange={(e) =>
          router.push(articlesHref(query, { perPage: Number(e.target.value) as AdminPostQuery["perPage"] }), {
            scroll: false,
          })
        }
        className="min-h-11 rounded-lg border border-cms-control bg-cms-panel px-3 text-sm text-cms-ink"
      >
        {PER_PAGE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
