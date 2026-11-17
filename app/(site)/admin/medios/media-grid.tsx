"use client";

import { useState } from "react";
import { FormMessage } from "@/components/auth/form-message";
import { loadMoreMediaAction } from "./actions";
import type { CardItem } from "./card-item";
import { MediaCard } from "./media-card";
import { btn } from "./styles";

type Props = {
  initialItems: CardItem[];
  initialCursor: string | null;
  initialTotal: number;
};

export function MediaGrid({ initialItems, initialCursor, initialTotal }: Props) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const result = await loadMoreMediaAction(cursor);
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

  if (items.length === 0 && !cursor) {
    return (
      <p className="m-0 mt-10 text-base text-text-muted">
        Todavía no hay imágenes. Subí la primera con el formulario.
      </p>
    );
  }

  return (
    <>
      <p className="m-0 mt-10 text-base text-text-muted">
        {total === 1 ? "1 imagen" : `${total} imágenes`}
      </p>
      <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 p-0">
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
        <div className="mt-8 flex flex-col items-center gap-3">
          {failed && (
            <FormMessage
              state={{
                status: "error",
                message: "No pudimos cargar más imágenes.",
              }}
            />
          )}
          <button
            type="button"
            className={btn}
            disabled={loading}
            aria-busy={loading}
            onClick={loadMore}
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </>
  );
}
