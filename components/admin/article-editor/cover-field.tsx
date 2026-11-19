"use client";

import { useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker/media-picker";

export type Cover = { id: string; src: string; alt: string };

const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-chip";

// Bloque "Imagen de portada" del panel. Elegir o quitar solo cambia el formulario: se guarda con el artículo.
export function CoverField({
  cover,
  disabled,
  onChange,
}: {
  cover: Cover | null;
  disabled: boolean;
  onChange: (cover: Cover | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {cover ? (
        <figure className="m-0 flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- /media sirve el WebP ya procesado */}
          <img
            src={cover.src}
            alt=""
            className="aspect-[16/9] w-full rounded-xl border border-cms-line object-cover"
          />
          <figcaption className="text-[13px] leading-snug text-cms-muted [overflow-wrap:anywhere]">
            {cover.alt}
          </figcaption>
        </figure>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-dashed border-cms-control bg-cms-panel-alt text-sm text-cms-muted">
          Sin portada
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {/* Un solo botón para elegir y cambiar: conserva el foco que el selector devuelve al cerrarse. */}
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={btn}>
          {cover ? "Cambiar portada" : "Elegir portada"}
        </button>
        {cover && (
          <button type="button" disabled={disabled} onClick={() => onChange(null)} className={btn}>
            Quitar portada
          </button>
        )}
      </div>
      <MediaPicker
        open={open}
        mode="cover"
        selectedId={cover?.id ?? null}
        onSelect={(item) => {
          onChange({ id: item.id, src: item.src, alt: item.alt });
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
