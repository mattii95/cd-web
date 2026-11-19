"use client";

import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import { uploadMediaAction } from "@/actions/admin/media";
import { Close, Spinner } from "@/components/icons";
import { checkUploadFile, MEDIA_FORM_LIMITS, UPLOAD_LIMITS } from "@/lib/admin/media-form";
import { btn } from "./styles";

type Status = "pending" | "uploading" | "done" | "duplicate" | "error";
type Row = {
  key: number;
  file: File;
  alt: string;
  preview: string;
  invalid: string | null; // chequeo del cliente: la fila no se sube
  status: Status;
  message: string; // el mensaje de la action cuando falló
};

const DUPLICATE = "Esa imagen ya estaba subida."; // lo que devuelve uploadMediaAction
const FAILED = "No pudimos subir la imagen. Intentá de nuevo en unos minutos.";
const LIMIT_NOTE = `Podés subir hasta ${UPLOAD_LIMITS.maxFiles} imágenes a la vez.`;
const primary = `${btn} border-accent bg-accent text-white hover:bg-accent-hover disabled:hover:bg-accent`;

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;
const plural = (n: number) => (n === 1 ? "1 imagen" : `${n} imágenes`);

// <dialog> nativo montado solo mientras está abierto, como FormDialog: cada apertura empieza con la cola vacía.
export function UploadDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const nextKey = useRef(0);
  const previews = useRef(new Set<string>());
  const [rows, setRows] = useState<Row[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  const queue = rows.filter((r) => r.status === "pending" && !r.invalid);
  // Sin subir = lo que todavía se puede subir: pendientes y con error. Los de formato o tamaño no cuentan.
  const unsent = queue.length + rows.filter((r) => r.status === "error").length;
  const counts = {
    done: rows.filter((r) => r.status === "done").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    error: rows.filter((r) => r.status === "error").length,
  };
  const finished = !uploading && queue.length === 0 && counts.done + counts.duplicate + counts.error > 0;
  const summary = finished
    ? [
        counts.done && `Se subieron ${counts.done}.`,
        counts.duplicate && `${counts.duplicate} ya estaban.`,
        counts.error && `${counts.error} con error.`,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const patch = (key: number, over: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...over } : r)));

  function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    const room = UPLOAD_LIMITS.maxFiles - rows.length;
    if (files.length > room) setNotice(true);
    const added = files.slice(0, Math.max(room, 0)).map((file): Row => {
      const preview = URL.createObjectURL(file);
      previews.current.add(preview);
      return { key: nextKey.current++, file, alt: "", preview, invalid: checkUploadFile(file), status: "pending", message: "" };
    });
    if (added.length) setRows((prev) => [...prev, ...added]);
  }

  function remove(row: Row) {
    URL.revokeObjectURL(row.preview);
    previews.current.delete(row.preview);
    setRows((prev) => prev.filter((r) => r.key !== row.key));
    setNotice(false);
  }

  async function send(row: Row) {
    patch(row.key, { status: "uploading", message: "" });
    const data = new FormData();
    data.set("file", row.file);
    data.set("alt", row.alt.trim());
    try {
      const r = await uploadMediaAction({ status: "idle" }, data);
      if (r.status === "success") patch(row.key, { status: r.message === DUPLICATE ? "duplicate" : "done" });
      else patch(row.key, { status: "error", message: r.status === "error" ? r.message : FAILED });
    } catch {
      patch(row.key, { status: "error", message: FAILED });
    }
  }

  // De a un archivo y en orden: uno que falla no frena a los demás.
  async function sendAll() {
    setUploading(true);
    for (const row of queue) await send(row);
    setUploading(false);
  }

  function requestClose() {
    if (uploading) return;
    if (unsent > 0) setConfirming(true);
    else onClose();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!uploading) addFiles(e.dataTransfer.files);
  }

  const missingAlt = queue.some((r) => !r.alt.trim());

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape: el estado manda. Con la confirmación abierta equivale a "Seguir editando".
      onCancel={(e) => {
        e.preventDefault();
        if (confirming) setConfirming(false);
        else requestClose();
      }}
      className="m-auto flex max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-cms-line bg-cms-panel p-0 text-cms-ink shadow-[0_24px_64px_rgba(11,16,32,0.35)] backdrop:bg-[rgba(11,16,32,0.6)] max-md:h-dvh max-md:max-h-none max-md:w-dvw max-md:max-w-none max-md:rounded-none max-md:border-0"
    >
      <header className="flex items-start justify-between gap-4 border-b border-cms-line-soft px-6 py-4">
        <h2 id={titleId} className="m-0 font-display text-xl font-bold">
          Subir imágenes
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          disabled={uploading}
          onClick={requestClose}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cms-control bg-cms-panel text-cms-ink transition-colors hover:bg-cms-chip disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Close />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center ${
            dragging ? "border-cms-link bg-cms-chip" : "border-cms-control bg-cms-panel-alt"
          }`}
        >
          <p className="m-0 text-[15px] text-cms-text">Arrastrá imágenes acá o elegí archivos</p>
          <label
            className={`${btn} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cms-link ${
              uploading ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Elegir archivos
            <input
              type="file"
              multiple
              accept={UPLOAD_LIMITS.types.join(",")}
              disabled={uploading}
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = ""; // permite elegir el mismo archivo otra vez
              }}
            />
          </label>
          <p className="m-0 text-[13px] text-cms-muted">JPEG, PNG, WebP o AVIF. Hasta 10 MB cada una.</p>
          {notice && (
            <p role="status" className="m-0 text-sm font-semibold text-red-700">
              {LIMIT_NOTE}
            </p>
          )}
        </div>

        {rows.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {rows.map((row) => {
              const locked = uploading || row.status === "done" || row.status === "duplicate";
              return (
                <li key={row.key} className="flex gap-3 rounded-xl border border-cms-line bg-cms-panel p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.preview} alt="" className="size-16 shrink-0 rounded-lg bg-cms-head object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="m-0 text-sm text-cms-ink [overflow-wrap:anywhere]">
                      <span className="font-semibold">{row.file.name}</span>{" "}
                      <span className="text-cms-muted">{kb(row.file.size)}</span>
                    </p>
                    {row.invalid ? (
                      <p className="m-0 text-sm font-medium text-red-700">{row.invalid}</p>
                    ) : (
                      <input
                        type="text"
                        aria-label={`Texto alternativo de ${row.file.name}`}
                        placeholder="Qué se ve en la imagen"
                        maxLength={MEDIA_FORM_LIMITS.alt}
                        value={row.alt}
                        disabled={locked}
                        onChange={(e) => patch(row.key, { alt: e.target.value })}
                        className="min-h-11 w-full rounded-lg border border-cms-control bg-cms-panel px-3 text-sm text-cms-ink disabled:bg-cms-panel-alt"
                      />
                    )}
                    {row.status === "uploading" && (
                      <p className="m-0 flex items-center gap-2 text-sm text-cms-text">
                        <Spinner /> Subiendo…
                      </p>
                    )}
                    {row.status === "done" && <p className="m-0 text-sm font-semibold text-cms-link">Subida.</p>}
                    {row.status === "duplicate" && <p className="m-0 text-sm text-cms-text">{DUPLICATE}</p>}
                    {row.status === "error" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 text-sm font-medium text-red-700">{row.message}</p>
                        <button type="button" disabled={uploading} onClick={() => send(row)} className={btn}>
                          Reintentar
                        </button>
                      </div>
                    )}
                  </div>
                  {(row.status === "pending" || row.status === "error") && (
                    <button
                      type="button"
                      aria-label={`Quitar ${row.file.name}`}
                      disabled={uploading}
                      onClick={() => remove(row)}
                      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cms-control bg-cms-panel text-cms-ink transition-colors hover:bg-cms-chip disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Close />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p role="status" className={summary ? "m-0 text-sm font-semibold text-cms-ink" : "sr-only"}>
          {summary}
        </p>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-cms-line-soft px-6 py-4">
        {confirming ? (
          <>
            <p role="status" className="m-0 mr-auto text-sm font-semibold text-cms-ink">
              {unsent === 1
                ? "Tenés 1 imagen sin subir. ¿Descartarla?"
                : `Tenés ${unsent} imágenes sin subir. ¿Descartarlas?`}
            </p>
            <button type="button" onClick={onClose} className={`${btn} border-red-700 bg-red-700 text-white hover:bg-red-800`}>
              Descartar
            </button>
            <button ref={keepRef} type="button" onClick={() => setConfirming(false)} className={btn}>
              Seguir editando
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={uploading} onClick={requestClose} className={btn}>
              Cancelar
            </button>
            {finished ? (
              <button type="button" onClick={requestClose} className={primary}>
                Listo
              </button>
            ) : (
              <button
                type="button"
                disabled={uploading || queue.length === 0 || missingAlt}
                onClick={sendAll}
                className={primary}
              >
                {uploading && <Spinner />}
                {uploading ? "Subiendo…" : `Subir ${plural(queue.length)}`}
              </button>
            )}
          </>
        )}
      </footer>
    </dialog>
  );
}
