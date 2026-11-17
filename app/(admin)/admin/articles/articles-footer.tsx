import Link from "next/link";
import type { AdminPostList } from "@/db/admin-posts";
import { type AdminPostQuery, articlesHref } from "@/lib/admin/article-params";
import { PerPageSelect } from "./per-page-select";

// Con más de 7 páginas: primera, última, la actual ±1 y "…" en los huecos.
function pageItems(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const keep = [...new Set([1, count, current - 1, current, current + 1])]
    .filter((n) => n >= 1 && n <= count)
    .sort((a, b) => a - b);
  return keep.flatMap((n, i) => (i > 0 && n - keep[i - 1] > 1 ? ["…" as const, n] : [n]));
}

const pageLink =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors";

export function ArticlesFooter({ query, list }: { query: AdminPostQuery; list: AdminPostList }) {
  const { page, pageCount, total, items } = list;
  const from = (page - 1) * query.perPage + 1;
  const to = from + items.length - 1;
  const at = (n: number) => articlesHref({ ...query, page }, { page: n });

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-cms-line px-4 py-3">
      <p className="m-0 text-sm text-cms-text">
        Mostrando {from}–{to} de {total} {total === 1 ? "artículo" : "artículos"}
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <PerPageSelect query={query} />
        {pageCount > 1 && (
          <nav aria-label="Paginación" className="flex flex-wrap items-center gap-1">
            {page > 1 ? (
              <Link href={at(page - 1)} className={`${pageLink} border-cms-control text-cms-ink hover:bg-cms-chip`}>
                Anterior
              </Link>
            ) : (
              <span aria-disabled="true" className={`${pageLink} border-cms-line-soft text-cms-muted opacity-60`}>
                Anterior
              </span>
            )}
            {pageItems(page, pageCount).map((n, i) =>
              n === "…" ? (
                <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-cms-muted">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={at(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={`${pageLink} ${
                    n === page
                      ? "border-cms-link bg-cms-link text-white"
                      : "border-transparent text-cms-ink hover:bg-cms-chip"
                  }`}
                >
                  {n}
                </Link>
              ),
            )}
            {page < pageCount ? (
              <Link href={at(page + 1)} className={`${pageLink} border-cms-control text-cms-ink hover:bg-cms-chip`}>
                Siguiente
              </Link>
            ) : (
              <span aria-disabled="true" className={`${pageLink} border-cms-line-soft text-cms-muted opacity-60`}>
                Siguiente
              </span>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
