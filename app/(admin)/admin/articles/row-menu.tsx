"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  deletePostAction,
  publishPostAction,
  unpublishPostAction,
} from "@/actions/admin/articles";
import type { FormState } from "@/actions/cuenta";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { notify } from "@/components/admin/toast";
import { ExternalLink, Pencil, Trash } from "@/components/icons";

type Props = { id: string; slug: string; title: string; status: "borrador" | "publicado" };
type Kind = "publish" | "unpublish" | "delete";

const idle: FormState = { status: "idle" };

const DIALOGS: Record<
  Kind,
  {
    action: typeof publishPostAction;
    title: string;
    description: (t: string) => string;
    confirm: string;
    pending: string;
  }
> = {
  publish: {
    action: publishPostAction,
    title: "¿Publicar el artículo?",
    description: (t) => `«${t}» va a aparecer en el blog.`,
    confirm: "Publicar",
    pending: "Publicando…",
  },
  unpublish: {
    action: unpublishPostAction,
    title: "¿Pasar a borrador?",
    description: (t) => `«${t}» deja de verse en el blog. Sus comentarios y valoraciones se conservan.`,
    confirm: "Pasar a borrador",
    pending: "Guardando…",
  },
  delete: {
    action: deletePostAction,
    title: "¿Eliminar el artículo?",
    description: (t) => `Se borra «${t}» con sus valoraciones y comentarios. No se puede deshacer.`,
    confirm: "Eliminar",
    pending: "Eliminando…",
  },
};

const item =
  "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-cms-ink hover:bg-cms-chip";

export function RowMenu({ id, slug, title, status }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Se recuerda la última acción: el modal sigue montado con su texto mientras se cierra.
  const [last, setLast] = useState<Kind>("delete");
  const dialog = DIALOGS[kind ?? last];

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
    setLast(k);
    setKind(k);
  };

  const confirm = () =>
    start(async () => {
      const data = new FormData();
      data.set("id", id);
      notify(await dialog.action(idle, data));
      setKind(null);
    });

  return (
    <div ref={root} className="relative inline-block">
      <button
        ref={trigger}
        type="button"
        aria-label={`Más acciones: ${title}`}
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
          {status === "publicado" && (
            <a
              role="menuitem"
              href={`/blog/${slug}`}
              target="_blank"
              rel="noopener"
              onClick={() => setMenuOpen(false)}
              className={item}
            >
              <ExternalLink /> Ver en el blog
            </a>
          )}
          {status === "borrador" ? (
            <button type="button" role="menuitem" onClick={() => choose("publish")} className={item}>
              <Pencil /> Publicar
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => choose("unpublish")} className={item}>
              <Pencil /> Pasar a borrador
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => choose("delete")}
            className={`${item} text-red-700`}
          >
            <Trash /> Eliminar
          </button>
        </div>
      )}
      <ConfirmDialog
        open={kind !== null}
        title={dialog.title}
        description={dialog.description(title)}
        confirmLabel={dialog.confirm}
        pendingLabel={dialog.pending}
        tone={kind === "delete" ? "danger" : "default"}
        pending={pending}
        onConfirm={confirm}
        onCancel={() => {
          setKind(null);
          trigger.current?.focus();
        }}
      />
    </div>
  );
}
