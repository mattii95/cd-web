"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker/media-picker";
import type { BlogDoc } from "@/db/blog-body";
import { EditorToolbar } from "./editor-toolbar";
import { createExtensions, type EditorImages } from "./extensions";
import { insertImage } from "./insert-image";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  // Mapa mediaId → miniatura, compartido con la vista de cada imagen. Se amplía con cada imagen
  // elegida; es un objeto mutable a propósito: las vistas lo leen al crearse.
  const [known] = useState<EditorImages>(() => ({ ...images }));
  // El editor se crea una vez: onChange siempre apunta a la última versión.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createExtensions(known),
    content: initial,
    onCreate: ({ editor: e }) => setEmpty(e.isEmpty),
    onUpdate: ({ editor: e }) => {
      setEmpty(e.isEmpty);
      onChangeRef.current(e.getJSON() as BlogDoc);
    },
    editorProps: {
      // Subir archivos saltearía el alt obligatorio: pegar o soltar archivos no hace nada.
      handlePaste: (_view, event) => (event.clipboardData?.files.length ?? 0) > 0,
      handleDrop: (_view, event) => (event.dataTransfer?.files.length ?? 0) > 0,
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
          <EditorToolbar editor={editor} onInsertImage={() => setPickerOpen(true)} />
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
      <MediaPicker
        open={pickerOpen}
        mode="body"
        onSelect={(item) => {
          setPickerOpen(false);
          if (editor) insertImage(editor, known, item);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
