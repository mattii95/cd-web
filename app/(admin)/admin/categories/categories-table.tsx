"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { deleteCategoryAction, moveCategoryAction } from "@/actions/admin/categories";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { notify } from "@/components/admin/toast";
import { categoryIcons, Pencil, Trash } from "@/components/icons";
import type { AdminCategoryRow } from "@/db/admin-categories";
import { services } from "@/lib/services";
import { CategoryDialog } from "./category-dialog";
import { CategoryOrderButtons, moveButtonId } from "./category-order-buttons";

// En móvil cada fila se apila y cada celda muestra su columna con data-label.
const cell =
  "block px-0 py-1 before:mr-2 before:font-normal before:text-cms-muted before:content-[attr(data-label)':'] md:table-cell md:px-5 md:py-3.5 md:align-top md:before:content-none";
const action =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-cms-control bg-cms-panel px-4 text-sm font-semibold text-cms-ink transition-colors hover:bg-cms-chip disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cms-panel";

const idle = { status: "idle" } as const;
const serviceTitle = (slug: string) => services.find((s) => s.slug === slug)?.title ?? slug;

function RowActions({ category }: { category: AdminCategoryRow }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, start] = useTransition();
  const noteId = useId();
  const deleteRef = useRef<HTMLButtonElement>(null);
  const inUse = category.total > 0;

  const confirmDelete = () =>
    start(async () => {
      const data = new FormData();
      data.set("id", category.id);
      notify(await deleteCategoryAction(idle, data));
      setDeleting(false);
    });

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-label={`Editar ${category.label}`} onClick={() => setEditing(true)} className={action}>
          <Pencil /> Editar
        </button>
        <button
          ref={deleteRef}
          type="button"
          aria-label={`Borrar ${category.label}`}
          aria-describedby={inUse ? noteId : undefined}
          disabled={inUse}
          onClick={() => setDeleting(true)}
          className={`${action} text-red-700`}
        >
          <Trash /> Borrar
        </button>
      </div>
      {inUse && (
        <p id={noteId} className="m-0 max-w-[30ch] text-sm text-cms-muted">
          Tiene {category.total} artículos. Movelos a otra categoría para borrarla.
        </p>
      )}
      {editing && <CategoryDialog category={category} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={deleting}
        title={`¿Borrar la categoría «${category.label}»?`}
        description="No se puede deshacer."
        confirmLabel="Borrar"
        pendingLabel="Borrando…"
        tone="danger"
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

export function CategoriesTable({ items }: { items: AdminCategoryRow[] }) {
  const [busy, startMove] = useTransition();
  const [announcement, setAnnouncement] = useState("");
  // Qué botón recupera el foco cuando llega el orden nuevo desde el servidor.
  const refocus = useRef<{ id: string; direction: "up" | "down" } | null>(null);

  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const index = items.findIndex((c) => c.id === target.id);
    // Si el botón quedó deshabilitado (extremo de la lista), el foco pasa al otro.
    const direction =
      (target.direction === "up" && index === 0) || (target.direction === "down" && index === items.length - 1)
        ? target.direction === "up"
          ? "down"
          : "up"
        : target.direction;
    document.getElementById(moveButtonId(target.id, direction))?.focus();
  }, [items]);

  const move = (c: AdminCategoryRow, direction: "up" | "down") =>
    startMove(async () => {
      const data = new FormData();
      data.set("id", c.id);
      data.set("direction", direction);
      const res = await moveCategoryAction(idle, data);
      if (res.status === "success") {
        refocus.current = { id: c.id, direction };
        setAnnouncement(`${c.label} quedó en la posición ${res.position}.`);
      } else {
        notify(res);
      }
    });

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <table aria-label="Listado de categorías" className="block w-full border-collapse text-left text-[15px] md:table">
        <thead className="sr-only md:not-sr-only md:table-header-group">
          <tr className="border-b border-cms-line bg-cms-head text-xs tracking-wide text-cms-text">
            <th scope="col" className="px-5 py-3 font-semibold uppercase">Orden</th>
            <th scope="col" className="px-5 py-3 font-semibold uppercase">Categoría</th>
            <th scope="col" className="px-5 py-3 font-semibold uppercase">Slug</th>
            <th scope="col" className="px-5 py-3 font-semibold uppercase">Servicio del CTA</th>
            <th scope="col" className="px-5 py-3 font-semibold uppercase">Artículos</th>
            <th scope="col" className="px-5 py-3 font-semibold uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {items.map((c, i) => {
            const { Icon, label: iconName } = categoryIcons[c.icon];
            return (
              <tr
                key={c.id}
                className="block border-b border-cms-line-soft px-5 py-4 last:border-b-0 md:table-row md:px-0 md:py-0"
              >
                <td data-label="Orden" className={cell}>
                  <CategoryOrderButtons
                    id={c.id}
                    label={c.label}
                    position={i + 1}
                    isFirst={i === 0}
                    isLast={i === items.length - 1}
                    busy={busy}
                    onMove={(d) => move(c, d)}
                  />
                </td>
                <td data-label="Categoría" className={`${cell} min-w-0 md:max-w-xs`}>
                  <span className="flex items-center gap-3">
                    <span
                      role="img"
                      aria-label={`Ícono ${iconName}`}
                      className="flex size-9 flex-none items-center justify-center rounded-lg bg-accent text-white"
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 font-semibold text-cms-ink [overflow-wrap:break-word]">{c.label}</span>
                  </span>
                </td>
                <td data-label="Slug" className={`${cell} font-mono text-sm text-cms-text [overflow-wrap:break-word]`}>
                  {c.slug}
                </td>
                <td data-label="Servicio del CTA" className={`${cell} text-cms-text`}>{serviceTitle(c.serviceSlug)}</td>
                <td data-label="Artículos" className={`${cell} text-cms-text`}>
                  {c.published} publicados · {c.total} en total
                </td>
                <td data-label="Acciones" className={cell}>
                  <RowActions category={c} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
