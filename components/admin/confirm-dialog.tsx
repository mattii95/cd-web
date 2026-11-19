"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { Spinner } from "@/components/icons";

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  tone?: "default" | "danger";
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

// <dialog> nativo: el navegador atrapa el foco, pone el fondo inerte y lo devuelve al botón que lo abrió.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  tone = "default",
  pending,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      // Escape: el estado `open` manda, así que se frena el cierre nativo; mientras corre la acción no cierra.
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-cms-line bg-cms-panel p-0 text-cms-ink shadow-[0_24px_64px_rgba(11,16,32,0.35)] backdrop:bg-[rgba(11,16,32,0.6)]"
    >
      <div className="flex flex-col gap-2 p-6">
        <h2 id={titleId} className="m-0 font-display text-xl font-bold text-cms-ink">
          {title}
        </h2>
        <p id={descId} className="m-0 text-[15px] leading-relaxed text-cms-text [overflow-wrap:anywhere]">
          {description}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            autoFocus
            disabled={pending}
            onClick={onCancel}
            className={`${btn} border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-chip`}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`${btn} ${
              tone === "danger"
                ? "border-red-700 bg-red-700 text-white hover:bg-red-800"
                : "border-accent bg-accent text-white hover:bg-accent-hover"
            }`}
          >
            {pending && <Spinner />}
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
