"use client";

import { useState } from "react";
import { Spinner } from "@/components/icons";
import { notify } from "@/components/admin/toast";
import { loadMoreMediaAction } from "@/actions/admin/media";
import type { CardItem } from "./card-item";
import { MediaCard } from "./media-card";
import { btn } from "./styles";

type Props = {
  initialItems: CardItem[];
  initialCursor: string | null;
  initialTotal: number;
};

const loadError = {
  status: "error",
  message: "No pudimos cargar más imágenes.",
} as const;

export function MediaGrid({
  initialItems,
  initialCursor,
  initialTotal,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const result = await loadMoreMediaAction(cursor);
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

  if (items.length === 0 && !cursor) {
    return (
      <p className="m-0 text-base text-cms-text">
        Todavía no hay imágenes. Subí la primera con el formulario.
      </p>
    );
  }

  return (
    <>
      <p className="m-0 text-base text-cms-text">
        {total === 1 ? "1 imagen" : `${total} imágenes`}
      </p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 p-0">
        {items.map(({ date, ...item }) => (
          <MediaCard
            key={item.id}
            item={item}
            date={date}
            onDeleted={() => {
              setItems((prev) => prev.filter((i) => i.id !== item.id));
              setTotal((n) => n - 1);
            }}
            onAltSaved={(alt) =>
              setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, alt } : i)),
              )
            }
          />
        ))}
      </ul>
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
