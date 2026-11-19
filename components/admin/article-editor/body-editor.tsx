"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import type { BlogDoc } from "@/db/blog-body";
import { EditorToolbar } from "./editor-toolbar";
import { createExtensions, type EditorImages } from "./extensions";

export const BODY_ID = "campo-body";

type Props = {
  initial: BlogDoc;
  images: EditorImages;
  onChange: (doc: BlogDoc) => void;
  invalid?: boolean;
  describedBy?: string;
};

export function BodyEditor({ initial, images, onChange, invalid, describedBy }: Props) {
  const [empty, setEmpty] = useState(false);
  // El editor se crea una vez: onChange siempre apunta a la última versión.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createExtensions(images),
    content: initial,
    onCreate: ({ editor: e }) => setEmpty(e.isEmpty),
    onUpdate: ({ editor: e }) => {
      setEmpty(e.isEmpty);
      onChangeRef.current(e.getJSON() as BlogDoc);
    },
    editorProps: {
      attributes: {
        id: BODY_ID,
        "aria-label": "Cuerpo del artículo",
        "aria-multiline": "true",
      },
    },
  });

  // Los atributos de error cambian después de crear el editor.
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    if (invalid) dom.setAttribute("aria-invalid", "true");
    else dom.removeAttribute("aria-invalid");
    if (describedBy) dom.setAttribute("aria-describedby", describedBy);
    else dom.removeAttribute("aria-describedby");
  }, [editor, invalid, describedBy]);

  return (
    <div
      className={`rounded-2xl border bg-cms-panel shadow-[0_8px_24px_rgba(11,16,32,0.08)] focus-within:border-accent ${
        invalid ? "border-red-700" : "border-cms-line"
      }`}
    >
      {/* La barra queda pegada debajo de la cabecera fija del editor. */}
      <div className="sticky top-[var(--editor-head,0px)] z-20 rounded-t-2xl bg-cms-panel">
        {editor ? (
          <EditorToolbar editor={editor} />
        ) : (
          <div aria-hidden="true" className="h-[57px] rounded-t-2xl border-b border-cms-line bg-cms-panel-alt" />
        )}
      </div>
      <div className="relative">
        {empty && (
          <p aria-hidden="true" className="pointer-events-none absolute top-6 left-6 m-0 text-lg text-cms-muted">
            Empezá a escribir…
          </p>
        )}
        <EditorContent editor={editor} className="article-editor" />
      </div>
    </div>
  );
}
