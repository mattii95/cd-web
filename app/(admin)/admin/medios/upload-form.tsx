"use client";

import { useActionState } from "react";
import type { FormState } from "@/actions/cuenta";
import { Spinner } from "@/components/icons";
import { notify } from "@/components/admin/toast";
import { uploadMediaAction } from "@/actions/admin/medios";

const field =
  "min-h-12 w-full rounded-xl border border-cms-control bg-cms-panel px-3.5 py-3 text-[15px] text-cms-ink placeholder:text-cms-muted";

const label = "text-sm font-semibold text-cms-ink";
const hint = "text-[13px] text-cms-muted";

// La validación nativa corre en el navegador y Zod la repite en la Server Action.
export function UploadForm() {
  // Se avisa dentro de la action y no en un efecto: al volver a la página, React re-ejecuta los
  // efectos de la vista oculta y repetiría el toast del último resultado.
  const [, action, pending] = useActionState<FormState, FormData>(
    async (prev, data) => {
      const next = await uploadMediaAction(prev, data);
      notify(next);
      return next;
    },
    { status: "idle" },
  );
  return (
    <form
      action={action}
      className="grid gap-5 rounded-2xl border border-cms-line bg-cms-panel p-6 shadow-[0_8px_24px_rgba(11,16,32,0.08)] md:grid-cols-[1fr_1.3fr_auto]"
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
          className={`${field} cursor-pointer font-normal text-cms-text file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white`}
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
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-accent px-6 text-base font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70 md:mt-7 md:self-start"
      >
        {pending && <Spinner />}
        {pending ? "Subiendo…" : "Subir imagen"}
      </button>
    </form>
  );
}
