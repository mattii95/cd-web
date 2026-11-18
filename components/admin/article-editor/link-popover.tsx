"use client";

import type { Editor } from "@tiptap/react";
import { type FormEvent, type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { isAllowedHref } from "@/db/blog-body";

export const LINK_ERROR = "Usá una dirección que empiece con https:// o con /.";

type Props = {
  editor: Editor;
  anchor: RefObject<HTMLElement | null>; // botón "Enlace"
  container: RefObject<HTMLElement | null>; // la barra: el popover se ancla debajo y no se recorta
  onClose: () => void;
};

const btn =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors";

export function LinkPopover({ editor, anchor, container, onClose }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(() => (editor.getAttributes("link").href as string | undefined) ?? "");
  const [invalid, setInvalid] = useState(false);
  const hasLink = editor.isActive("link");

  // Alineado con el botón, sin salirse del ancho de la barra.
  useLayoutEffect(() => {
    const a = anchor.current?.getBoundingClientRect();
    const c = container.current?.getBoundingClientRect();
    const root = rootRef.current;
    if (!a || !c || !root) return;
    const width = Math.min(352, c.width);
    root.style.width = `${width}px`;
    root.style.left = `${Math.max(0, Math.min(a.left - c.left, c.width - width))}px`;
  }, [anchor, container]);

  useEffect(() => inputRef.current?.focus(), []);

  // Clic fuera: cierra sin tocar el editor.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchor, onClose]);

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const apply = (e: FormEvent) => {
    e.preventDefault();
    const href = url.trim();
    if (!isAllowedHref(href)) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Enlace"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
      className="absolute top-full z-30 mt-2 rounded-xl border border-cms-line bg-cms-panel p-4 shadow-[0_12px_32px_rgba(11,16,32,0.18)]"
    >
      <form onSubmit={apply} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-url`} className="text-sm font-semibold text-cms-ink">
            URL
          </label>
          <input
            ref={inputRef}
            id={`${id}-url`}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={url}
            placeholder="https://… o /servicios"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onChange={(e) => {
              setUrl(e.target.value);
              setInvalid(false);
            }}
            className="min-h-11 w-full rounded-lg border border-cms-control bg-cms-panel px-3 text-[15px] text-cms-ink aria-invalid:border-red-700"
          />
          {invalid && (
            <p id={errorId} role="alert" className="m-0 text-sm font-medium text-red-700">
              {LINK_ERROR}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {hasLink && (
            <button
              type="button"
              onClick={remove}
              className={`${btn} border-cms-control bg-cms-panel text-cms-ink hover:bg-cms-chip`}
            >
              Quitar enlace
            </button>
          )}
          <button type="submit" className={`${btn} border-accent bg-accent text-white hover:bg-accent-hover`}>
            Aplicar
          </button>
        </div>
      </form>
    </div>
  );
}
