import type { MediaItem } from "@/db/media";
import { formatDate } from "@/lib/format-date";

// Lo único que viaja a la grilla y al modal de detalle: ambos se arman con esta
// misma función para que la página y "Cargar más" rendericen igual.
export type CardItem = {
  id: string;
  src: string;
  alt: string;
  originalName: string;
  width: number;
  height: number;
  bytes: number;
  usage: { postId: string; title: string; as: "portada" | "cuerpo" }[];
  date: string;
};

export function toCardItem(item: MediaItem): CardItem {
  return {
    id: item.id,
    src: item.src,
    alt: item.alt,
    originalName: item.originalName,
    width: item.width,
    height: item.height,
    bytes: item.bytes,
    usage: item.usage.map(({ postId, title, as }) => ({ postId, title, as })),
    date: formatDate(item.createdAt),
  };
}
