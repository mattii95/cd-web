"use client";

import Link from "next/link";
import { useState } from "react";
import { loadMoreCommentsAction } from "@/app/(site)/blog/actions";
import type { PostAuthor, PublicComment, RatingSummary } from "@/db/blog";
import type { ViewerState } from "@/db/blog-community";
import {
  formatAverage,
  formatPostDate,
  type BlogRating,
} from "@/lib/blog-posts";
import { LoadMore } from "./load-more";
import { PersonAvatar } from "./person-avatar";

const avatarColors = ["#1a66f5", "#050b1c", "#1450c8", "#3d5a99"];
const ratings: BlogRating[] = [5, 4, 3, 2, 1];

function Stars({ n, className }: { n: number; className: string }) {
  return (
    <span role="img" aria-label={`${n} de 5 estrellas`} className={className}>
      <span className="text-accent">{"★".repeat(n)}</span>
      <span className="text-[#c9d3e6]">{"★".repeat(5 - n)}</span>
    </span>
  );
}

// Solo el estado sin sesión (spec 03): "Responder" y "Útil" son visuales; "Ingresar" y "Crear cuenta" van a /cuenta (spec 04).
export function ReviewsSection({
  postId,
  slug,
  author,
  summary,
  initialComments,
  initialCursor,
}: {
  postId: string;
  slug: string;
  author: PostAuthor; // firma las respuestas
  summary: RatingSummary;
  initialComments: PublicComment[]; // los 20 más recientes
  initialCursor: string | null;
  viewer: ViewerState | null; // null sin sesión; todavía no se usa (pasos 6 a 8)
}) {
  const [comments, setComments] = useState(initialComments);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const { average, total, distribution } = summary;
  const maxCount = Math.max(...Object.values(distribution), 1);

  const likesOf = (c: PublicComment) => c.usefulCount + (liked[c.id] ? 1 : 0);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const result = await loadMoreCommentsAction(postId, cursor);
      if (result.status === "success") {
        setComments((prev) => [...prev, ...result.items]);
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

  return (
    <section
      id="valoraciones"
      aria-label="Valoraciones y comentarios"
      className="mt-10 flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-[13px] text-accent">
          {"// comunidad"}
        </span>
        <h2 className="m-0 font-display text-[32px] font-bold tracking-[-0.02em]">
          Valoraciones y comentarios
        </h2>
      </div>

      <div className="fx-reveal flex flex-wrap items-center gap-8 rounded-[20px] border border-paper-border bg-white p-7">
        {total === 0 ? (
          <p className="m-0 text-base text-text-faint">
            Todavía no hay valoraciones
          </p>
        ) : (
          <>
            <div className="flex min-w-[150px] flex-col gap-2">
              <span className="font-display text-[60px] leading-none font-bold tracking-[-0.03em]">
                {formatAverage(average)}
              </span>
              <span
                role="img"
                aria-label={`Promedio ${formatAverage(average)} de 5 estrellas`}
                className="text-[22px] tracking-[3px]"
              >
                <span className="text-accent [text-shadow:0_0_10px_rgba(77,139,255,0.6)]">
                  {"★".repeat(Math.round(average))}
                </span>
                <span className="text-[#c9d3e6]">
                  {"★".repeat(5 - Math.round(average))}
                </span>
              </span>
              <span className="text-sm text-text-faint">
                {total} {total === 1 ? "valoración" : "valoraciones"}
              </span>
            </div>
            <div className="flex flex-[1_1_280px] flex-col gap-2.5">
              {ratings.map((n) => (
                <div
                  key={n}
                  className="grid grid-cols-[34px_minmax(0,1fr)_30px] items-center gap-3 text-sm text-[#2b3449]"
                >
                  <span className="font-semibold">{n} ★</span>
                  <span className="h-2 overflow-hidden rounded bg-accent-tint">
                    <span
                      className="block h-full rounded bg-accent shadow-[0_0_10px_rgba(77,139,255,0.7)]"
                      style={{
                        width: `${Math.round((distribution[n] / maxCount) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="text-right text-text-faint">
                    {distribution[n]}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fx-reveal fx-beam relative flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[20px] bg-[#050b1c] p-7 text-white">
        <div
          aria-hidden="true"
          className="fx-orb fx-orb1 -top-35 -right-15 size-[280px] bg-accent/45"
        />
        <div className="relative flex max-w-[440px] flex-col gap-1.5">
          <strong className="font-display text-xl">
            Iniciá sesión para comentar y puntuar
          </strong>
          <span className="text-[15px] leading-normal text-text-muted">
            Tu opinión ayuda a otros lectores y nos dice sobre qué escribir.
          </span>
        </div>
        <div className="relative flex flex-wrap gap-2.5">
          <Link
            href={`/cuenta/login?volver=/blog/${slug}`}
            className="fx-btn inline-flex min-h-12 items-center rounded-full bg-accent px-[22px] py-[13px] text-[15px] font-semibold text-white no-underline"
          >
            Ingresar
          </Link>
          <Link
            href={`/cuenta/registro?volver=/blog/${slug}`}
            className="fx-ghost inline-flex min-h-12 items-center rounded-full border border-white/25 bg-transparent px-[22px] py-[13px] text-[15px] font-semibold text-white no-underline"
          >
            Crear cuenta
          </Link>
        </div>
      </div>

      <h3 className="m-0 mt-2 font-display text-[22px] font-semibold">
        Comentarios
      </h3>

      {comments.length === 0 ? (
        <p className="m-0 text-base text-text-faint">
          Todavía no hay comentarios
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {comments.map((c, i) => {
            const isLiked = !!liked[c.id];
            return (
              <li
                key={c.id}
                className="flex gap-3.5 rounded-[18px] border border-paper-border bg-white px-[22px] py-5"
              >
                <PersonAvatar
                  name={c.authorName}
                  image={c.authorImage}
                  color={avatarColors[i % avatarColors.length]}
                  className="size-10 text-sm"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <strong className="text-[15px]">{c.authorName}</strong>
                    {c.rating !== null && (
                      <Stars n={c.rating} className="text-sm tracking-[2px]" />
                    )}
                    <span className="text-[13px] text-text-faint">
                      {formatPostDate(c.createdAt)}
                    </span>
                  </div>
                  <p className="m-0 text-[15px] leading-[1.65] text-[#2b3449]">
                    {c.text}
                  </p>
                  <div className="-ml-2.5 flex flex-wrap gap-1">
                    <button
                      type="button"
                      aria-pressed={isLiked}
                      onClick={() => setLiked({ ...liked, [c.id]: !isLiked })}
                      className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 py-2 text-[13px] font-semibold ${
                        isLiked
                          ? "bg-accent-tint text-[#1450c8]"
                          : "bg-transparent text-text-faint"
                      }`}
                    >
                      Útil · {likesOf(c)}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-3 py-2 text-[13px] font-semibold text-text-faint"
                    >
                      Responder
                    </button>
                  </div>
                  {c.reply && (
                    <div className="mt-1.5 flex gap-3 rounded-[14px] border border-paper-border bg-paper px-[18px] py-4">
                      <PersonAvatar
                        name={author.name}
                        image={author.image}
                        className="size-[34px] text-xs"
                      />
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <strong className="text-sm">{author.name}</strong>
                          <span className="rounded-full bg-[#050b1c] px-2 py-0.5 text-[11px] font-semibold text-white">
                            Autor
                          </span>
                          <span className="text-[13px] text-text-faint">
                            {formatPostDate(c.reply.repliedAt)}
                          </span>
                        </div>
                        <p className="m-0 text-[15px] leading-[1.6] text-[#2b3449]">
                          {c.reply.text}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cursor && (
        <LoadMore
          label="Ver más comentarios"
          errorMessage="No pudimos cargar más comentarios."
          loading={loading}
          failed={failed}
          onClick={loadMore}
        />
      )}
    </section>
  );
}
