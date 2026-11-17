"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/actions/cuenta";
import { notify } from "@/components/admin/toast";
import {
  deleteMediaAction,
  updateMediaAltAction,
} from "@/actions/admin/media";
import type { CardItem } from "./card-item";
import { Copy, Pencil, Spinner, Trash } from "@/components/icons";
import { btn, iconBtnCopy, iconBtnDelete, iconBtnEdit } from "./styles";

type Item = Omit<CardItem, "date">;

const idle: FormState = { status: "idle" };

function CopyId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <>
      <button
        type="button"
        aria-label="Copiar id"
        title="Copiar id"
        className={iconBtnCopy}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
          } catch {
            // Sin permiso de portapapeles el botón no hace nada: el id sigue a la vista en el HTML.
          }
        }}
      >
        <Copy />
      </button>
      <span
        aria-live="polite"
        className={
          copied ? "text-[13px] font-semibold text-cms-link" : "sr-only"
        }
      >
        {copied ? "Copiado" : ""}
      </span>
    </>
  );
}

function AltEditor({
  item,
  onDone,
  onSaved,
}: {
  item: Item;
  onDone: () => void;
  onSaved: (alt: string) => void;
}) {
  const [, action, pending] = useActionState<FormState, FormData>(
    async (prev, data) => {
      const next = await updateMediaAltAction(prev, data);
      notify(next);
      if (next.status === "success") {
        onSaved(String(data.get("alt")).trim());
        onDone();
      }
      return next;
    },
    idle,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={item.id} />
      <input
        type="text"
        name="alt"
        defaultValue={item.alt}
        aria-label="Texto alternativo"
        required
        maxLength={300}
        autoFocus
        className="min-h-11 w-full rounded-lg border border-cms-control bg-cms-panel px-3 text-[14px] text-cms-ink"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending && <Spinner />}
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onDone} className={btn}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DeleteControl({
  item,
  onDeleted,
}: {
  item: Item;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [, action, pending] = useActionState<FormState, FormData>(
    async (prev, data) => {
      const next = await deleteMediaAction(prev, data);
      notify(next);
      if (next.status === "success") onDeleted();
      return next;
    },
    idle,
  );
  const inUse = item.titles.length > 0;

  return (
    <>
      {confirming ? (
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="id" value={item.id} />
          <span className="text-[13px] text-cms-text">¿Borrar?</span>
          <button type="submit" disabled={pending} className={btn}>
            {pending && <Spinner />}
            {pending ? "Borrando…" : "Sí"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={btn}
          >
            No
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={inUse}
          onClick={() => setConfirming(true)}
          aria-label={inUse ? "En uso" : "Borrar"}
          title={inUse ? "En uso: no se puede borrar" : "Borrar"}
          className={iconBtnDelete}
        >
          <Trash />
        </button>
      )}
    </>
  );
}

export function MediaCard({
  item,
  date,
  onDeleted,
  onAltSaved,
}: {
  item: Item;
  date: string;
  onDeleted: () => void;
  onAltSaved: (alt: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-cms-line bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)]">
      <Image
        src={item.src}
        width={item.width}
        height={item.height}
        alt={item.alt}
        sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
        className="aspect-video w-full bg-cms-head object-cover"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        {editing ? (
          <AltEditor
            item={item}
            onDone={() => setEditing(false)}
            onSaved={onAltSaved}
          />
        ) : (
          <p className="m-0 text-[15px] leading-snug font-semibold text-cms-ink [overflow-wrap:anywhere]">
            {item.alt}
          </p>
        )}
        <p className="m-0 text-[13px] text-cms-muted">
          {item.width} × {item.height} px,{" "}
          {Math.max(1, Math.round(item.bytes / 1024))} KB
          <br />
          {date}
        </p>
        <p
          className={`m-0 pt-1 text-[13px] ${item.titles.length ? "text-cms-link" : "text-cms-muted"}`}
        >
          {item.titles.length
            ? `En uso en: ${item.titles.join(", ")}`
            : "Sin usar"}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <CopyId id={item.id} />
          {!editing && (
            <button
              type="button"
              aria-label="Editar alt"
              title="Editar alt"
              className={iconBtnEdit}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </button>
          )}
          <DeleteControl item={item} onDeleted={onDeleted} />
        </div>
      </div>
    </li>
  );
}
