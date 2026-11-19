"use client";

import { useEffect, useRef, useState } from "react";
import { loadMoreMediaAction } from "@/actions/admin/media";
import { notify } from "@/components/admin/toast";
import { Spinner } from "@/components/icons";
import { type AdminMediaQuery, toUsage } from "@/lib/admin/media-params";
import type { CardItem } from "./card-item";
import { MediaDetailDialog } from "./media-detail-dialog";
import { MediaTile } from "./media-tile";
import { btn } from "./styles";

type Props = {
  initialItems: CardItem[];
  initialCursor: string | null;
  initialTotal: number;
  query: AdminMediaQuery;
};

const loadError = {
  status: "error",
  message: "No pudimos cargar más imágenes.",
} as const;

function emptyText({ q, uso }: AdminMediaQuery) {
  if (q) return `No hay imágenes que coincidan con «${q}».`;
  if (uso === "en-uso") return "No hay imágenes en uso.";
  if (uso === "sin-usar") return "No hay imágenes sin usar.";
  return "Todavía no hay imágenes.";
}

// La página la remonta (key) cuando cambia la búsqueda, el filtro o la primera tanda.
export function MediaGrid({ initialItems, initialCursor, initialTotal, query }: Props) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Tras borrar, el foco va a la miniatura vecina; null = al buscador.
  const focusAfter = useRef<{ id: string | null } | null>(null);

  // Corre cuando la lista ya perdió la imagen borrada.
  useEffect(() => {
    if (!focusAfter.current) return;
    const { id } = focusAfter.current;
    focusAfter.current = null;
    const target = id && document.querySelector<HTMLElement>(`[data-media-id="${id}"]`);
    (target || document.getElementById("media-search"))?.focus();
  }, [items]);

  function onDeleted(id: string) {
    const i = items.findIndex((m) => m.id === id);
    const neighbor = items[i + 1] ?? items[i - 1];
    setItems((prev) => prev.filter((m) => m.id !== id));
    setTotal((n) => n - 1);
    setOpenId(null);
    focusAfter.current = { id: neighbor?.id ?? null };
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const result = await loadMoreMediaAction({
        cursor,
        query: query.q ?? "",
        usage: toUsage(query.uso),
      });
      if (result.status === "success") {
        setItems((prev) => [...prev, ...result.items]);
        setCursor(result.nextCursor);
      } else {
        notify(loadError);
      }
    } catch {
      notify(loadError);
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return <p className="m-0 text-base text-cms-text [overflow-wrap:anywhere]">{emptyText(query)}</p>;
  }

  return (
    <>
      <p className="m-0 text-base text-cms-text">
        {total === 1 ? "1 imagen" : `${total} imágenes`}
      </p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <MediaTile item={item} onOpen={() => setOpenId(item.id)} />
          </li>
        ))}
      </ul>
      {openId && (
        <MediaDetailDialog
          items={items}
          id={openId}
          onNavigate={setOpenId}
          onClose={() => setOpenId(null)}
          onSaved={(id, changes) =>
            setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)))
          }
          onDeleted={onDeleted}
        />
      )}
      {cursor && (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            className={btn}
            disabled={loading}
            aria-busy={loading}
            onClick={loadMore}
          >
            {loading && <Spinner />}
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </>
  );
}
