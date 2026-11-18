import { mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { isAllowedHref } from "@/db/blog-body";
import { ImageNodeView } from "./image-node-view";

// El doc admite los bloques normales y la imagen (solo en la raíz).
const BlogDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "(block | image)+",
});

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    tip: { toggleTip: () => ReturnType };
    summary: { toggleSummary: () => ReturnType };
  }
}

const Tip = Node.create({
  name: "tip",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="tip"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "tip" }),
    0,
  ],
  addCommands() {
    return {
      toggleTip:
        () =>
        ({ commands }) =>
          commands.toggleNode(this.name, "paragraph"),
    };
  },
});

const Summary = Node.create({
  name: "summary",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="summary"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "summary" }),
    0,
  ],
  addCommands() {
    return {
      toggleSummary:
        () =>
        ({ commands }) =>
          commands.toggleNode(this.name, "paragraph"),
    };
  },
});

// Atómico: se muestra, se selecciona y se mueve, pero no se inserta ni se edita.
export type EditorImages = Record<string, { src: string; alt: string }>;

const BlogImage = Node.create<{ images: EditorImages }>({
  name: "image",
  addOptions: () => ({ images: {} }),
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      mediaId: { default: null },
      alt: { default: null },
      caption: { default: null },
    };
  },
  parseHTML: () => [{ tag: "figure[data-media-id]" }],
  renderHTML: ({ HTMLAttributes }) => [
    "figure",
    mergeAttributes({ "data-media-id": HTMLAttributes.mediaId }),
  ],
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

export function createExtensions(images: EditorImages = {}) {
  return [
    StarterKit.configure({
      document: false,
      heading: { levels: [2, 3] },
      link: {
        openOnClick: false,
        autolink: false,
        isAllowedUri: (url: string) => isAllowedHref(url),
      },
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      horizontalRule: false,
    }),
    BlogDocument,
    Tip,
    Summary,
    BlogImage.configure({ images }),
  ];
}
