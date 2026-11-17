import type { MediaItem } from "@/db/media";
import { formatDate } from "@/lib/format-date";

// Datos de una MediaCard. La página y la acción de "Cargar más" arman las
// tarjetas con esta misma función para que rendericen igual.
export type CardItem = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  bytes: number;
  titles: string[]; // posts donde se usa
  date: string;
};

export function toCardItem(item: MediaItem): CardItem {
  return {
    id: item.id,
    src: item.src,
    alt: item.alt,
    width: item.width,
    height: item.height,
    bytes: item.bytes,
    titles: [...new Set(item.usage.map((u) => u.title))],
    date: formatDate(item.createdAt),
  };
}
