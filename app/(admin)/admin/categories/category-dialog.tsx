"use client";

import { useRef, useState, useTransition } from "react";
import { saveCategoryAction } from "@/actions/admin/categories";
import { describedBy, Field, FormDialog, fieldInput, fieldLabel } from "@/components/admin/form-dialog";
import { notify } from "@/components/admin/toast";
import { categoryIcons } from "@/components/icons";
import type { AdminCategoryRow } from "@/db/admin-categories";
import {
  type CategoryInput,
  parseCategoryForm,
  TAXONOMY_LIMITS,
} from "@/lib/admin/taxonomy-form";
import { CATEGORY_ICONS, type CategoryIcon } from "@/lib/blog-posts";
import { services } from "@/lib/services";
import { slugify } from "@/lib/slug";

type Errors = Partial<Record<keyof CategoryInput, string>>;
const FIELD_ORDER = ["label", "filterLabel", "slug", "serviceSlug", "icon"] as const;
const fieldId = (f: string) => `category-${f}`;
const idle = { status: "idle" } as const;

// category null = crear. Solo se monta abierto: cada apertura parte del estado guardado.
export function CategoryDialog({
  category,
  onClose,
}: {
  category: AdminCategoryRow | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [label, setLabel] = useState(category?.label ?? "");
  const [filterLabel, setFilterLabel] = useState(category?.filterLabel ?? "");
  // Siguen al nombre mientras coincidan con él; editarlos a mano corta el seguimiento.
  const [filterTouched, setFilterTouched] = useState(category ? category.filterLabel !== category.label : false);
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(category ? category.slug !== slugify(category.label) : false);
  const [serviceSlug, setServiceSlug] = useState<string>(category?.serviceSlug ?? "");
  const [icon, setIcon] = useState<CategoryIcon | "">(category?.icon ?? "");
  const iconRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const locked = (category?.published ?? 0) > 0;

  const buildForm = () => {
    const fd = new FormData();
    fd.set("id", category?.id ?? "");
    fd.set("label", label);
    // El cliente autocompleta el texto del filtro; el servidor lo exige.
    fd.set("filterLabel", filterLabel.trim() ? filterLabel : label);
    fd.set("slug", slug);
    fd.set("serviceSlug", serviceSlug);
    fd.set("icon", icon);
    return fd;
  };

  const focusFirst = (found: Errors) => {
    const first = FIELD_ORDER.find((f) => found[f]);
    if (!first) return;
    // El radiogroup no tiene un único control con id: el foco va a su primera opción.
    if (first === "icon") iconRefs.current[CATEGORY_ICONS[0]]?.focus();
    else document.getElementById(fieldId(first))?.focus();
  };

  const submit = () => {
    const data = buildForm();
    const parsed = parseCategoryForm(data);
    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      focusFirst(parsed.fieldErrors);
      return;
    }
    setErrors({});
    start(async () => {
      const res = await saveCategoryAction(idle, data);
      if (res.status === "error") {
        const found = res.fieldErrors ?? {};
        setErrors(found);
        if (res.fieldErrors) focusFirst(found);
        if (res.message) notify({ status: "error", message: res.message });
        return;
      }
      if (res.status !== "success") return;
      notify(res);
      onClose();
    });
  };

  const err = (f: keyof CategoryInput) => errors[f];
  const slugHint = locked ? "La URL no cambia porque la categoría tiene artículos publicados." : undefined;

  return (
    <FormDialog
      title={category ? "Editar categoría" : "Nueva categoría"}
      submitLabel={category ? "Guardar cambios" : "Crear categoría"}
      pendingLabel="Guardando…"
      pending={pending}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field id={fieldId("label")} label="Nombre" error={err("label")}>
        <input
          id={fieldId("label")}
          type="text"
          value={label}
          maxLength={TAXONOMY_LIMITS.categoryLabel}
          aria-invalid={err("label") ? true : undefined}
          aria-describedby={describedBy(fieldId("label"), { error: err("label") })}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value;
            setLabel(v);
            if (!filterTouched) setFilterLabel(v);
            if (!slugTouched && !locked) setSlug(slugify(v));
          }}
          className={fieldInput}
        />
      </Field>

      <Field id={fieldId("filterLabel")} label="Texto del filtro" error={err("filterLabel")}>
        <input
          id={fieldId("filterLabel")}
          type="text"
          value={filterLabel}
          maxLength={TAXONOMY_LIMITS.categoryLabel}
          aria-invalid={err("filterLabel") ? true : undefined}
          aria-describedby={describedBy(fieldId("filterLabel"), { error: err("filterLabel") })}
          autoComplete="off"
          onChange={(e) => {
            setFilterLabel(e.target.value);
            // Borrarlo entero lo vuelve a enganchar al nombre.
            setFilterTouched(e.target.value !== "");
          }}
          className={fieldInput}
        />
      </Field>

      <Field id={fieldId("slug")} label="URL" error={err("slug")} hint={slugHint}>
        <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-cms-control bg-cms-panel focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent data-[invalid=true]:border-red-700" data-invalid={err("slug") ? true : undefined}>
          <span className="flex items-center bg-cms-panel-alt px-3 font-mono text-sm text-cms-muted" aria-hidden="true">
            /blog?categoria=
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

      <Field id={fieldId("serviceSlug")} label="Servicio del CTA" error={err("serviceSlug")}>
        <select
          id={fieldId("serviceSlug")}
          value={serviceSlug}
          aria-invalid={err("serviceSlug") ? true : undefined}
          aria-describedby={describedBy(fieldId("serviceSlug"), { error: err("serviceSlug") })}
          onChange={(e) => setServiceSlug(e.target.value)}
          className={fieldInput}
        >
          <option value="">Elegí un servicio</option>
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span id={fieldId("icon-label")} className={fieldLabel}>
          Ícono
        </span>
        <div
          role="radiogroup"
          aria-labelledby={fieldId("icon-label")}
          aria-describedby={err("icon") ? `${fieldId("icon")}-error` : undefined}
          aria-invalid={err("icon") ? true : undefined}
          className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3"
        >
          {CATEGORY_ICONS.map((key) => {
            const { Icon, label: name } = categoryIcons[key];
            return (
              <label
                key={key}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-cms-control bg-cms-panel px-3 text-sm font-semibold text-cms-ink transition-colors hover:bg-cms-chip has-[:checked]:border-accent has-[:checked]:bg-cms-chip has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                <input
                  ref={(el) => {
                    iconRefs.current[key] = el;
                  }}
                  type="radio"
                  name="icon"
                  value={key}
                  checked={icon === key}
                  onChange={() => setIcon(key)}
                  className="sr-only"
                />
                <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-accent text-white" aria-hidden="true">
                  <Icon size={18} />
                </span>
                {name}
              </label>
            );
          })}
        </div>
        {err("icon") && (
          <p id={`${fieldId("icon")}-error`} className="m-0 text-sm font-medium text-red-700">
            {err("icon")}
          </p>
        )}
      </div>
    </FormDialog>
  );
}

// El botón de la cabecera: abre el modal en modo "crear".
export function NewCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-accent bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Nueva categoría
      </button>
      {open && <CategoryDialog category={null} onClose={() => setOpen(false)} />}
    </>
  );
}
