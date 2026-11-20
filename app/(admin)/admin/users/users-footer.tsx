import Link from "next/link";
import type { AdminUserList } from "@/db/admin-users";
import { type AdminUserQuery, USERS_PER_PAGE, userQueryHref } from "@/lib/admin/user-params";

const pageLink =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition-colors";

export function UsersFooter({ query, list }: { query: AdminUserQuery; list: AdminUserList }) {
  const { page, pageCount, total, items } = list;
  const from = (page - 1) * USERS_PER_PAGE + 1;
  const to = from + items.length - 1;
  const at = (n: number) => userQueryHref({ ...query, page: n });

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
