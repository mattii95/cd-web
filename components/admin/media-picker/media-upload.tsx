"use client";

import { useActionState, useId } from "react";
import {
  type PickerItem,
  type PickerUploadState,
  uploadPickerMediaAction,
} from "@/actions/admin/media";
import { Spinner } from "@/components/icons";

const field =
  "min-h-12 w-full rounded-xl border border-cms-control bg-cms-panel px-3.5 py-3 text-[15px] text-cms-ink placeholder:text-cms-muted";
const label = "text-sm font-semibold text-cms-ink";
const hint = "text-[13px] text-cms-muted";

// Mismos campos y límites que el modal de subida de Medios, pero con un archivo. Al subir, avisa al selector con el item.
export function MediaUpload({
  onUploaded,
}: {
  onUploaded: (item: PickerItem, message: string) => void;
}) {
  const id = useId();
  const [state, action, pending] = useActionState<PickerUploadState, FormData>(
    async (prev, data) => {
      const next = await uploadPickerMediaAction(prev, data);
      if (next.status === "success") onUploaded(next.item, next.message);
      return next;
    },
    { status: "idle" },
  );
  return (
    <form action={action} className="mx-auto flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-file`} className={label}>
          Imagen
        </label>
        <input
          id={`${id}-file`}
          type="file"
          name="file"
          required
          accept="image/jpeg,image/png,image/webp,image/avif"
          aria-describedby={`${id}-file-hint`}
          className={`${field} cursor-pointer font-normal text-cms-text file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`}
        />
        <span id={`${id}-file-hint`} className={hint}>
          JPEG, PNG, WebP o AVIF. Hasta 10 MB.
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-alt`} className={label}>
          Texto alternativo
        </label>
        <input
          id={`${id}-alt`}
          type="text"
          name="alt"
          required
          maxLength={300}
          placeholder="Qué se ve en la imagen"
          aria-describedby={`${id}-alt-hint`}
          className={field}
        />
        <span id={`${id}-alt-hint`} className={hint}>
          Lo leen los lectores de pantalla.
        </span>
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 self-start rounded-full border-0 bg-accent px-6 text-base font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
      >
        {pending && <Spinner />}
        {pending ? "Subiendo…" : "Subir imagen"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="m-0 text-sm font-semibold text-red-700">
          {state.message}
        </p>
      )}
    </form>
  );
}
