import Link from "next/link";
import { type AdminPostQuery, articlesHref } from "@/lib/admin/article-params";

type Counts = { all: number; publicado: number; borrador: number };

export function StatusTabs({ query, counts }: { query: AdminPostQuery; counts: Counts }) {
  const tabs = [
    { label: "Todos", status: null, n: counts.all },
    { label: "Publicados", status: "published", n: counts.publicado },
    { label: "Borradores", status: "draft", n: counts.borrador },
  ] as const;
  return (
    <nav aria-label="Estado de los artículos" className="flex gap-1 overflow-x-auto border-b border-cms-line px-3">
      {tabs.map((t) => {
        const active = query.status === t.status;
        return (
          <Link
            key={t.label}
            href={articlesHref(query, { status: t.status })}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
              active
                ? "border-cms-link text-cms-link"
                : "border-transparent text-cms-text hover:text-cms-ink"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-cms-chip px-2 py-0.5 text-xs font-semibold text-cms-text">{t.n}</span>
          </Link>
        );
      })}
    </nav>
  );
}
