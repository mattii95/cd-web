"use client";

import Link from "next/link";
import { useState } from "react";
import {
  deleteCommentAction,
  loadMoreUserCommentsAction,
} from "@/app/(site)/blog/community-actions";
import type { UserComment } from "@/db/blog-community";
import { LoadMore } from "@/components/blog/load-more";
import { formatPostDate } from "@/lib/blog-posts";

const BADGE: Record<
  UserComment["status"],
  { label: string; className: string }
> = {
  pendiente: {
    label: "En revisión",
    className: "bg-accent/20 text-accent-pale",
  },
  aprobado: {
    label: "Publicado",
    className: "border border-accent-light/40 text-accent-pale",
  },
  oculto: {
    label: "Oculto",
    className: "border border-border-muted text-text-subtle",
  },
};

const ghost =
  "inline-flex min-h-10 cursor-pointer items-center rounded-full border-0 bg-transparent px-3 py-2 text-[13px] font-semibold text-text-muted hover:text-white";

export function MyComments({
  initialItems,
  initialCursor,
}: {
  initialItems: UserComment[]; // la primera página, la más reciente primero
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const result = await loadMoreUserCommentsAction(cursor);
      if (result.status === "success") {
        setItems((prev) => [...prev, ...result.items]);
        setCursor(result.nextCursor);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    setErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      const result = await deleteCommentAction(id);
      if (result.status === "success") {
        setItems((prev) => prev.filter((c) => c.id !== id));
      } else {
        setErrors((prev) => ({ ...prev, [id]: result.message }));
      }
    } catch {
      setErrors((prev) => ({
        ...prev,
        [id]: "No pudimos borrar el comentario.",
      }));
    }
    setConfirming(null);
  }

  if (items.length === 0 && !cursor) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 text-base text-text-muted">
          Todavía no comentaste ningún artículo.
        </p>
        <Link
          href="/blog"
          className="py-2 text-sm font-semibold text-accent-soft no-underline hover:text-white"
        >
          Ir al blog
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="m-0 list-none divide-y divide-border-muted border-y border-border-muted p-0">
        {items.map((c) => {
          const badge = BADGE[c.status];
          return (
            <li key={c.id} className="flex flex-col gap-3 py-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {c.post.published ? (
                  <Link
                    href={`/blog/${c.post.slug}#valoraciones`}
                    className="font-display text-lg font-semibold text-accent-soft no-underline hover:text-white [overflow-wrap:anywhere]"
                  >
                    {c.post.title}
                  </Link>
                ) : (
                  <span className="font-display text-lg font-semibold [overflow-wrap:anywhere]">
                    {c.post.title}
                  </span>
                )}
                <span className="text-[13px] text-text-subtle">
                  {formatPostDate(c.createdAt)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
              <p className="m-0 max-w-[65ch] text-[15px] leading-[1.65] text-text-strong [overflow-wrap:anywhere]">
                {c.text}
              </p>
              {c.reply && (
                <div className="flex max-w-[65ch] flex-col gap-1.5 rounded-xl border border-border-muted bg-white/5 px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-x-2.5">
                    <strong className="text-sm">Respuesta del autor</strong>
                    <span className="text-[13px] text-text-subtle">
                      {formatPostDate(c.reply.repliedAt)}
                    </span>
                  </div>
                  <p className="m-0 text-[15px] leading-[1.6] text-text-strong [overflow-wrap:anywhere]">
                    {c.reply.text}
                  </p>
                </div>
              )}
              <div className="-ml-3 flex flex-wrap items-center gap-1">
                {confirming === c.id ? (
                  <span
                    role="group"
                    aria-label="Confirmar borrado"
                    className="flex flex-wrap items-center gap-1 pl-3 text-[13px] text-text-muted"
                  >
                    ¿Borrar comentario?
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="inline-flex min-h-10 cursor-pointer items-center rounded-full border-0 bg-accent px-3 py-2 text-[13px] font-semibold text-white"
                    >
                      Sí, borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className={ghost}
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setErrors((prev) => ({ ...prev, [c.id]: "" }));
                      setConfirming(c.id);
                    }}
                    className={ghost}
                  >
                    Borrar
                  </button>
                )}
              </div>
              {errors[c.id] && (
                <p role="status" className="m-0 text-[13px] text-text-muted">
                  {errors[c.id]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {cursor && (
        <LoadMore
          label="Ver más comentarios"
          errorMessage="No pudimos cargar más comentarios."
          loading={loading}
          failed={failed}
          onClick={loadMore}
        />
      )}
    </div>
  );
}
