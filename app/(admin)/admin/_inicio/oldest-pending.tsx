import Link from "next/link";
import type { PendingPreview } from "@/db/admin-dashboard";
import { formatDate } from "@/lib/format-date";
import { SectionCard, SectionEmpty } from "./section-card";

export function OldestPending({ items }: { items: PendingPreview[] }) {
  return (
    <SectionCard title="Pendientes más viejos" scope="Ahora">
      {items.length === 0 ? (
        <SectionEmpty text="No hay comentarios pendientes." className="h-40" />
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col divide-y divide-cms-line-soft p-0">
            {items.map((c) => (
              <li key={c.id} className="flex min-h-14 flex-col gap-1 py-3 first:pt-0">
                <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-cms-muted">
                  <span>
                    <span className="font-semibold text-cms-ink">{c.author.name}</span> en {c.post.title}
                  </span>
                  <span>{formatDate(c.createdAt)}</span>
                </p>
                {/* Texto plano: React escapa cualquier HTML del comentario. */}
                <p className="m-0 text-[15px] text-cms-text [overflow-wrap:anywhere]">{c.text}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/comments"
            className="inline-flex min-h-11 items-center self-start font-semibold text-cms-link underline-offset-2 hover:underline"
          >
            Ver todos los pendientes
          </Link>
        </>
      )}
    </SectionCard>
  );
}
