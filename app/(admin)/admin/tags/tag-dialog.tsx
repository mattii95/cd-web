"use client";

import { useState, useTransition } from "react";
import { saveTagAction } from "@/actions/admin/tags";
import { describedBy, Field, FormDialog, fieldInput } from "@/components/admin/form-dialog";
import { notify } from "@/components/admin/toast";
import type { AdminTagRow } from "@/db/admin-tags";
import { parseTagForm, TAXONOMY_LIMITS, type TagInput } from "@/lib/admin/taxonomy-form";
import { slugify } from "@/lib/slug";

type Errors = Partial<Record<keyof TagInput, string>>;
const FIELD_ORDER = ["name", "slug"] as const;
const fieldId = (f: string) => `tag-${f}`;
const idle = { status: "idle" } as const;

// tag null = crear. Solo se monta abierto: cada apertura parte del estado guardado.
export function TagDialog({ tag, onClose }: { tag: AdminTagRow | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [name, setName] = useState(tag?.name ?? "");
  const [slug, setSlug] = useState(tag?.slug ?? "");
  // La URL sigue al nombre mientras coincidan; editarla a mano corta el seguimiento.
  const [slugTouched, setSlugTouched] = useState(tag ? tag.slug !== slugify(tag.name) : false);

  const locked = (tag?.published ?? 0) > 0;
  const slugHint = locked ? "La URL no cambia porque la etiqueta tiene artículos publicados." : undefined;
  const err = (f: keyof TagInput) => errors[f];

  const focusFirst = (found: Errors) => {
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) document.getElementById(fieldId(first))?.focus();
  };

  const submit = () => {
    const data = new FormData();
    data.set("id", tag?.id ?? "");
    data.set("name", name);
    data.set("slug", slug);
    const parsed = parseTagForm(data);
    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      focusFirst(parsed.fieldErrors);
      return;
    }
    setErrors({});
    start(async () => {
      const res = await saveTagAction(idle, data);
      if (res.status === "error") {
        const found = res.fieldErrors ?? {};
        setErrors(found);
        focusFirst(found);
        if (res.message) notify({ status: "error", message: res.message });
        return;
      }
      if (res.status !== "success") return;
      notify(res);
      onClose();
    });
  };

  return (
    <FormDialog
      title={tag ? "Editar etiqueta" : "Nueva etiqueta"}
      submitLabel={tag ? "Guardar cambios" : "Crear etiqueta"}
      pendingLabel="Guardando…"
      pending={pending}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field id={fieldId("name")} label="Nombre" error={err("name")}>
        <input
          id={fieldId("name")}
          type="text"
          value={name}
          maxLength={TAXONOMY_LIMITS.tagName}
          aria-invalid={err("name") ? true : undefined}
          aria-describedby={describedBy(fieldId("name"), { error: err("name") })}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value;
            setName(v);
            if (!slugTouched && !locked) setSlug(slugify(v));
          }}
          className={fieldInput}
        />
      </Field>

      <Field id={fieldId("slug")} label="URL" error={err("slug")} hint={slugHint}>
        <div
          className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-cms-control bg-cms-panel focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent data-[invalid=true]:border-red-700"
          data-invalid={err("slug") ? true : undefined}
        >
          <span className="flex items-center bg-cms-panel-alt px-3 font-mono text-sm text-cms-muted" aria-hidden="true">
            /blog?etiqueta=
          </span>
          <input
            id={fieldId("slug")}
            type="text"
            value={slug}
            readOnly={locked}
            maxLength={TAXONOMY_LIMITS.slug}
            aria-invalid={err("slug") ? true : undefined}
            aria-describedby={describedBy(fieldId("slug"), { error: err("slug"), hint: slugHint })}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-3 text-[15px] text-cms-ink outline-none read-only:bg-cms-panel-alt"
          />
        </div>
      </Field>
    </FormDialog>
  );
}

// El botón de la cabecera: abre el modal en modo "crear".
export function NewTagButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-accent bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Nueva etiqueta
      </button>
      {open && <TagDialog tag={null} onClose={() => setOpen(false)} />}
    </>
  );
}
