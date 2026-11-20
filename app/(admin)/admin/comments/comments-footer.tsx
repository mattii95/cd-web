import Link from "next/link";
import type { AdminCommentList } from "@/db/admin-comments";
import {
  type AdminCommentQuery,
  COMMENTS_PER_PAGE,
  commentQueryHref,
} from "@/lib/admin/comment-params";

const pageLink =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition-colors";

export function CommentsFooter({
  query,
  list,
}: {
  query: AdminCommentQuery;
  list: AdminCommentList;
}) {
  const { page, pageCount, total, items } = list;
  const from = (page - 1) * COMMENTS_PER_PAGE + 1;
  const to = from + items.length - 1;
  const at = (n: number) => commentQueryHref({ ...query, page: n });

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-cms-line px-4 py-3">
      <p className="m-0 text-sm text-cms-text">
        Mostrando {from}–{to} de {total}
      </p>
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
  );
}
