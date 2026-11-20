import Link from "next/link";
import { UserAvatar } from "@/components/auth/user-avatar";
import type { AdminCommentRow, CommentStatus } from "@/db/admin-comments";
import { avatarSrc } from "@/lib/auth/avatar";
import { formatDate } from "@/lib/format-date";

const BADGE: Record<CommentStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-900" },
  aprobado: { label: "Aprobado", className: "bg-emerald-100 text-emerald-900" },
  oculto: { label: "Oculto", className: "bg-cms-chip text-cms-text" },
};

export function CommentCard({ comment: c }: { comment: AdminCommentRow }) {
  const badge = BADGE[c.status];
  return (
    <article className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-full bg-cms-chip text-sm font-bold text-cms-ink"
          >
            <UserAvatar name={c.author.name} image={avatarSrc(c.author.image)} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-cms-ink [overflow-wrap:anywhere]">
              {c.author.name}
            </span>
            <span className="block text-sm text-cms-muted [overflow-wrap:anywhere]">
              {c.author.email}
            </span>
          </span>
        </div>
        <span
          className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </header>

      <p className="m-0 text-sm text-cms-text [overflow-wrap:anywhere]">
        {c.post.published ? (
          <Link
            href={`/blog/${c.post.slug}#valoraciones`}
            target="_blank"
            rel="noopener"
            className="font-semibold text-cms-link underline-offset-2 hover:underline"
          >
            {c.post.title}
          </Link>
        ) : (
          <>
            <span className="font-semibold text-cms-ink">{c.post.title}</span>{" "}
            <span className="ml-1 rounded-full bg-cms-chip px-2 py-0.5 text-xs font-semibold text-cms-text">
              Artículo no publicado
            </span>
          </>
        )}
        <span className="text-cms-muted"> · {formatDate(c.createdAt)}</span>
      </p>

      <p className="m-0 max-w-[75ch] text-base whitespace-pre-line text-cms-ink [overflow-wrap:anywhere]">
        {c.text}
      </p>

      {c.usefulCount > 0 && (
        <p className="m-0 text-sm font-semibold text-cms-text">Útil · {c.usefulCount}</p>
      )}

      {c.reply && (
        <div className="rounded-lg border border-cms-line-soft bg-cms-panel-alt px-4 py-3">
          <p className="m-0 text-sm font-semibold text-cms-ink">
            Respuesta del autor
            <span className="font-normal text-cms-muted"> · {formatDate(c.reply.repliedAt)}</span>
          </p>
          <p className="m-0 mt-1 text-sm whitespace-pre-line text-cms-text [overflow-wrap:anywhere]">
            {c.reply.text}
          </p>
        </div>
      )}
    </article>
  );
}
