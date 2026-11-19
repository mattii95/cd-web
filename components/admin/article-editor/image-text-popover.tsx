"use client";

import { type FormEvent, type RefObject, useEffect, useId, useRef, useState } from "react";
import { ARTICLE_LIMITS } from "@/lib/admin/article-form";

export type ImageTextKind = "alt" | "caption";

type Props = {
  kind: ImageTextKind;
  value: string | null; // el texto propio de la imagen, o null si usa el de Medios / no tiene pie
  mediaAlt: string; // alt de Medios, para la ayuda
  toolbar: RefObject<HTMLElement | null>; // los botones de la barra no cuentan como "clic fuera"
  onApply: (value: string | null) => void;
  onClose: () => void; // Escape o clic fuera; quien llama devuelve el foco a la imagen
};

const COPY = {
  alt: { label: "Texto alternativo", reset: "Usar el de Medios" },
  caption: { label: "Pie de foto", reset: "Quitar pie" },
} as const;

const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors";

// Mismo comportamiento que LinkPopover: foco en el input, Escape cierra, clic fuera cierra.
export function ImageTextPopover({ kind, value, mediaAlt, toolbar, onApply, onClose }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(value ?? "");
  const copy = COPY[kind];

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !toolbar.current?.contains(t)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [toolbar, onClose]);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    onApply(text.trim() || null);
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={copy.label}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="absolute top-16 right-3 left-3 z-30 max-w-sm rounded-xl border border-cms-line bg-cms-panel p-4 shadow-[0_12px_32px_rgba(11,16,32,0.18)]"
    >
      <form onSubmit={apply} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-text`} className="text-sm font-semibold text-cms-ink">
            {copy.label}
          </label>
          <input
            ref={inputRef}
            id={`${id}-text`}
            type="text"
            autoComplete="off"
            maxLength={ARTICLE_LIMITS.imageText}
            value={text}
            aria-describedby={kind === "alt" ? `${id}-help` : undefined}
            onChange={(e) => setText(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-cms-control bg-cms-panel px-3 text-[15px] text-cms-ink"
          />
          {kind === "alt" && (
            <p id={`${id}-help`} className="m-0 text-[13px] leading-snug text-cms-muted [overflow-wrap:anywhere]">
              Si lo dejás vacío se usa el de Medios: «{mediaAlt}».
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onApply(null)}
            className={`${btn} border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-chip`}
          >
            {copy.reset}
          </button>
          <button type="submit" className={`${btn} border-accent bg-accent text-white hover:bg-accent-hover`}>
            Aplicar
          </button>
        </div>
      </form>
    </div>
  );
}
