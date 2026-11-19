"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { mergeTagsAction, searchTagOptionsAction } from "@/actions/admin/tags";
import { FormDialog, fieldInput, fieldLabel } from "@/components/admin/form-dialog";
import { notify } from "@/components/admin/toast";
import type { AdminTagRow } from "@/db/admin-tags";

type Option = { id: string; name: string; total: number };
const idle = { status: "idle" } as const;

// Combobox que busca en el servidor (máx. 10, sin la etiqueta de origen) y elige una sola etiqueta.
export function MergeTagDialog({ source, onClose }: { source: AdminTagRow; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [target, setTarget] = useState<Option | null>(null);
  const listId = useId();
  const inputId = useId();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(0); // descarta respuestas viejas si el usuario sigue escribiendo
  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (query: string, delay: number) => {
    clearTimeout(timer.current);
    const request = ++latest.current;
    timer.current = setTimeout(async () => {
      const found = await searchTagOptionsAction({ query, excludeId: source.id });
      if (request !== latest.current) return;
      setOptions(found);
      setSearched(true);
      setActive(0);
    }, delay);
  };

  const pick = (o: Option) => {
    setTarget(o);
    setText(o.name);
    setOpen(false);
  };

  const showList = open && options.length > 0;
  const current = Math.min(active, options.length - 1);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((current + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((current - 1 + options.length) % options.length);
    } else if (e.key === "Enter" && showList) {
      e.preventDefault(); // no envía el formulario: elige la opción resaltada
      pick(options[current]);
    } else if (e.key === "Escape" && showList) {
      e.preventDefault(); // cierra la lista, no el modal
      setOpen(false);
    }
  };

  const submit = () => {
    if (!target) return;
    start(async () => {
      const data = new FormData();
      data.set("sourceId", source.id);
      data.set("targetId", target.id);
      const res = await mergeTagsAction(idle, data);
      notify(res);
      if (res.status === "success") onClose();
    });
  };

  return (
    <FormDialog
      title={`Fusionar «${source.name}»`}
      submitLabel="Fusionar"
      pendingLabel="Fusionando…"
      pending={pending}
      submitDisabled={!target}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="relative flex flex-col gap-1.5">
        <label htmlFor={inputId} className={fieldLabel}>
          Etiqueta que queda
        </label>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${current}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={text}
          maxLength={100}
          placeholder="Buscá una etiqueta"
          onChange={(e) => {
            setText(e.target.value);
            setTarget(null); // al escribir hay que volver a elegir
            setOpen(true);
            search(e.target.value, 250);
          }}
          onFocus={() => {
            setOpen(true);
            if (!searched) search(text, 0);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={fieldInput}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Etiquetas encontradas"
          hidden={!showList}
          className="absolute top-full right-0 left-0 z-20 m-0 mt-1 max-h-60 list-none overflow-y-auto rounded-xl border border-cms-line bg-cms-panel p-1 shadow-[0_12px_32px_rgba(11,16,32,0.18)]"
        >
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === current}
              // mousedown (no click): el input no pierde el foco antes de elegir.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-sm font-semibold text-cms-ink ${
                i === current ? "bg-cms-chip" : ""
              }`}
            >
              <span className="[overflow-wrap:anywhere]">{o.name}</span>
              <span className="flex-none font-normal text-cms-muted">{o.total} artículos</span>
            </li>
          ))}
        </ul>
        {searched && options.length === 0 && (
          <p role="status" className="m-0 text-sm text-cms-muted">
            No hay otras etiquetas que coincidan.
          </p>
        )}
      </div>

      <p className="m-0 text-[15px] leading-relaxed text-cms-text [overflow-wrap:anywhere]">
        {target ? (
          <>
            Los {source.total} artículos de «{source.name}» pasan a «{target.name}» y «{source.name}» se borra. No se
            puede deshacer.
          </>
        ) : (
          <>Elegí la etiqueta que se queda con los {source.total} artículos de «{source.name}».</>
        )}
      </p>
    </FormDialog>
  );
}
