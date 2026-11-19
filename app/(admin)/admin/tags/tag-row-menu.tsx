"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteTagAction } from "@/actions/admin/tags";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { notify } from "@/components/admin/toast";
import { Pencil, Trash } from "@/components/icons";
import type { AdminTagRow } from "@/db/admin-tags";
import { MergeTagDialog } from "./merge-tag-dialog";
import { TagDialog } from "./tag-dialog";

type Kind = "edit" | "merge" | "delete";
const idle = { status: "idle" } as const;

const item =
  "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-cms-ink hover:bg-cms-chip";

export function TagRowMenu({ tag }: { tag: AdminTagRow }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const choose = (k: Kind) => {
    // El foco vuelve al botón antes de desmontar el menú: el modal lo recuerda y lo restaura al cerrar.
    trigger.current?.focus();
    setMenuOpen(false);
    setKind(k);
  };
  const close = () => setKind(null);

  const confirmDelete = () =>
    start(async () => {
      const data = new FormData();
      data.set("id", tag.id);
      notify(await deleteTagAction(idle, data));
      close();
    });

  return (
    <div ref={root} className="relative inline-block">
      <button
        ref={trigger}
        type="button"
        aria-label={`Más acciones: ${tag.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-cms-line bg-cms-chip text-cms-ink transition-colors hover:border-cms-link"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-cms-line bg-cms-panel p-1 shadow-[0_12px_32px_rgba(11,16,32,0.18)]"
        >
          <button type="button" role="menuitem" onClick={() => choose("edit")} className={item}>
            <Pencil /> Editar
          </button>
          <button type="button" role="menuitem" onClick={() => choose("merge")} className={item}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 3v6a6 6 0 006 6 6 6 0 016 6M18 3v6a6 6 0 01-6 6" />
            </svg>
            Fusionar con…
          </button>
          <button type="button" role="menuitem" onClick={() => choose("delete")} className={`${item} text-red-700`}>
            <Trash /> Borrar
          </button>
        </div>
      )}
      {kind === "edit" && <TagDialog tag={tag} onClose={close} />}
      {kind === "merge" && <MergeTagDialog source={tag} onClose={close} />}
      <ConfirmDialog
        open={kind === "delete"}
        title={`¿Borrar la etiqueta «${tag.name}»?`}
        description={`${
          tag.total > 0 ? `Se quita de ${tag.total} artículos.` : "No está en ningún artículo."
        } No se puede deshacer.`}
        confirmLabel="Borrar"
        pendingLabel="Borrando…"
        tone="danger"
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => {
          close();
          trigger.current?.focus();
        }}
      />
    </div>
  );
}
