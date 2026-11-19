import Image from "next/image";
import type { CardItem } from "./card-item";

// Solo muestra: el modal de detalle cuelga de este botón.
export function MediaTile({ item, onOpen }: { item: CardItem; onOpen: () => void }) {
  const inUse = item.usage.length > 0;
  return (
    <button
      type="button"
      data-media-id={item.id}
      onClick={onOpen}
      aria-label={`Ver detalles de ${item.alt}`}
      className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-cms-line bg-cms-panel p-0 text-left transition-shadow hover:shadow-[0_8px_24px_rgba(11,16,32,0.12)]"
    >
      <Image
        src={item.src}
        width={item.width}
        height={item.height}
        alt=""
        sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 50vw"
        className="aspect-square w-full bg-cms-head object-cover"
      />
      <span className="flex flex-col gap-1.5 p-3">
        <span className="truncate text-[13px] font-semibold text-cms-ink">{item.alt}</span>
        <span
          className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            inUse ? "bg-cms-chip text-cms-link" : "bg-cms-panel-alt text-cms-muted"
          }`}
        >
          {inUse ? "En uso" : "Sin usar"}
        </span>
      </span>
    </button>
  );
}
