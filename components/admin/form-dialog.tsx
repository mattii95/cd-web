"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useRef } from "react";
import { Spinner } from "@/components/icons";

// Clases compartidas por los formularios de los modales del panel.
export const fieldInput =
  "min-h-11 w-full rounded-xl border border-cms-control bg-cms-panel px-3.5 text-[15px] text-cms-ink placeholder:text-cms-muted read-only:bg-cms-panel-alt aria-invalid:border-red-700";
export const fieldLabel = "text-sm font-semibold text-cms-ink";
const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
};

// Etiqueta, control y mensajes. El control referencia `${id}-error` y `${id}-hint` con aria-describedby.
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="m-0 text-sm text-cms-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="m-0 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const describedBy = (id: string, o: { error?: string; hint?: unknown }) =>
  [o.error && `${id}-error`, o.hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;

type Props = {
  title: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  submitDisabled?: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
};

// <dialog> nativo montado solo mientras está abierto: cada apertura empieza con el formulario limpio.
// Por debajo de `md` ocupa la pantalla entera. El foco vuelve al botón que lo abrió.
export function FormDialog({
  title,
  submitLabel,
  pendingLabel,
  pending,
  submitDisabled,
  onSubmit,
  onClose,
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => opener?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!pending) onSubmit();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape: el estado manda, así que se frena el cierre nativo; mientras guarda no cierra.
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      className="m-auto flex max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-cms-line bg-cms-panel p-0 text-cms-ink shadow-[0_24px_64px_rgba(11,16,32,0.35)] backdrop:bg-[rgba(11,16,32,0.6)] max-md:h-dvh max-md:max-h-none max-md:w-dvw max-md:max-w-none max-md:rounded-none max-md:border-0"
    >
      <form noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <h2 id={titleId} className="m-0 px-6 pt-6 font-display text-xl font-bold text-cms-ink">
          {title}
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-cms-line-soft px-6 py-4">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className={`${btn} border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-chip`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending || submitDisabled}
            className={`${btn} border-accent bg-accent text-white hover:bg-accent-hover`}
          >
            {pending && <Spinner />}
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
