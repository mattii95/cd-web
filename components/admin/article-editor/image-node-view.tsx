"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

// Miniatura de solo lectura. El mapa mediaId → { src, alt } lo pone el editor
// en `extension.options`; por ahora se resuelve en el paso 5.
export function ImageNodeView({ node, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      data-drag-handle
      data-selected={selected || undefined}
      contentEditable={false}
    >
      <span>{(node.attrs.alt as string | null) ?? "Imagen no disponible"}</span>
    </NodeViewWrapper>
  );
}
