"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { deleteCommentAsAdminAction } from "@/actions/admin/comments";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { notify } from "@/components/admin/toast";
import type { AdminCommentRow } from "@/db/admin-comments";

const item =
  "flex min-h-11 w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm font-semibold no-underline hover:bg-cms-chip";

// "Se borran el comentario, su respuesta y sus 3 votos." Solo nombra lo que existe.
function deleteDescription({ reply, usefulCount }: AdminCommentRow): string {
  const parts = ["el comentario"];
  if (reply) parts.push("su respuesta");
  if (usefulCount > 0) parts.push(usefulCount === 1 ? "su voto" : `sus ${usefulCount} votos`);
  if (parts.length === 1) return "Se borra el comentario. No se puede deshacer.";
  const last = parts.pop();
  return `Se borran ${parts.join(", ")} y ${last}. No se puede deshacer.`;
}

export function CommentRowMenu({ comment }: { comment: AdminCommentRow }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const askDelete = () => {
    // El foco vuelve al botón antes de desmontar el menú: el modal lo recuerda y lo restaura al cerrar.
    trigger.current?.focus();
    setMenuOpen(false);
    setDeleting(true);
  };
  const cancel = () => {
    setDeleting(false);
    trigger.current?.focus();
  };

  // Confirmar corre la action; el resultado sale en el aviso y el diálogo se cierra.
  const confirm = () =>
    start(async () => {
      const data = new FormData();
      data.set("id", comment.id);
      notify(await deleteCommentAsAdminAction({ status: "idle" }, data));
      setDeleting(false);
    });

  return (
    <div ref={root} className="relative inline-block">
      <button
        ref={trigger}
        type="button"
        aria-label={`Más acciones: ${comment.author.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-busy={pending || undefined}
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
          className="absolute right-0 bottom-full z-20 mb-1 w-52 rounded-xl border border-cms-line bg-cms-panel p-1 shadow-[0_12px_32px_rgba(11,16,32,0.18)]"
        >
          <Link
            role="menuitem"
            href={`/admin/users?q=${encodeURIComponent(comment.author.email)}`}
            className={`${item} text-cms-ink`}
          >
            Ver usuario
          </Link>
          <button type="button" role="menuitem" onClick={askDelete} className={`${item} text-red-800`}>
            Borrar
          </button>
        </div>
      )}
      <ConfirmDialog
        open={deleting}
        tone="danger"
        title={`¿Borrar el comentario de ${comment.author.name}?`}
        description={deleteDescription(comment)}
        confirmLabel="Borrar"
        pendingLabel="Borrando…"
        pending={pending}
        onConfirm={confirm}
        onCancel={cancel}
      />
    </div>
  );
}
