"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { type KeyboardEvent, useRef, useState } from "react";
import { MediaPicker } from "@/components/admin/media-picker/media-picker";
import { editorImages } from "./extensions";
import { ImageTextPopover, type ImageTextKind } from "./image-text-popover";
import { rememberImage } from "./insert-image";

const tool =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent px-3 text-[13px] font-semibold text-cms-ink transition-colors hover:bg-cms-chip aria-expanded:bg-cms-chip";

// Miniatura del cuerpo. Seleccionada, muestra una barra para el alt, el pie, cambiar y quitar.
export function ImageNodeView({ node, selected, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const images = editorImages(editor);
  const mediaId = node.attrs.mediaId as string;
  const thumb = images[mediaId];
  const ownAlt = node.attrs.alt as string | null;
  const caption = node.attrs.caption as string | null;
  const alt = ownAlt ?? thumb?.alt ?? "";

  const bar = useRef<HTMLDivElement>(null);
  const [popover, setPopover] = useState<ImageTextKind | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Al perder la selección se cierra el popover (ajuste durante el render, sin efecto).
  if (!selected && popover) setPopover(null);

  // Devuelve el foco a la imagen: el editor la deja seleccionada.
  const focusImage = () => {
    const pos = getPos();
    const chain = editor.chain().focus();
    (pos === undefined ? chain : chain.setNodeSelection(pos)).run();
  };

  const toggle = (kind: ImageTextKind) => setPopover((p) => (p === kind ? null : kind));

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const buttons = [...(bar.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    buttons[(i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length].focus();
  };

  // Mantiene la selección del editor al tocar un botón.
  const keepSelection = { onMouseDown: (e: React.MouseEvent) => e.preventDefault() };

  return (
    <NodeViewWrapper
      as="figure"
      data-drag-handle
      className={`ae-image relative${selected ? " is-selected" : ""}`}
      contentEditable={false}
    >
      {selected && (
        <div
          ref={bar}
          role="toolbar"
          aria-label="Opciones de la imagen"
          onKeyDown={onKeyDown}
          className="absolute top-3 right-3 left-3 z-10 flex max-w-fit flex-wrap gap-1 rounded-xl border border-cms-line bg-cms-panel p-1 shadow-[0_8px_24px_rgba(11,16,32,0.18)]"
        >
          <button type="button" aria-expanded={popover === "alt"} {...keepSelection} onClick={() => toggle("alt")} className={tool}>
            Texto alternativo
          </button>
          <button type="button" aria-expanded={popover === "caption"} {...keepSelection} onClick={() => toggle("caption")} className={tool}>
            Pie de foto
          </button>
          <button
            type="button"
            {...keepSelection}
            onClick={() => {
              setPopover(null);
              setPickerOpen(true);
            }}
            className={tool}
          >
            Cambiar imagen
          </button>
          <button type="button" {...keepSelection} onClick={() => deleteNode()} className={`${tool} text-red-700`}>
            Quitar imagen
          </button>
        </div>
      )}
      {selected && popover && (
        <ImageTextPopover
          key={popover}
          kind={popover}
          value={popover === "alt" ? ownAlt : caption}
          mediaAlt={thumb?.alt ?? ""}
          toolbar={bar}
          onApply={(value) => {
            updateAttributes({ [popover]: value });
            setPopover(null);
            focusImage();
          }}
          onClose={() => {
            setPopover(null);
            focusImage();
          }}
        />
      )}
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura del panel; /media sirve el WebP ya procesado
        <img src={thumb.src} alt={alt} draggable={false} />
      ) : (
        <div className="ae-image-missing">Imagen no disponible</div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
      {pickerOpen && (
        <MediaPicker
          open
          mode="body"
          onSelect={(item) => {
            rememberImage(editor, item);
            // El alt describía la imagen vieja; el pie suele hablar del contexto y se conserva.
            updateAttributes({ mediaId: item.id, alt: null });
            setPickerOpen(false);
            focusImage();
          }}
          onClose={() => {
            setPickerOpen(false);
            focusImage();
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
