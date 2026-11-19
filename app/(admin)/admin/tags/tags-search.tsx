"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "@/components/icons";
import { type AdminTagQuery, tagQueryHref } from "@/lib/admin/tag-params";

export function TagsSearch({ query }: { query: AdminTagQuery }) {
  const router = useRouter();
  const [text, setText] = useState(query.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typing = useRef(false); // hay una búsqueda escrita que todavía no llegó a la URL
  useEffect(() => () => clearTimeout(timer.current), []);

  // "Limpiar búsqueda" (un enlace) vacía la URL: el campo la sigue, salvo que se esté escribiendo.
  useEffect(() => {
    if (query.q === null && !typing.current) setText("");
  }, [query.q]);

  return (
    <div className="flex flex-col gap-1 border-b border-cms-line bg-cms-panel-alt px-4 py-3">
      <label htmlFor="tag-search" className="text-xs font-semibold text-cms-text">
        Buscar etiquetas
      </label>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-cms-muted" />
        <input
          id="tag-search"
          type="search"
          value={text}
          maxLength={100}
          placeholder="Nombre o URL"
          onChange={(e) => {
            setText(e.target.value);
            clearTimeout(timer.current);
            typing.current = true;
            // Cada búsqueda nueva vuelve a la página 1.
            timer.current = setTimeout(() => {
              typing.current = false;
              router.replace(tagQueryHref({ q: e.target.value.trim() || null, page: 1 }), { scroll: false });
            }, 300);
          }}
          className="min-h-11 w-full rounded-lg border border-cms-control bg-cms-panel pr-3 pl-10 text-sm text-cms-ink"
        />
      </div>
    </div>
  );
}
