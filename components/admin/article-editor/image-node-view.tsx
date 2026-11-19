"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { EditorImages } from "./extensions";

// Miniatura de solo lectura: se puede seleccionar, mover y borrar con el teclado,
// pero no insertar ni editar alt/caption (eso llega con el selector de Medios).
export function ImageNodeView({ node, selected, extension }: NodeViewProps) {
  const images = (extension.options as { images: EditorImages }).images;
  const mediaId = node.attrs.mediaId as string;
  const thumb = images[mediaId];
  const alt = (node.attrs.alt as string | null) ?? thumb?.alt ?? "";
  const caption = node.attrs.caption as string | null;

  return (
    <NodeViewWrapper
      as="figure"
      data-drag-handle
      className={`ae-image${selected ? " is-selected" : ""}`}
      contentEditable={false}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura del panel; /media sirve el WebP ya procesado
        <img src={thumb.src} alt={alt} draggable={false} />
      ) : (
        <div className="ae-image-missing">Imagen no disponible</div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </NodeViewWrapper>
  );
}
