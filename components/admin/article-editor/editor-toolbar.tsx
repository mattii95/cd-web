"use client";

import { type Editor, useEditorState } from "@tiptap/react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { LinkPopover } from "./link-popover";

type ItemKey =
  | "undo" | "redo" | "h2" | "h3" | "bold" | "italic" | "link"
  | "bullet" | "ordered" | "quote" | "tip" | "summary";

const svg = (children: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const glyph = (text: string, cls = "") => (
  <span aria-hidden="true" className={`text-[15px] leading-none ${cls}`}>{text}</span>
);

const ICONS: Record<ItemKey, ReactNode> = {
  undo: svg(<><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></>),
  redo: svg(<><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></>),
  h2: glyph("H2", "font-display font-bold"),
  h3: glyph("H3", "font-display font-bold"),
  bold: glyph("B", "font-bold"),
  italic: glyph("I", "font-serif italic font-bold"),
  link: svg(<><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>),
  bullet: svg(<><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>),
  ordered: svg(<><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 5l1.5-1v4M3.5 14.5c.5-1 2.5-1 2.5.3 0 1-2.5 1.7-2.5 2.7H6" /></>),
  quote: svg(<><path d="M5 17V12a5 5 0 015-5M13 17v-5a5 5 0 015-5" /><path d="M5 17h4v-4H5zM13 17h4v-4h-4z" /></>),
  tip: svg(<path d="M13 2L4 14h7l-1 8 9-12h-7z" />),
  summary: svg(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></>),
};

const GROUPS: { key: ItemKey; label: string }[][] = [
  [{ key: "undo", label: "Deshacer" }, { key: "redo", label: "Rehacer" }],
  [{ key: "h2", label: "Título H2" }, { key: "h3", label: "Subtítulo H3" }],
  [{ key: "bold", label: "Negrita" }, { key: "italic", label: "Cursiva" }, { key: "link", label: "Enlace" }],
  [{ key: "bullet", label: "Lista con viñetas" }, { key: "ordered", label: "Lista numerada" }],
  [{ key: "quote", label: "Cita" }, { key: "tip", label: "Consejo" }, { key: "summary", label: "En resumen" }],
];

const RUN: Record<Exclude<ItemKey, "link">, (e: Editor) => void> = {
  undo: (e) => e.chain().focus().undo().run(),
  redo: (e) => e.chain().focus().redo().run(),
  h2: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  h3: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  bold: (e) => e.chain().focus().toggleBold().run(),
  italic: (e) => e.chain().focus().toggleItalic().run(),
  bullet: (e) => e.chain().focus().toggleBulletList().run(),
  ordered: (e) => e.chain().focus().toggleOrderedList().run(),
  quote: (e) => e.chain().focus().toggleBlockquote().run(),
  tip: (e) => e.chain().focus().toggleTip().run(),
  summary: (e) => e.chain().focus().toggleSummary().run(),
};

export function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      canLink: !e.state.selection.empty || e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      tip: e.isActive("tip"),
      summary: e.isActive("summary"),
    }),
  });

  const outer = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const linkBtn = useRef<HTMLButtonElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [rover, setRover] = useState<ItemKey>("undo");

  const disabled = (k: ItemKey) =>
    k === "undo" ? !state.canUndo : k === "redo" ? !state.canRedo : k === "link" ? !state.canLink : false;
  const pressed = (k: ItemKey) => (k === "undo" || k === "redo" ? undefined : state[k]);
  const enabled = GROUPS.flat().map((i) => i.key).filter((k) => !disabled(k));
  // Un solo botón entra en el orden de tabulación; las flechas mueven entre los demás.
  const tabbable = enabled.includes(rover) ? rover : enabled[0];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const buttons = [...(bar.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0 || !buttons.length) return;
    let next: number | null = null;
    if (e.key in keys) next = (i + keys[e.key] + buttons.length) % buttons.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = buttons.length - 1;
    if (next === null) return;
    e.preventDefault();
    buttons[next].focus();
  };

  return (
    <div ref={outer} className="relative">
      <div
        ref={bar}
        role="toolbar"
        aria-label="Formato del texto"
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 overflow-x-auto rounded-t-2xl border-b border-cms-line bg-cms-panel-alt px-2 py-1.5"
      >
        {GROUPS.map((group, gi) => (
          <div key={gi} className="flex flex-none items-center gap-1">
            {gi > 0 && <span aria-hidden="true" className="mx-1 h-6 w-px bg-cms-line" />}
            {group.map(({ key, label }) => {
              const on = pressed(key);
              return (
                <button
                  key={key}
                  ref={key === "link" ? linkBtn : undefined}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={on}
                  aria-haspopup={key === "link" ? "dialog" : undefined}
                  aria-expanded={key === "link" ? linkOpen : undefined}
                  disabled={disabled(key)}
                  tabIndex={key === tabbable ? 0 : -1}
                  onFocus={() => setRover(key)}
                  // Mantiene la selección del editor al tocar el botón.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => (key === "link" ? setLinkOpen((o) => !o) : RUN[key](editor))}
                  className={`flex size-11 flex-none cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    on
                      ? "bg-accent text-white hover:bg-accent-hover"
                      : "text-cms-ink hover:bg-cms-chip"
                  }`}
                >
                  {ICONS[key]}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {linkOpen && (
        <LinkPopover editor={editor} anchor={linkBtn} container={outer} onClose={() => setLinkOpen(false)} />
      )}
    </div>
  );
}
