"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "@/components/icons";
import {
  type AdminMediaQuery,
  type MediaUsageFilter,
  mediaQueryHref,
} from "@/lib/admin/media-params";

const SEARCH_DELAY_MS = 300;

const FILTERS: { value: MediaUsageFilter | null; label: string }[] = [
  { value: null, label: "Todas" },
  { value: "en-uso", label: "En uso" },
  { value: "sin-usar", label: "Sin usar" },
];

export function MediaToolbar({ query }: { query: AdminMediaQuery }) {
  const router = useRouter();
  const [text, setText] = useState(query.q ?? "");
  const [uso, setUso] = useState(query.uso);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (next: AdminMediaQuery) =>
    router.replace(mediaQueryHref(next), { scroll: false });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex w-full max-w-md flex-col gap-1">
        <label htmlFor="media-search" className="text-sm font-semibold text-cms-ink">
          Buscar por texto alternativo o nombre de archivo
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-cms-muted" />
          <input
            id="media-search"
            type="search"
            value={text}
            maxLength={100}
            onChange={(e) => {
              const value = e.target.value;
              setText(value);
              clearTimeout(timer.current);
              timer.current = setTimeout(
                () => go({ q: value.trim() || null, uso }),
                SEARCH_DELAY_MS,
              );
            }}
            className="min-h-11 w-full rounded-lg border border-cms-control bg-cms-panel pr-3 pl-10 text-sm text-cms-ink"
          />
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Filtrar por uso"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map(({ value, label }) => (
          <label key={label} className="cursor-pointer">
            <input
              type="radio"
              name="uso"
              checked={uso === value}
              onChange={() => {
                clearTimeout(timer.current); // la búsqueda pendiente viaja con el filtro
                setUso(value);
                go({ q: text.trim() || null, uso: value });
              }}
              className="peer sr-only"
            />
            <span className="inline-flex min-h-11 items-center rounded-full border border-cms-control bg-cms-panel px-4 text-sm font-semibold text-cms-ink transition-colors hover:border-cms-link hover:bg-cms-chip hover:text-cms-link peer-checked:border-cms-ink peer-checked:bg-cms-ink peer-checked:text-white peer-checked:hover:border-cms-ink peer-checked:hover:bg-cms-ink peer-checked:hover:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cms-link">
              {label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
