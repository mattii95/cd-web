"use client";

import { ArrowUp } from "@/components/icons";

const btn =
  "flex size-11 flex-none cursor-pointer items-center justify-center rounded-full border border-cms-line bg-cms-chip text-cms-ink transition-colors hover:border-cms-link disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-cms-line";

export const moveButtonId = (id: string, direction: "up" | "down") => `move-${direction}-${id}`;

// "Subir" y "Bajar": la primera no sube y la última no baja. El foco lo maneja la tabla.
export function CategoryOrderButtons({
  id,
  label,
  position,
  isFirst,
  isLast,
  busy,
  onMove,
}: {
  id: string;
  label: string;
  position: number; // 1-based
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (direction: "up" | "down") => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        id={moveButtonId(id, "up")}
        type="button"
        aria-label={`Subir ${label}`}
        disabled={isFirst || busy}
        onClick={() => onMove("up")}
        className={btn}
      >
        <ArrowUp size={16} />
      </button>
      <span className="w-6 text-center font-display text-base font-bold text-cms-ink tabular-nums" aria-hidden="true">
        {position}
      </span>
      <button
        id={moveButtonId(id, "down")}
        type="button"
        aria-label={`Bajar ${label}`}
        disabled={isLast || busy}
        onClick={() => onMove("down")}
        className={btn}
      >
        <ArrowUp size={16} className="rotate-180" />
      </button>
    </div>
  );
}
