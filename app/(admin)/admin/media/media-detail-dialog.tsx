"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState, useTransition } from "react";
import { deleteMediaAction, updateMediaAction } from "@/actions/admin/media";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { describedBy, Field, fieldInput } from "@/components/admin/form-dialog";
import { notify } from "@/components/admin/toast";
import { ArrowLeft, ArrowRight, Close, Spinner } from "@/components/icons";
import { parseMediaForm } from "@/lib/admin/media-form";
import type { CardItem } from "./card-item";
import { btn, btnDanger, btnPrimary, iconBtn } from "./styles";

type Props = {
  items: CardItem[]; // las cargadas en la grilla, con la búsqueda y el filtro aplicados
  id: string; // la imagen abierta
  onNavigate: (id: string) => void;
  onClose: () => void;
  onSaved: (id: string, changes: { alt: string; originalName: string }) => void;
  onDeleted: (id: string) => void;
};

type Errors = Partial<Record<"alt" | "originalName", string>>;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] font-semibold text-cms-muted">{label}</dt>
      <dd className="m-0 text-[15px] text-cms-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

// <dialog> nativo montado solo mientras está abierto, como FormDialog: el foco vuelve a la miniatura que lo abrió.
export function MediaDetailDialog({ items, id, onNavigate, onClose, onSaved, onDeleted }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [said, setSaid] = useState("");

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setSaid(""), 2000);
    return () => clearTimeout(t);
  }, [said]);

  const index = items.findIndex((i) => i.id === id);
  const item = items[index];
  if (!item) return null;

  const inUse = item.usage.length > 0;
  const titles = [...new Set(item.usage.map((u) => u.title))];
  const canNavigate = !editing && !confirming && !pending;
  const go = (delta: number) => {
    const next = items[index + delta];
    if (next) onNavigate(next.id);
  };

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSaid(message);
    } catch {
      // Sin permiso de portapapeles no hace nada.
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!canNavigate || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
    go(e.key === "ArrowLeft" ? -1 : 1);
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("id", item.id);
    const parsed = parseMediaForm(data);
    if (!parsed.ok) {
      const { alt, originalName } = parsed.fieldErrors;
      setErrors({ alt, originalName });
      document.getElementById(alt ? "media-alt" : "media-name")?.focus();
      return;
    }
    setErrors({});
    start(async () => {
      const next = await updateMediaAction({ status: "idle" }, data);
      if (next.status === "success") {
        notify(next);
        onSaved(item.id, parsed.input);
        setEditing(false);
      } else if (next.status === "error") {
        if (next.fieldErrors) setErrors(next.fieldErrors);
        if (next.message) notify({ status: "error", message: next.message });
      }
    });
  }

  const remove = () =>
    start(async () => {
      const data = new FormData();
      data.set("id", item.id);
      const next = await deleteMediaAction({ status: "idle" }, data);
      notify(next);
      setConfirming(false);
      if (next.status === "success") onDeleted(item.id);
    });

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape: el estado manda, así que se frena el cierre nativo; mientras guarda o borra no cierra.
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      onKeyDown={onKeyDown}
      className="m-auto flex max-h-[calc(100dvh-2rem)] w-[min(1040px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-cms-line bg-cms-panel p-0 text-cms-ink shadow-[0_24px_64px_rgba(11,16,32,0.35)] backdrop:bg-[rgba(11,16,32,0.6)] max-md:h-dvh max-md:max-h-none max-md:w-dvw max-md:max-w-none max-md:rounded-none max-md:border-0"
    >
      <header className="flex items-start justify-between gap-4 border-b border-cms-line-soft px-6 py-4">
        <h2 id={titleId} className="m-0 min-w-0 font-display text-xl font-bold [overflow-wrap:anywhere]">
          {item.alt}
        </h2>
        <button type="button" aria-label="Cerrar" disabled={pending} onClick={onClose} className={iconBtn}>
          <Close />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-h-64 items-center justify-center bg-cms-head p-4">
          <Image
            src={item.src}
            width={item.width}
            height={item.height}
            alt=""
            sizes="(min-width: 768px) 620px, 100vw"
            className="h-auto max-h-[70dvh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between gap-2">
            <button type="button" aria-label="Imagen anterior" disabled={!canNavigate || index === 0} onClick={() => go(-1)} className={iconBtn}>
              <ArrowLeft />
            </button>
            <span className="text-sm text-cms-text">
              {index + 1} de {items.length}
            </span>
            <button type="button" aria-label="Imagen siguiente" disabled={!canNavigate || index === items.length - 1} onClick={() => go(1)} className={iconBtn}>
              <ArrowRight />
            </button>
          </div>

          {editing ? (
            <form noValidate onSubmit={save} className="flex flex-col gap-4">
              <Field id="media-alt" label="Texto alternativo" error={errors.alt}>
                <input
                  id="media-alt"
                  name="alt"
                  defaultValue={item.alt}
                  autoFocus
                  aria-invalid={!!errors.alt}
                  aria-describedby={describedBy("media-alt", { error: errors.alt })}
                  className={fieldInput}
                />
              </Field>
              <Field id="media-name" label="Nombre del archivo" error={errors.originalName}>
                <input
                  id="media-name"
                  name="originalName"
                  defaultValue={item.originalName}
                  aria-invalid={!!errors.originalName}
                  aria-describedby={describedBy("media-name", { error: errors.originalName })}
                  className={fieldInput}
                />
              </Field>
              {inUse && (
                <p className="m-0 text-sm text-cms-text">
                  Esta imagen está en uso en: {titles.join(", ")}. El texto alternativo nuevo se ve en esos artículos
                  donde la imagen no tiene uno propio.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={btnPrimary}>
                  {pending && <Spinner />}
                  {pending ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" disabled={pending} onClick={() => { setEditing(false); setErrors({}); }} className={btn}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="m-0 flex flex-col gap-3">
                <Row label="Texto alternativo">{item.alt}</Row>
                <Row label="Nombre del archivo">{item.originalName}</Row>
                <Row label="Medidas">
                  {item.width} × {item.height} px
                </Row>
                <Row label="Peso">{Math.max(1, Math.round(item.bytes / 1024))} KB</Row>
                <Row label="Fecha de subida">{item.date}</Row>
              </dl>

              <section aria-labelledby={`${titleId}-uso`} className="flex flex-col gap-1">
                <h3 id={`${titleId}-uso`} className="m-0 text-[13px] font-semibold text-cms-muted">
                  En uso en
                </h3>
                {inUse ? (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {item.usage.map((u) => (
                      <li key={`${u.postId}-${u.as}`}>
                        <Link
                          href={`/admin/articles/${u.postId}/edit`}
                          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-cms-link underline-offset-2 hover:underline"
                        >
                          {u.title} · {u.as}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 text-[15px] text-cms-muted">Sin usar</p>
                )}
              </section>

              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(true)} className={btn}>
                    Editar
                  </button>
                  <button type="button" onClick={() => copy(`${location.origin}${item.src}`, "URL copiada")} className={btn}>
                    Copiar URL
                  </button>
                  <button type="button" onClick={() => copy(item.id, "Id copiado")} className={btn}>
                    Copiar id
                  </button>
                  <a href={item.src} target="_blank" rel="noopener" className={btn}>
                    Abrir original
                  </a>
                  <button
                    type="button"
                    disabled={inUse}
                    aria-describedby={inUse ? hintId : undefined}
                    onClick={() => setConfirming(true)}
                    className={btnDanger}
                  >
                    Borrar
                  </button>
                </div>
                {inUse && (
                  <p id={hintId} className="m-0 text-sm text-cms-text">
                    Está en uso: quitala de esos artículos para borrarla.
                  </p>
                )}
                <p role="status" className={said ? "m-0 text-[13px] font-semibold text-cms-link" : "sr-only"}>
                  {said}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="¿Borrar la imagen?"
        description="Se borra el archivo y no se puede deshacer."
        confirmLabel="Borrar"
        pendingLabel="Borrando…"
        tone="danger"
        pending={pending}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </dialog>
  );
}
