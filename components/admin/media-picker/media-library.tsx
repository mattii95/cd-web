"use client";

import { useEffect, useRef, useState } from "react";
import { type PickerItem, searchMediaAction } from "@/actions/admin/media";
import { Check, Spinner } from "@/components/icons";

const SEARCH_DELAY_MS = 300;
const SKELETONS = Array.from({ length: 8 }, (_, i) => i);
const LOAD_ERROR = "No pudimos cargar las imágenes.";

type Props = {
  selectedId: string | null;
  pinned: PickerItem | null; // imagen recién subida: va primera aunque no sea la más nueva
  onLoaded: (items: PickerItem[]) => void;
  onPick: (item: PickerItem, confirm: boolean) => void;
  onGoUpload: () => void;
};

type Status = "loading" | "ready" | "error";

const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-cms-control bg-cms-panel px-5 text-sm font-semibold text-cms-ink transition-colors hover:bg-cms-chip disabled:cursor-wait disabled:opacity-60";

export function MediaLibrary({ selectedId, pinned, onLoaded, onPick, onGoUpload }: Props) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [more, setMore] = useState(false);
  const seq = useRef(0);
  const retry = useRef<() => void>(() => {});

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [text]);

  // Primera página: se dispara al montar y cada vez que cambia la búsqueda.
  useEffect(() => {
    const run = () => {
      const mine = ++seq.current;
      setStatus("loading");
      setMore(false);
      searchMediaAction({ query, cursor: null })
        .catch(() => ({ status: "error" as const, message: LOAD_ERROR }))
        .then((res) => {
          if (mine !== seq.current) return; // llegó una búsqueda más nueva
          if (res.status === "error") return setStatus("error");
          setItems(res.items);
          setCursor(res.nextCursor);
          setStatus("ready");
          onLoaded(res.items);
        });
    };
    retry.current = run;
    run();
  }, [query, onLoaded]);

  const loadMore = () => {
    if (!cursor || more) return;
    const mine = ++seq.current;
    setMore(true);
    searchMediaAction({ query, cursor })
      .catch(() => ({ status: "error" as const, message: LOAD_ERROR }))
      .then((res) => {
        if (mine !== seq.current) return;
        setMore(false);
        if (res.status === "error") {
          retry.current = loadMore;
          return setStatus("error");
        }
        setItems((prev) => [...prev, ...res.items]);
        setCursor(res.nextCursor);
        onLoaded(res.items);
      });
  };

  const shown =
    pinned && !query ? [pinned, ...items.filter((i) => i.id !== pinned.id)] : items;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="picker-search" className="text-sm font-semibold text-cms-ink">
          Buscar por texto alternativo o nombre de archivo
        </label>
        <input
          id="picker-search"
          type="search"
          maxLength={100}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-cms-control bg-cms-panel px-3.5 text-[15px] text-cms-ink"
        />
      </div>

      {status === "loading" && shown.length === 0 && (
        <ul aria-busy="true" aria-label="Cargando imágenes" className="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {SKELETONS.map((i) => (
            <li key={i} aria-hidden="true" className="flex flex-col gap-2">
              <div className="aspect-[4/3] rounded-xl bg-cms-head motion-safe:animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-cms-head motion-safe:animate-pulse" />
            </li>
          ))}
        </ul>
      )}

      {status === "error" && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="m-0 text-[15px] font-semibold text-red-700">{LOAD_ERROR}</p>
          <button type="button" className={btn} onClick={() => retry.current()}>
            Reintentar
          </button>
        </div>
      )}

      {status === "ready" && shown.length === 0 && (
        <p className="m-0 text-[15px] text-cms-text">
          {query ? (
            `No hay imágenes que coincidan con «${query}».`
          ) : (
            <>
              Todavía no hay imágenes.{" "}
              <button
                type="button"
                onClick={onGoUpload}
                className="min-h-11 cursor-pointer border-0 bg-transparent p-0 font-semibold text-cms-link underline"
              >
                Subí la primera.
              </button>
            </>
          )}
        </p>
      )}

      {shown.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => {
            const selected = item.id === selectedId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={item.alt}
                  // Ya elegida: Enter (detail 0) o segundo clic confirman, como un doble clic.
                  onClick={(e) => onPick(item, selected && e.detail !== 1)}
                  className="group flex w-full cursor-pointer flex-col gap-2 rounded-xl border-0 bg-transparent p-0 text-left"
                >
                  <span
                    className={`relative block aspect-[4/3] overflow-hidden rounded-xl bg-cms-head ring-offset-2 transition-shadow ${
                      selected
                        ? "ring-[3px] ring-accent"
                        : "ring-1 ring-cms-line group-hover:ring-2 group-hover:ring-cms-control"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.src}
                      alt=""
                      width={item.width}
                      height={item.height}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                    {selected && (
                      <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-accent text-white">
                        <Check />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col px-0.5">
                    <span className="truncate text-[13px] font-semibold text-cms-ink">
                      {item.alt}
                    </span>
                    <span className="text-xs text-cms-muted">
                      {item.width} × {item.height}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {cursor && status !== "error" && (
        <button type="button" onClick={loadMore} disabled={more} className={`${btn} self-center`}>
          {more && <Spinner />}
          {more ? "Cargando…" : "Cargar más"}
        </button>
      )}
    </div>
  );
}
