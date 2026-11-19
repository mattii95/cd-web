"use client";

import { useId, useState } from "react";
import { ARTICLE_LIMITS, type ArticleTag, normalizeTagName } from "@/lib/admin/article-form";
import { slugify } from "@/lib/slug";

type Option = { slug: string; name: string };
type Props = {
  id: string;
  value: ArticleTag[]; // etiquetas elegidas; slug null = nueva
  options: Option[]; // todas las etiquetas de la tabla `tag`
  onChange: (tags: ArticleTag[]) => void;
  invalid?: boolean;
  describedBy?: string;
};

type Suggestion = { kind: "existing" | "new"; tag: ArticleTag };

// Combobox con chips: autocompleta sobre las etiquetas existentes y crea las nuevas al guardar.
export function TagInput({ id, value, options, onChange, invalid, describedBy }: Props) {
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const full = value.length >= ARTICLE_LIMITS.tags;
  // Una etiqueta elegida ocupa su slug y el slugify de su nombre.
  const taken = new Set(value.flatMap((t) => (t.slug ? [t.slug, slugify(t.name)] : [slugify(t.name)])));
  const query = slugify(text); // sin mayúsculas ni tildes
  // Una renombrada se busca por su nombre actual, no solo por el slug.
  const matches = (o: Option, exact: boolean) => {
    const keys = [o.slug, slugify(o.name)];
    return keys.some((k) => (exact ? k === query : k.includes(query)));
  };

  const suggestions: Suggestion[] = [];
  if (query) {
    for (const o of options)
      if (!taken.has(o.slug) && matches(o, false)) suggestions.push({ kind: "existing", tag: o });
    const exists = options.some((o) => matches(o, true)) || taken.has(query);
    if (!exists) suggestions.push({ kind: "new", tag: { slug: null, name: normalizeTagName(text) } });
  }
  const current = Math.min(active, suggestions.length - 1);

  const add = (t: ArticleTag) => {
    const name = normalizeTagName(t.name);
    const duplicated = t.slug ? taken.has(t.slug) : taken.has(slugify(name));
    if (slugify(name) && !duplicated && !full) onChange([...value, { slug: t.slug, name }]);
    setText("");
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!query) return;
      // Sin opción resaltada, lo escrito se toma tal cual; si ya existe se usa esa etiqueta.
      const picked = suggestions[current];
      const exact = options.find((o) => matches(o, true));
      add(picked && open ? picked.tag : (exact ?? { slug: null, name: text }));
    } else if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((current + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setActive((current - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Backspace" && text === "" && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const showList = open && suggestions.length > 0 && !full;

  return (
    <div className="relative flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {value.map((t) => (
            <li
              key={t.slug ?? `new:${slugify(t.name)}`}
              className="flex min-h-11 items-center gap-1 rounded-full bg-cms-chip pr-1 pl-3.5 text-sm font-semibold text-cms-ink"
            >
              <span className="[overflow-wrap:anywhere]">{t.name}</span>
              <button
                type="button"
                aria-label={`Quitar etiqueta ${t.name}`}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-full text-cms-text hover:bg-white hover:text-cms-ink"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${current}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        disabled={full}
        value={text}
        maxLength={ARTICLE_LIMITS.tagName}
        placeholder={full ? `Máximo ${ARTICLE_LIMITS.tags} etiquetas` : "Escribí y apretá Enter"}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="min-h-11 w-full rounded-xl border border-cms-control bg-cms-panel px-3.5 text-[15px] text-cms-ink placeholder:text-cms-muted disabled:bg-cms-panel-alt aria-invalid:border-red-700"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Etiquetas sugeridas"
        hidden={!showList}
        className="absolute top-full right-0 left-0 z-20 m-0 mt-1 max-h-60 list-none overflow-y-auto rounded-xl border border-cms-line bg-cms-panel p-1 shadow-[0_12px_32px_rgba(11,16,32,0.18)]"
      >
        {suggestions.map((s, i) => (
          <li
            key={`${s.kind}-${s.tag.slug ?? s.tag.name}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === current}
            // mousedown (no click): el input no pierde el foco antes de elegir.
            onMouseDown={(e) => {
              e.preventDefault();
              add(s.tag);
            }}
            className={`flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-cms-ink ${
              i === current ? "bg-cms-chip" : ""
            }`}
          >
            {s.kind === "new" ? `Crear «${s.tag.name}»` : s.tag.name}
          </li>
        ))}
      </ul>
      <p className="m-0 text-sm text-cms-muted">
        {value.length} de {ARTICLE_LIMITS.tags}
      </p>
    </div>
  );
}
