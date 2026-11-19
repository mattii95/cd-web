import type { Editor } from "@tiptap/react";
import type { EditorImages } from "./extensions";

type Picked = { id: string; src: string; alt: string };

// Las imágenes solo van en la raíz del doc: se inserta después del bloque raíz donde está el
// cursor (si está dentro de una lista o cita, después de esa lista o cita). Un párrafo vacío se reemplaza.
export function insertImage(editor: Editor, images: EditorImages, item: Picked) {
  // El mapa se amplía antes de insertar: la vista del nodo lee de ahí al crearse.
  images[item.id] = { src: item.src, alt: item.alt };

  const { $from, $to } = editor.state.selection;
  let from = $to.depth >= 1 ? $to.after(1) : $to.pos; // depth 0: nodo raíz seleccionado
  let to = from;
  const block = $to.depth >= 1 ? $to.node(1) : null;
  if (block?.type.name === "paragraph" && block.content.size === 0) {
    from = $from.depth >= 1 ? $from.before(1) : from;
    to = $to.after(1);
  }

  editor
    .chain()
    .insertContentAt(
      { from, to },
      { type: "image", attrs: { mediaId: item.id, alt: null, caption: null } },
    )
    .setNodeSelection(from)
    .focus()
    .run();
}
