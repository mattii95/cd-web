import Link from "next/link";
import { ArrowUp } from "@/components/icons";
import type { AdminPostRow } from "@/db/admin-posts";
import {
  type AdminPostQuery,
  type ArticleSort,
  articlesHref,
} from "@/lib/admin/article-params";
import { formatDate } from "@/lib/format-date";
import { RowMenu } from "./row-menu";

// En móvil cada fila se apila y cada celda muestra su columna con data-label.
const cell =
  "block px-0 py-1 before:mr-2 before:font-normal before:text-cms-muted before:content-[attr(data-label)':'] md:table-cell md:px-5 md:py-3.5 md:before:content-none";

const SORTABLE: { label: string; sort: ArticleSort; firstDir: "asc" | "desc" }[] = [
  { label: "Título", sort: "title", firstDir: "asc" },
  { label: "Lectura", sort: "readingTime", firstDir: "desc" },
  { label: "Actualizado", sort: "updated", firstDir: "desc" },
];

function SortHeader({ query, col, className }: { query: AdminPostQuery; col: (typeof SORTABLE)[number]; className?: string }) {
  const active = query.sort === col.sort;
  const next = active ? (query.dir === "asc" ? "desc" : "asc") : col.firstDir;
  return (
    <th
      scope="col"
      aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-5 py-1 font-semibold ${className ?? ""}`}
    >
      <Link
        href={articlesHref(query, { sort: col.sort, dir: next })}
        className="inline-flex min-h-11 items-center gap-1.5 uppercase hover:text-cms-link"
      >
        {col.label}
        <ArrowUp
          size={14}
          className={`${active ? "opacity-100" : "opacity-30"} ${active && query.dir === "desc" ? "rotate-180" : ""}`}
        />
      </Link>
    </th>
  );
}

export function ArticlesTable({ query, items }: { query: AdminPostQuery; items: AdminPostRow[] }) {
  const [title, reading, updated] = SORTABLE;
  return (
    <table aria-label="Listado de artículos" className="block w-full border-collapse text-left text-[15px] md:table">
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr className="border-b border-cms-line bg-cms-head text-xs tracking-wide text-cms-text">
          <SortHeader query={query} col={title} />
          <th scope="col" className="px-5 py-3 font-semibold uppercase">Categoría</th>
          <th scope="col" className="px-5 py-3 font-semibold uppercase">Estado</th>
          <SortHeader query={query} col={reading} />
          <SortHeader query={query} col={updated} />
          <th scope="col" className="px-5 py-3 font-semibold uppercase">Acciones</th>
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {items.map((p) => (
          <tr
            key={p.id}
            className="block border-b border-cms-line-soft px-5 py-3 last:border-b-0 md:table-row md:px-0 md:py-0"
          >
            <td data-label="Título" className={`${cell} min-w-0 md:max-w-sm`}>
              <Link
                href={`/admin/articles/${p.id}/edit`}
                className="inline-block min-h-6 font-semibold text-cms-ink underline-offset-2 [overflow-wrap:anywhere] hover:text-cms-link hover:underline"
              >
                {p.title}
              </Link>
              <span className="block text-sm text-cms-muted [overflow-wrap:anywhere]">/blog/{p.slug}</span>
            </td>
            <td data-label="Categoría" className={cell}>
              <span className="inline-block rounded-full bg-cms-chip px-2.5 py-0.5 text-xs font-semibold text-cms-text">
                {p.category.label}
              </span>
            </td>
            <td data-label="Estado" className={cell}>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  p.status === "publicado" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                }`}
              >
                {p.status === "publicado" ? "Publicado" : "Borrador"}
              </span>
            </td>
            <td data-label="Lectura" className={`${cell} text-cms-text`}>{p.readingMinutes} min</td>
            <td data-label="Actualizado" className={`${cell} text-cms-muted`}>{formatDate(p.updatedAt)}</td>
            <td data-label="Acciones" className={cell}>
              <RowMenu id={p.id} slug={p.slug} title={p.title} status={p.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
