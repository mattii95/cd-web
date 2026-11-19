"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PickerItem } from "@/actions/admin/media";
import { Close } from "@/components/icons";
import { MediaLibrary } from "./media-library";
import { MediaUpload } from "./media-upload";

export type MediaPickerMode = "cover" | "body";

type Props = {
  open: boolean;
  mode: MediaPickerMode;
  selectedId?: string | null; // portada actual en modo cover
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
};

const COPY = {
  cover: { title: "Elegir portada", action: "Usar como portada" },
  body: { title: "Insertar imagen", action: "Insertar" },
} as const;

const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

type Tab = "library" | "upload";

// <dialog> nativo, como ConfirmDialog: foco atrapado, fondo inerte, Escape cierra y el foco vuelve al botón que lo abrió.
export function MediaPicker({ open, mode, selectedId = null, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none flex-col overflow-hidden border-0 bg-cms-panel p-0 text-cms-ink open:flex sm:m-auto sm:h-[min(46rem,calc(100dvh-4rem))] sm:w-[min(60rem,calc(100vw-2rem))] sm:rounded-2xl sm:border sm:border-cms-line sm:shadow-[0_24px_64px_rgba(11,16,32,0.35)] backdrop:bg-[rgba(11,16,32,0.6)]"
    >
      {/* El contenido solo existe abierto: cada apertura empieza en Biblioteca, sin búsqueda ni selección vieja. */}
      {open && (
        <PickerBody
          mode={mode}
          initialSelectedId={selectedId}
          titleId={titleId}
          onSelect={onSelect}
          onClose={onClose}
        />
      )}
    </dialog>
  );
}

function PickerBody({
  mode,
  initialSelectedId,
  titleId,
  onSelect,
  onClose,
}: {
  mode: MediaPickerMode;
  initialSelectedId: string | null;
  titleId: string;
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("library");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [known, setKnown] = useState<Record<string, PickerItem>>({});
  const [pinned, setPinned] = useState<PickerItem | null>(null);
  const [status, setStatus] = useState("");
  const copy = COPY[mode];
  const selected = selectedId ? known[selectedId] : undefined;

  // Estable: la biblioteca lo tiene como dependencia de su efecto de carga.
  const remember = useCallback(
    (items: PickerItem[]) =>
      setKnown((prev) => ({ ...prev, ...Object.fromEntries(items.map((i) => [i.id, i])) })),
    [],
  );

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      id={`picker-tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`picker-panel-${id}`}
      tabIndex={tab === id ? 0 : -1}
      onClick={() => setTab(id)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          setTab(id === "library" ? "upload" : "library");
          document.getElementById(`picker-tab-${id === "library" ? "upload" : "library"}`)?.focus();
        }
      }}
      className={`min-h-11 cursor-pointer border-0 border-b-[3px] bg-transparent px-4 text-[15px] font-semibold transition-colors ${
        tab === id
          ? "border-accent text-cms-ink"
          : "border-transparent text-cms-muted hover:text-cms-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-cms-line-soft px-5 pt-4 sm:px-6">
        <h2 id={titleId} className="m-0 pb-3 font-display text-xl font-bold text-cms-ink">
          {copy.title}
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="mb-3 flex size-11 cursor-pointer items-center justify-center rounded-full border border-cms-line bg-cms-panel text-cms-ink hover:bg-cms-chip"
        >
          <Close />
        </button>
      </header>
      <div role="tablist" aria-label="Origen de la imagen" className="flex gap-1 border-b border-cms-line-soft bg-cms-panel-alt px-3 sm:px-5">
        {tabBtn("library", "Biblioteca")}
        {tabBtn("upload", "Subir imagen")}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
        {/* Región viva siempre montada: el aviso se anuncia aunque cambie la pestaña. */}
        <p role="status" aria-live="polite" className={status ? "mb-4 text-sm font-semibold text-cms-link" : "sr-only"}>
          {status}
        </p>
        {tab === "library" ? (
          <div role="tabpanel" id="picker-panel-library" aria-labelledby="picker-tab-library">
            <MediaLibrary
              selectedId={selectedId}
              pinned={pinned}
              onLoaded={remember}
              onPick={(item, confirm) => {
                remember([item]);
                setSelectedId(item.id);
                if (confirm) onSelect(item);
              }}
              onGoUpload={() => setTab("upload")}
            />
          </div>
        ) : (
          <div role="tabpanel" id="picker-panel-upload" aria-labelledby="picker-tab-upload">
            <MediaUpload
              onUploaded={(item, message) => {
                remember([item]);
                setPinned(item);
                setSelectedId(item.id);
                setStatus(message);
                setTab("library");
              }}
            />
          </div>
        )}
      </div>

      <footer className="flex flex-wrap justify-end gap-2 border-t border-cms-line-soft bg-cms-panel px-5 py-4 sm:px-6">
        <button type="button" onClick={onClose} className={`${btn} border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-chip`}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          className={`${btn} border-accent bg-accent text-white hover:bg-accent-hover`}
        >
          {copy.action}
        </button>
      </footer>
    </>
  );
}
