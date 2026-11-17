"use client";

import Link from "next/link";
import { useState } from "react";
import { loadMoreCommentsAction } from "@/app/(site)/blog/actions";
import {
  createCommentAction,
  deleteCommentAction,
  rateAction,
} from "@/app/(site)/blog/community-actions";
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
  viewer,
}: {
  postId: string;
  slug: string;
  author: PostAuthor; // firma las respuestas
  summary: RatingSummary;
  initialComments: PublicComment[]; // los 20 más recientes
  initialCursor: string | null;
  viewer: ViewerState | null; // null sin sesión
}) {
  const [comments, setComments] = useState(initialComments);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [rating, setRating] = useState(viewer?.rating ?? null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(viewer?.pending ?? []);
  const [ownIds, setOwnIds] = useState(viewer?.ownCommentIds ?? []);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const say = (key: string, message: string) =>
    setMsgs((prev) => ({ ...prev, [key]: message }));
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

  async function rate(n: BlogRating) {
    if (n === rating) return;
    const previous = rating;
    setRating(n);
    say("rate", "");
    try {
      const result = await rateAction(postId, n);
      if (result.status === "error") {
        setRating(previous);
        say("rate", result.message);
      }
    } catch {
      setRating(previous);
      say("rate", "No pudimos guardar tu valoración.");
    }
  }

  async function publish() {
    if (sending || text.trim().length < 2) return;
    setSending(true);
    say("form", "");
    try {
      const result = await createCommentAction(postId, text);
      if (result.status === "success") {
        setPending((prev) => [result.comment, ...prev]);
        setText("");
        say("form", "Tu comentario quedó en revisión.");
      } else {
        say("form", result.message);
      }
    } catch {
      say("form", "No pudimos publicar tu comentario.");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    say(id, "");
    try {
      const result = await deleteCommentAction(id);
      if (result.status === "success") {
        setPending((prev) => prev.filter((c) => c.id !== id));
        setComments((prev) => prev.filter((c) => c.id !== id));
        setOwnIds((prev) => prev.filter((x) => x !== id));
      } else {
        say(id, result.message);
      }
    } catch {
      say(id, "No pudimos borrar el comentario.");
    }
    setConfirming(null);
  }

  const rows = [
    ...pending.map((c) => ({ c, inReview: true })),
    ...comments.map((c) => ({ c, inReview: false })),
  ];

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
        {viewer ? (
          <>
            <div className="relative flex w-full max-w-[560px] flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <strong className="font-display text-xl">Tu opinión</strong>
                <span className="text-[15px] leading-normal text-text-muted">
                  Puntuá el artículo y contanos qué te pareció.
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span id="tu-valoracion" className="text-sm font-semibold">
                  Tu valoración
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="tu-valoracion"
                  className="-ml-1 flex"
                >
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                      onClick={() => rate(n)}
                      className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-[28px] leading-none transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        rating !== null && n <= rating
                          ? "text-accent [text-shadow:0_0_10px_rgba(77,139,255,0.6)]"
                          : "text-white/25"
                      }`}
                    >
                      <span aria-hidden="true">★</span>
                    </button>
                  ))}
                </div>
                <p
                  role="status"
                  className="m-0 min-h-5 text-sm text-text-muted"
                >
                  {msgs.rate}
                </p>
              </div>
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  publish();
                }}
              >
                <textarea
                  aria-label="Escribí un comentario"
                  placeholder="Escribí un comentario"
                  rows={4}
                  maxLength={2000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full resize-y rounded-2xl border border-white/20 bg-white/8 px-4 py-3 text-[15px] leading-normal text-white placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button
                    type="submit"
                    disabled={sending || text.trim().length < 2}
                    className="fx-btn inline-flex min-h-12 cursor-pointer items-center rounded-full border-0 bg-accent px-[22px] py-[13px] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Publicar
                  </button>
                  <span className="text-[13px] text-text-muted">
                    {text.length}/2000
                  </span>
                  <p role="status" className="m-0 text-sm text-text-muted">
                    {msgs.form}
                  </p>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <h3 className="m-0 mt-2 font-display text-[22px] font-semibold">
        Comentarios
      </h3>

      {rows.length === 0 ? (
        <p className="m-0 text-base text-text-faint">
          Todavía no hay comentarios
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {rows.map(({ c, inReview }, i) => {
            const isLiked = !!liked[c.id];
            const own = inReview || ownIds.includes(c.id);
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
                    {inReview && (
                      <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-semibold text-[#1450c8]">
                        En revisión
                      </span>
                    )}
                  </div>
                  <p className="m-0 text-[15px] leading-[1.65] text-[#2b3449]">
                    {c.text}
                  </p>
                  <div className="-ml-2.5 flex flex-wrap items-center gap-1">
                    {!inReview && (
                      <>
                        <button
                          type="button"
                          aria-pressed={isLiked}
                          onClick={() =>
                            setLiked({ ...liked, [c.id]: !isLiked })
                          }
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
                      </>
                    )}
                    {own &&
                      (confirming === c.id ? (
                        <span
                          role="group"
                          aria-label="Confirmar borrado"
                          className="flex flex-wrap items-center gap-1 pl-2.5 text-[13px] text-[#2b3449]"
                        >
                          ¿Borrar comentario?
                          <button
                            type="button"
                            onClick={() => remove(c.id)}
                            className="inline-flex min-h-10 cursor-pointer items-center rounded-full border-0 bg-[#050b1c] px-3 py-2 text-[13px] font-semibold text-white"
                          >
                            Sí, borrar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="inline-flex min-h-10 cursor-pointer items-center rounded-full border-0 bg-transparent px-3 py-2 text-[13px] font-semibold text-text-faint"
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            say(c.id, "");
                            setConfirming(c.id);
                          }}
                          className="inline-flex min-h-10 cursor-pointer items-center rounded-full border-0 bg-transparent px-3 py-2 text-[13px] font-semibold text-text-faint"
                        >
                          Borrar
                        </button>
                      ))}
                  </div>
                  {msgs[c.id] && (
                    <p role="status" className="m-0 text-[13px] text-[#2b3449]">
                      {msgs[c.id]}
                    </p>
                  )}
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
