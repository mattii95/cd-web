"use client";

import { useState, useTransition } from "react";
import { setCommentStatusAction, undoCommentStatusAction } from "@/actions/admin/comments";
import { notify, notifyWithUndo } from "@/components/admin/toast";
import type { AdminCommentRow } from "@/db/admin-comments";
import { CommentCard } from "./comment-card";

const batchButton =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

// La selección vale solo para esta página: la página la monta con una `key` que cambia
// con la pestaña, el artículo, la búsqueda y la página, y por eso empieza vacía.
export function CommentsList({ items }: { items: AdminCommentRow[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const allSelected = items.length > 0 && items.every((c) => selected.has(c.id));
  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  function undo(items: { id: string; status: AdminCommentRow["status"] }[]) {
    startTransition(async () => notify(await undoCommentStatusAction(items)));
  }

  function setStatus(ids: string[], status: "aprobado" | "oculto") {
    const data = new FormData();
    for (const id of ids) data.append("id", id);
    data.set("status", status);
    setSelected(new Set());
    startTransition(async () => {
      const res = await setCommentStatusAction({ status: "idle" }, data);
      if (res.status === "success" && res.undo?.length) {
        const previous = res.undo;
        notifyWithUndo(res.message, () => undo(previous));
      } else notify(res);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cms-line-soft px-4 py-1 md:px-6">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-cms-text">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? new Set(items.map((c) => c.id)) : new Set())}
            className="size-5 cursor-pointer accent-[var(--color-cms-link)]"
          />
          Seleccionar todos los de esta página
        </label>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-cms-line bg-cms-chip px-4 py-2 md:px-6">
          <p className="m-0 mr-auto text-sm font-semibold text-cms-ink" role="status">
            {selected.size} {selected.size === 1 ? "seleccionado" : "seleccionados"}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus([...selected], "aprobado")}
            className={`${batchButton} border-cms-link bg-cms-link text-white hover:border-cms-ink hover:bg-cms-ink`}
          >
            Aprobar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus([...selected], "oculto")}
            className={`${batchButton} border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-panel-alt`}
          >
            Ocultar
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className={`${batchButton} border-transparent bg-transparent text-cms-link hover:underline`}
          >
            Quitar selección
          </button>
        </div>
      )}

      <div className="divide-y divide-cms-line-soft">
        {items.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            selected={selected.has(c.id)}
            onSelect={(checked) => toggle(c.id, checked)}
            onSetStatus={(status) => setStatus([c.id], status)}
            busy={pending}
          />
        ))}
      </div>
    </div>
  );
}
