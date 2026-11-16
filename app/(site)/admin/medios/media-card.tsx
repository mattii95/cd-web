"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/app/cuenta/actions";
import { FormMessage } from "@/components/auth/form-message";
import { deleteMediaAction, updateMediaAltAction } from "./actions";
import type { CardItem } from "./card-item";
import { btn } from "./styles";

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
    <button
      type="button"
      className={btn}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          setCopied(true);
        } catch {
          // Sin permiso de portapapeles el botón no hace nada: el id sigue a la vista en el HTML.
        }
      }}
    >
      <span aria-live="polite">{copied ? "Copiado" : "Copiar id"}</span>
    </button>
  );
}

function AltEditor({ item, onDone }: { item: Item; onDone: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, data) => {
      const next = await updateMediaAltAction(prev, data);
      if (next.status === "success") onDone();
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
        className="fx-input min-h-10 w-full rounded-lg border border-border-strong bg-surface-3 px-3 text-[14px] text-white"
      />
      {state.status === "error" && <FormMessage state={state} />}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={onDone} className={btn}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DeleteControl({ item }: { item: Item }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    deleteMediaAction,
    idle,
  );
  const inUse = item.titles.length > 0;

  return (
    <>
      {confirming ? (
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="id" value={item.id} />
          <span className="text-[13px] text-text">¿Borrar?</span>
          <button type="submit" disabled={pending} className={btn}>
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
          className={btn}
        >
          {inUse ? "En uso" : "Borrar"}
        </button>
      )}
      {state.status === "error" && (
        <div className="basis-full">
          <FormMessage state={state} />
        </div>
      )}
    </>
  );
}

export function MediaCard({ item, date }: { item: Item; date: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col overflow-hidden rounded-[18px] border border-border-muted bg-surface-2">
      <Image
        src={item.src}
        width={item.width}
        height={item.height}
        alt={item.alt}
        sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
        className="aspect-video w-full bg-surface-3 object-cover"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        {editing ? (
          <AltEditor item={item} onDone={() => setEditing(false)} />
        ) : (
          <p className="m-0 text-[15px] leading-snug font-semibold text-text-strong [overflow-wrap:anywhere]">
            {item.alt}
          </p>
        )}
        <p className="m-0 text-[13px] text-text-subtle">
          {item.width} × {item.height} px, {Math.max(1, Math.round(item.bytes / 1024))} KB
          <br />
          {date}
        </p>
        <p
          className={`m-0 pt-1 text-[13px] ${item.titles.length ? "text-accent-soft" : "text-text-subtle"}`}
        >
          {item.titles.length ? `En uso en: ${item.titles.join(", ")}` : "Sin usar"}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <CopyId id={item.id} />
          {!editing && (
            <button type="button" className={btn} onClick={() => setEditing(true)}>
              Editar alt
            </button>
          )}
          <DeleteControl item={item} />
        </div>
      </div>
    </li>
  );
}
