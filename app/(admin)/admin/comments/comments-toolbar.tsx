"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "@/components/icons";
import {
  type AdminCommentQuery,
  COMMENT_QUERY_MAX,
  commentQueryHref,
} from "@/lib/admin/comment-params";

const control = "min-h-11 w-full rounded-lg border border-cms-control bg-cms-panel text-sm text-cms-ink";
const label = "text-xs font-semibold text-cms-text";

export function CommentsToolbar({
  query,
  posts,
}: {
  query: AdminCommentQuery;
  posts: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [text, setText] = useState(query.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typing = useRef(false); // hay una búsqueda escrita que todavía no llegó a la URL
  useEffect(() => () => clearTimeout(timer.current), []);

  // "Limpiar filtros" (un enlace) vacía la URL: el campo la sigue, salvo que se esté escribiendo.
  useEffect(() => {
    if (query.q === null && !typing.current) setText("");
  }, [query.q]);

  // Cada búsqueda o filtro nuevo vuelve a la página 1.
  const go = (next: Partial<AdminCommentQuery>) =>
    router.replace(commentQueryHref({ ...query, ...next, page: 1 }), { scroll: false });

  return (
    <div className="grid gap-3 border-b border-cms-line bg-cms-panel-alt px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
      <div className="flex flex-col gap-1">
        <label htmlFor="comment-search" className={label}>
          Buscar en el texto, nombre o email
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-cms-muted" />
          <input
            id="comment-search"
            type="search"
            value={text}
            maxLength={COMMENT_QUERY_MAX}
            onChange={(e) => {
              const value = e.target.value;
              setText(value);
              clearTimeout(timer.current);
              typing.current = true;
              timer.current = setTimeout(() => {
                typing.current = false;
                go({ q: value.trim() || null });
              }, 300);
            }}
            className={`${control} pr-3 pl-10`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="comment-post" className={label}>
          Artículo
        </label>
        <select
          id="comment-post"
          value={query.articulo ?? ""}
          onChange={(e) => go({ articulo: e.target.value || null })}
          className={`${control} px-3`}
        >
          <option value="">Todos los artículos</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
