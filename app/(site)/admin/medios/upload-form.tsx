"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/cuenta/actions";
import { FormMessage } from "@/components/auth/form-message";
import { uploadMediaAction } from "./actions";

const field =
  "fx-input min-h-[48px] w-full rounded-xl border border-border-strong bg-surface-3 px-3.5 py-3 text-[15px] text-white";

const label = "text-sm font-semibold text-text-strong";
const hint = "text-[13px] text-text-subtle";

// La validación nativa corre en el navegador y Zod la repite en la Server Action.
export function UploadForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    uploadMediaAction,
    { status: "idle" },
  );
  return (
    <form
      action={action}
      className="mt-10 grid gap-5 rounded-[20px] border border-border-muted bg-surface-2 p-6 md:grid-cols-[1fr_1.3fr_auto]"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="media-file" className={label}>
          Imagen
        </label>
        <input
          id="media-file"
          type="file"
          name="file"
          required
          accept="image/jpeg,image/png,image/webp,image/avif"
          aria-describedby="media-file-hint"
          className={`${field} cursor-pointer font-normal text-text file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`}
        />
        <span id="media-file-hint" className={hint}>
          JPEG, PNG, WebP o AVIF. Hasta 10 MB.
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="media-alt" className={label}>
          Texto alternativo
        </label>
        <input
          id="media-alt"
          type="text"
          name="alt"
          required
          maxLength={300}
          placeholder="Qué se ve en la imagen"
          aria-describedby="media-alt-hint"
          className={field}
        />
        <span id="media-alt-hint" className={hint}>
          Lo leen los lectores de pantalla.
        </span>
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="fx-btn min-h-[48px] cursor-pointer rounded-xl border-0 bg-accent px-6 text-base font-semibold text-white disabled:cursor-wait disabled:opacity-70 md:mt-7 md:self-start"
      >
        {pending ? "Subiendo…" : "Subir imagen"}
      </button>
      <div className="md:col-span-3 empty:hidden">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
