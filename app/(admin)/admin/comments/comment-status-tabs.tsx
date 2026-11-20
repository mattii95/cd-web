import Link from "next/link";
import {
  type AdminCommentQuery,
  type CommentStatusFilter,
  commentQueryHref,
} from "@/lib/admin/comment-params";

type Counts = { pendiente: number; aprobado: number; oculto: number };

// Las cantidades respetan el artículo y la búsqueda, no la pestaña.
export function CommentStatusTabs({
  query,
  counts,
}: {
  query: AdminCommentQuery;
  counts: Counts;
}) {
  const tabs: { label: string; estado: CommentStatusFilter; n: number }[] = [
    { label: "Pendientes", estado: "pendientes", n: counts.pendiente },
    { label: "Aprobados", estado: "aprobados", n: counts.aprobado },
    { label: "Ocultos", estado: "ocultos", n: counts.oculto },
    { label: "Todos", estado: "todos", n: counts.pendiente + counts.aprobado + counts.oculto },
  ];
  return (
    <nav
      aria-label="Estado de los comentarios"
      className="flex gap-1 overflow-x-auto border-b border-cms-line px-3"
    >
      {tabs.map((t) => {
        const active = query.estado === t.estado;
        return (
          <Link
            key={t.estado}
            href={commentQueryHref({ ...query, estado: t.estado, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              active
                ? "border-cms-link text-cms-link"
                : "border-transparent text-cms-text hover:text-cms-ink"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-cms-chip px-2 py-0.5 text-xs font-semibold text-cms-text">
              {t.n}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
