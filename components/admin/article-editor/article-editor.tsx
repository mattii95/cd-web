"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useLayoutEffect, useRef, useState, useTransition } from "react";
import { saveArticleAction } from "@/actions/admin/articles";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { notify } from "@/components/admin/toast";
import { ArrowLeft, Spinner } from "@/components/icons";
import type { EditablePost } from "@/db/admin-posts";
import { type BlogDoc, docReadingMinutes } from "@/db/blog-body";
import {
  ARTICLE_LIMITS,
  type ArticleFieldErrors,
  type ArticleIntent,
  EMPTY_DOC,
  parseArticleForm,
} from "@/lib/admin/article-form";
import { formatDate } from "@/lib/format-date";
import { SLUG_MAX, slugify } from "@/lib/slug";
import { BODY_ID, BodyEditor } from "./body-editor";

type Props = {
  post: EditablePost | null; // null en /new
  categories: { id: string; label: string }[];
};

type Saved = {
  id: string | null;
  status: "borrador" | "publicado" | null;
  published: boolean; // alguna vez tuvo published_at: el slug ya no cambia
  updatedAt: string | null; // ISO
  title: string;
};

// Orden en que se busca el primer campo con error (el de la pantalla, de arriba abajo).
const FIELD_ORDER = ["title", "excerpt", "body", "categoryId", "cta", "slug", "tags"] as const;
const fieldId = (f: string) => (f === "body" ? BODY_ID : `campo-${f}`);

// Mismos textos que la tabla (SPEC 17).
const CONFIRM = {
  publish: {
    title: "¿Publicar el artículo?",
    description: (t: string) => `«${t}» va a aparecer en el blog.`,
    confirm: "Publicar",
    pending: "Publicando…",
  },
  unpublish: {
    title: "¿Pasar a borrador?",
    description: (t: string) => `«${t}» deja de verse en el blog. Sus comentarios y valoraciones se conservan.`,
    confirm: "Pasar a borrador",
    pending: "Guardando…",
  },
} as const;

const idle = { status: "idle" } as const;

const input =
  "min-h-11 w-full rounded-xl border border-cms-control bg-cms-panel px-3.5 text-[15px] text-cms-ink placeholder:text-cms-muted read-only:bg-cms-panel-alt aria-invalid:border-red-700";
const label = "text-sm font-semibold text-cms-ink";
const card = "rounded-2xl border border-cms-line bg-cms-panel p-5 shadow-[0_8px_24px_rgba(11,16,32,0.08)]";
const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60";

function FieldError({ field, errors }: { field: string; errors: ArticleFieldErrors }) {
  const message = errors[field as keyof ArticleFieldErrors];
  if (!message) return null;
  return (
    <p id={`${fieldId(field)}-error`} className="m-0 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

export function ArticleEditor({ post, categories }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<ArticleIntent | null>(null);
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | null>(null);
  const [errors, setErrors] = useState<ArticleFieldErrors>({});

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  // En un borrador ya guardado, el slug sigue al título solo si todavía coincide con él.
  const [slugTouched, setSlugTouched] = useState(post ? post.slug !== slugify(post.title) : false);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [cta, setCta] = useState(post?.cta ?? "");
  const [categoryId, setCategoryId] = useState(post?.categoryId ?? "");
  const [body, setBody] = useState<BlogDoc>(post?.body ?? EMPTY_DOC);
  // Las etiquetas se editan en el panel con TagInput (siguiente paso); mientras tanto se conservan.
  const [tags] = useState(post?.tags.map((t) => t.name) ?? []);
  const [saved, setSaved] = useState<Saved>({
    id: post?.id ?? null,
    status: post?.status ?? null,
    published: post?.publishedAt != null,
    updatedAt: post?.updatedAt.toISOString() ?? null,
    title: post?.title ?? "",
  });

  // La cabecera es fija: la barra del cuerpo se pega justo debajo.
  const head = useRef<HTMLElement>(null);
  const [headHeight, setHeadHeight] = useState(0);
  useLayoutEffect(() => {
    const el = head.current;
    if (!el) return;
    const measure = () => setHeadHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isPublished = saved.status === "publicado";
  const slugLocked = saved.published;
  const minutes = docReadingMinutes(body);

  const onTitle = (value: string) => {
    setTitle(value);
    if (!slugLocked && !slugTouched) setSlug(slugify(value));
  };
  const onSlug = (value: string) => {
    setSlug(value);
    // Borrarlo entero vuelve a seguir al título.
    if (value === "") {
      setSlugTouched(false);
      setSlug(slugify(title));
    } else setSlugTouched(true);
  };

  const buildForm = (intent: ArticleIntent) => {
    const fd = new FormData();
    fd.set("id", saved.id ?? "");
    fd.set("intent", intent);
    fd.set("updatedAt", saved.updatedAt ?? "");
    fd.set("title", title);
    fd.set("slug", slug);
    fd.set("excerpt", excerpt);
    fd.set("cta", cta);
    fd.set("categoryId", categoryId);
    fd.set("body", JSON.stringify(body));
    for (const t of tags) fd.append("tags", t);
    return fd;
  };

  const focusFirst = (found: ArticleFieldErrors) => {
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) document.getElementById(fieldId(first))?.focus();
  };

  // Misma validación que el servidor, para dar feedback antes de abrir el modal.
  const validate = (intent: ArticleIntent) => {
    const parsed = parseArticleForm(buildForm(intent), saved.status);
    if (parsed.ok) {
      setErrors({});
      return true;
    }
    setErrors(parsed.fieldErrors);
    focusFirst(parsed.fieldErrors);
    return false;
  };

  const save = (intent: ArticleIntent) => {
    const data = buildForm(intent);
    setBusy(intent);
    start(async () => {
      const res = await saveArticleAction(idle, data);
      setBusy(null);
      setConfirm(null);
      if (res.status === "error") {
        setErrors(res.fieldErrors ?? {});
        if (res.fieldErrors) focusFirst(res.fieldErrors);
        if (res.message) notify({ status: "error", message: res.message });
        return;
      }
      if (res.status !== "success") return;
      notify(res);
      setErrors({});
      setSlug(res.slug);
      setSaved((s) => ({
        id: res.id,
        status: res.postStatus,
        published: s.published || res.postStatus === "publicado",
        updatedAt: res.updatedAt,
        title: title.trim(),
      }));
      // Primer guardado en /new: de acá en más se edita el artículo ya creado.
      if (!saved.id) router.replace(`/admin/articles/${res.id}/edit`);
    });
  };

  const ask = (kind: "publish" | "unpublish") => {
    if (validate(kind)) setConfirm(kind);
  };

  const dialog = CONFIRM[confirm ?? (isPublished ? "unpublish" : "publish")];
  const spinning = (intent: ArticleIntent, text: string, pendingText: string) =>
    busy === intent ? (
      <>
        <Spinner /> {pendingText}
      </>
    ) : (
      text
    );

  const aria = (f: keyof ArticleFieldErrors) => ({
    "aria-invalid": errors[f] ? (true as const) : undefined,
    "aria-describedby": errors[f] ? `${fieldId(f)}-error` : undefined,
  });

  return (
    <div style={{ "--editor-head": `${headHeight}px` } as React.CSSProperties} className="flex flex-col gap-6">
      <header
        ref={head}
        className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-cms-line bg-cms-canvas py-3"
      >
        <div className="min-w-0 basis-full sm:basis-auto">
          <Link
            href="/admin/articles"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-cms-link underline-offset-2 hover:underline"
          >
            <ArrowLeft /> Artículos
          </Link>
          <h1 className="m-0 truncate font-display text-2xl leading-tight font-bold tracking-[-0.02em] text-cms-ink sm:text-3xl">
            {saved.id ? saved.title : "Nuevo artículo"}
          </h1>
          <p className="m-0 mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-cms-text">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isPublished ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
              }`}
            >
              {isPublished ? "Publicado" : "Borrador"}
            </span>
            <span>
              {saved.updatedAt ? `Actualizado ${formatDate(new Date(saved.updatedAt))}` : "sin guardar"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isPublished ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => ask("unpublish")}
                className={`${btn} border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-chip`}
              >
                {spinning("unpublish", "Pasar a borrador", "Guardando…")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => validate("save") && save("save")}
                className={`${btn} border-accent bg-accent text-white hover:bg-accent-hover`}
              >
                {spinning("save", "Guardar cambios", "Guardando…")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => validate("draft") && save("draft")}
                className={`${btn} border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-chip`}
              >
                {spinning("draft", "Guardar borrador", "Guardando…")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => ask("publish")}
                className={`${btn} border-accent bg-accent text-white hover:bg-accent-hover`}
              >
                {spinning("publish", "Publicar", "Publicando…")}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={fieldId("title")} className={label}>
              Título del artículo
            </label>
            <input
              id={fieldId("title")}
              type="text"
              value={title}
              maxLength={ARTICLE_LIMITS.title}
              onChange={(e) => onTitle(e.target.value)}
              {...aria("title")}
              className={`${input} min-h-14 font-display text-xl font-bold`}
            />
            <FieldError field="title" errors={errors} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={fieldId("excerpt")} className={label}>
              Resumen que aparece debajo del título
            </label>
            <textarea
              id={fieldId("excerpt")}
              rows={3}
              value={excerpt}
              maxLength={ARTICLE_LIMITS.excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              {...aria("excerpt")}
              className={`${input} py-2.5 leading-relaxed`}
            />
            <div className="flex justify-between gap-3">
              <FieldError field="excerpt" errors={errors} />
              <span className="ml-auto text-sm text-cms-muted">
                {excerpt.length} de {ARTICLE_LIMITS.excerpt}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={label} id="label-body">
              Cuerpo
            </span>
            <BodyEditor
              initial={post?.body ?? EMPTY_DOC}
              images={post?.images ?? {}}
              onChange={setBody}
              invalid={Boolean(errors.body)}
              describedBy={errors.body ? `${BODY_ID}-error` : undefined}
            />
            <FieldError field="body" errors={errors} />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-5" aria-label="Opciones de publicación">
          <section className={`${card} flex flex-col gap-4`}>
            <h2 className="m-0 font-display text-lg font-bold text-cms-ink">Publicación</h2>
            <Field label="Categoría" field="categoryId" errors={errors}>
              <select
                id={fieldId("categoryId")}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                {...aria("categoryId")}
                className={input}
              >
                <option value="" disabled>
                  Elegí una categoría
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="m-0 text-sm text-cms-text">Tiempo de lectura: {minutes} min, calculado según el texto.</p>
            <Field label="Llamado a la acción" field="cta" errors={errors}>
              <textarea
                id={fieldId("cta")}
                rows={3}
                value={cta}
                maxLength={ARTICLE_LIMITS.cta}
                onChange={(e) => setCta(e.target.value)}
                {...aria("cta")}
                className={`${input} py-2.5 leading-relaxed`}
              />
            </Field>
          </section>

          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="m-0 font-display text-lg font-bold text-cms-ink">URL</h2>
            <Field label="Dirección del artículo" field="slug" errors={errors}>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-sm text-cms-muted">
                  /blog/
                </span>
                <input
                  id={fieldId("slug")}
                  type="text"
                  value={slug}
                  maxLength={SLUG_MAX}
                  readOnly={slugLocked}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(e) => onSlug(e.target.value)}
                  {...aria("slug")}
                  aria-describedby={
                    [errors.slug && `${fieldId("slug")}-error`, slugLocked && "slug-note"].filter(Boolean).join(" ") ||
                    undefined
                  }
                  className={`${input} min-w-0 flex-1`}
                />
              </div>
            </Field>
            {slugLocked && (
              <p id="slug-note" className="m-0 text-sm text-cms-text">
                La URL no cambia porque el artículo ya se publicó.
              </p>
            )}
          </section>

          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="m-0 font-display text-lg font-bold text-cms-ink">Imagen de portada</h2>
            {post?.cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- miniatura de solo lectura; /media sirve el WebP ya procesado
              <img
                src={post.cover.src}
                alt={post.cover.alt}
                className="aspect-[16/9] w-full rounded-xl border border-cms-line object-cover"
              />
            ) : (
              <p className="m-0 text-sm text-cms-text">Sin portada</p>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={dialog.title}
        description={dialog.description(title.trim() || saved.title)}
        confirmLabel={dialog.confirm}
        pendingLabel={dialog.pending}
        pending={pending}
        onConfirm={() => confirm && save(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function Field({
  label: text,
  field,
  errors,
  children,
}: {
  label: string;
  field: string;
  errors: ArticleFieldErrors;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId(field)} className={label}>
        {text}
      </label>
      {children}
      <FieldError field={field} errors={errors} />
    </div>
  );
}
